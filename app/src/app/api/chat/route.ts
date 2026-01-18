/**
 * Chat API — Streaming chat endpoint with tool orchestration
 * 
 * Implements the dual-model architecture from spec/ai-architecture.md:
 * - Conversation model (GPT 5.2 mini) for fast responses and tool calls
 * - Thinking model for deep interpretations (via request_interpretation tool)
 */

import { NextRequest } from 'next/server';
import OpenAI from 'openai';
import { MINI_SYSTEM_PROMPT } from '@/prompts/mini-system';
import { ChatRequest, SpreadWithCards, SpreadLedgerEntry } from '@/types';
import {
    TOOL_DEFINITIONS,
    executeListSpreads,
    executeDrawCards,
    formatSpreadForAI,
    formatLedgerForAI,
    createLedgerEntry,
} from './tools';
import { requestThinkingInterpretation, InterpretationContext } from './thinking';
import { getAllCards } from '@/services/cardService';

// ─────────────────────────────────────────────────────────────────────────────
// OpenAI Client
// ─────────────────────────────────────────────────────────────────────────────

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

// ─────────────────────────────────────────────────────────────────────────────
// SSE Helpers
// ─────────────────────────────────────────────────────────────────────────────

function createSSEStream() {
    const encoder = new TextEncoder();
    let controller: ReadableStreamDefaultController<Uint8Array>;

    const stream = new ReadableStream<Uint8Array>({
        start(c) {
            controller = c;
        },
    });

    const send = (event: Record<string, unknown>) => {
        try {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        } catch {
            // Stream may be closed
        }
    };

    const close = () => {
        try {
            controller.close();
        } catch {
            // Already closed
        }
    };

    return { stream, send, close };
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Chat Handler
// ─────────────────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
    // Validate API key
    if (!process.env.OPENAI_API_KEY) {
        return new Response(
            JSON.stringify({ error: 'OpenAI API key not configured' }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
    }

    let body: ChatRequest;
    try {
        body = await request.json();
    } catch {
        return new Response(
            JSON.stringify({ error: 'Invalid JSON body' }),
            { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
    }

    const { messages, activeSpread, spreadLedger } = body;

    if (!messages || messages.length === 0) {
        return new Response(
            JSON.stringify({ error: 'Messages array is required' }),
            { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
    }

    // Create SSE stream
    const { stream, send, close } = createSSEStream();

    // Process chat in background
    processChat(messages, activeSpread, spreadLedger, send, close);

    return new Response(stream, {
        headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
        },
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// Chat Processing
// ─────────────────────────────────────────────────────────────────────────────

import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';

async function processChat(
    messages: Array<{ role: 'user' | 'assistant'; content: string }>,
    activeSpread: SpreadWithCards | undefined,
    spreadLedger: SpreadLedgerEntry[] | undefined,
    send: (event: Record<string, unknown>) => void,
    close: () => void
) {
    try {
        // Build system message with context
        let systemContent = MINI_SYSTEM_PROMPT;

        // Add active spread context if present
        if (activeSpread) {
            systemContent += '\n\n---\n\n' + formatSpreadForAI(activeSpread);
        }

        // Add spread ledger if present
        if (spreadLedger && spreadLedger.length > 0) {
            systemContent += '\n\n---\n\n' + formatLedgerForAI(spreadLedger);
        }

        // Build conversation history for OpenAI
        const openaiMessages: ChatCompletionMessageParam[] = [
            { role: 'system', content: systemContent },
            ...messages.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
        ];

        // State for tool loop
        let currentActiveSpread = activeSpread;
        let currentLedger = spreadLedger || [];
        const maxToolIterations = 5;
        let toolIterations = 0;

        // Tool execution loop
        while (toolIterations < maxToolIterations) {
            toolIterations++;

            // Call OpenAI with streaming
            const response = await openai.chat.completions.create({
                model: 'gpt-4o-mini',
                messages: openaiMessages,
                tools: TOOL_DEFINITIONS,
                tool_choice: 'auto',
                stream: true,
                max_tokens: 2000,
            });

            // Accumulate the response
            let assistantContent = '';
            let toolCalls: Array<{
                id: string;
                name: string;
                arguments: string;
            }> = [];
            let currentToolIndex = -1;

            for await (const chunk of response) {
                const delta = chunk.choices[0]?.delta;

                // Handle text content
                if (delta?.content) {
                    assistantContent += delta.content;
                    send({ type: 'text', content: delta.content });
                }

                // Handle tool calls
                if (delta?.tool_calls) {
                    for (const tc of delta.tool_calls) {
                        if (tc.index !== undefined) {
                            if (tc.index !== currentToolIndex) {
                                currentToolIndex = tc.index;
                                toolCalls[tc.index] = {
                                    id: tc.id || '',
                                    name: tc.function?.name || '',
                                    arguments: tc.function?.arguments || '',
                                };
                            } else {
                                // Append to existing tool call (arguments come in chunks)
                                if (tc.id && !toolCalls[tc.index].id) toolCalls[tc.index].id = tc.id;
                                if (tc.function?.name && !toolCalls[tc.index].name) toolCalls[tc.index].name = tc.function.name;
                                if (tc.function?.arguments) toolCalls[tc.index].arguments += tc.function.arguments;
                            }
                        }
                    }
                }
            }

            // If no tool calls, we're done
            if (toolCalls.length === 0) {
                break;
            }

            // Add assistant message with tool calls to history
            openaiMessages.push({
                role: 'assistant',
                content: assistantContent || null,
                tool_calls: toolCalls.map(tc => ({
                    id: tc.id,
                    type: 'function' as const,
                    function: { name: tc.name, arguments: tc.arguments },
                })),
            });

            // Execute each tool call
            for (const toolCall of toolCalls) {
                send({
                    type: 'tool_call',
                    id: toolCall.id,
                    name: toolCall.name,
                    arguments: JSON.parse(toolCall.arguments || '{}')
                });

                let toolResult: string;

                try {
                    const args = JSON.parse(toolCall.arguments || '{}');

                    switch (toolCall.name) {
                        case 'list_spreads': {
                            const result = executeListSpreads();
                            toolResult = JSON.stringify(result, null, 2);
                            break;
                        }

                        case 'draw_cards': {
                            const result = await executeDrawCards(args);
                            if (result.success && result.reading && result.spreadWithCards) {
                                // Update active spread
                                currentActiveSpread = result.spreadWithCards;

                                // Send spread_laid event to client (include spreadWithCards for card names)
                                send({
                                    type: 'spread_laid',
                                    reading: result.reading,
                                    spreadWithCards: result.spreadWithCards
                                });

                                // Format result for AI
                                toolResult = formatSpreadForAI(result.spreadWithCards);
                            } else {
                                toolResult = JSON.stringify({ error: result.error });
                            }
                            break;
                        }

                        case 'request_interpretation': {
                            if (!currentActiveSpread) {
                                toolResult = 'Error: No spread has been laid yet. Please draw cards first.';
                            } else {
                                // Stream interpretation from thinking model
                                send({ type: 'text', content: '\n\n' });

                                const context: InterpretationContext = {
                                    activeSpread: currentActiveSpread,
                                    conversationContext: messages.slice(-6).map(m =>
                                        `${m.role === 'user' ? 'User' : 'Reader'}: ${m.content}`
                                    ).join('\n'),
                                    spreadLedger: currentLedger,
                                    focusArea: args.focus_area,
                                };

                                let interpretation = '';
                                for await (const chunk of requestThinkingInterpretation(context)) {
                                    interpretation += chunk;
                                    send({ type: 'text', content: chunk });
                                }

                                // Add to ledger for future context
                                const allCards = getAllCards();
                                if (currentActiveSpread) {
                                    const reading = {
                                        id: currentActiveSpread.reading_id,
                                        created_at: new Date().toISOString(),
                                        spread_id: currentActiveSpread.spread.source.spread_id,
                                        spread_snapshot: currentActiveSpread.spread,
                                        question: currentActiveSpread.question,
                                        allow_duplicates: false,
                                        allow_reversals: true,
                                        cards: currentActiveSpread.cards.map(c => ({
                                            position_index: c.position_index,
                                            card_id: c.card.id,
                                            reversed: c.reversed,
                                        })),
                                        rng: { method_used: 'fallback' as const, attempts: [] },
                                    };
                                    currentLedger = [...currentLedger, createLedgerEntry(reading, allCards)];
                                }

                                toolResult = `SYSTEM: The deep interpretation has been successfully streamed to the user. DO NOT generate your own interpretation or list the cards again. Just ask the user if they have any questions about the reading.`;
                            }
                            break;
                        }

                        default:
                            toolResult = `Unknown tool: ${toolCall.name}`;
                    }
                } catch (error) {
                    toolResult = `Tool error: ${error instanceof Error ? error.message : 'Unknown error'}`;
                }

                send({ type: 'tool_result', name: toolCall.name, result: toolResult });

                // Add tool result to history
                openaiMessages.push({
                    role: 'tool',
                    tool_call_id: toolCall.id,
                    content: toolResult,
                });
            }
        }

        send({ type: 'done' });
    } catch (error) {
        console.error('Chat processing error:', error);
        send({
            type: 'error',
            message: error instanceof Error ? error.message : 'Chat processing failed'
        });
    } finally {
        close();
    }
}
