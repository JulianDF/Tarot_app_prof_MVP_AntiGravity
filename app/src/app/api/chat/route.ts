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
import * as logger from '@/lib/chatLogger';

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

    const { messages, activeSpread, spreadLedger, conversationSummary } = body;

    if (!messages || messages.length === 0) {
        return new Response(
            JSON.stringify({ error: 'Messages array is required' }),
            { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
    }

    // Create SSE stream
    const { stream, send, close } = createSSEStream();

    // Process chat in background
    processChat(messages, activeSpread, spreadLedger, conversationSummary, send, close);

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
    conversationSummary: string | undefined,
    send: (event: Record<string, unknown>) => void,
    close: () => void
) {
    const sessionId = Date.now().toString(36);
    let totalToolCalls = 0;
    let thinkingCalls = 0;

    try {
        // Log session start
        logger.logSessionStart(sessionId, messages.length);
        logger.logContext(
            activeSpread?.spread.name || null,
            spreadLedger?.length || 0,
            messages.length > 1
        );

        // Log user message (last one)
        const lastUserMsg = messages.filter(m => m.role === 'user').pop();
        if (lastUserMsg) {
            logger.logUserMessage(lastUserMsg.content);
        }

        // Build system message with context
        let systemContent = MINI_SYSTEM_PROMPT;

        // Add conversation summary if present (compressed older messages)
        if (conversationSummary) {
            systemContent += '\n\n---\n\n## Summary of Earlier Conversation\n' + conversationSummary;
        }

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
            const iterationStart = Date.now();
            logger.logMiniCall(`Iteration ${toolIterations}`);

            // Log context sent to mini (first iteration only to avoid spam)
            if (toolIterations === 1) {
                logger.logModelContext('mini', {
                    systemPrompt: systemContent,
                    messages: openaiMessages,
                    conversationSummary,
                    ledger: currentLedger,
                });
            }

            // Call OpenAI with streaming
            const apiCallStart = Date.now();

            // Log the FULL API call payload
            const apiPayload = {
                model: 'gpt-4o-mini',
                messages: openaiMessages,
                tools: TOOL_DEFINITIONS.map(t => t.function.name), // Just names for brevity
                tool_choice: 'auto',
                max_tokens: 2000,
            };
            console.log(`\n[API CALL - MINI - Iteration ${toolIterations}]`);
            console.log(JSON.stringify(apiPayload, null, 2));

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
            let firstTokenTime: number | null = null;

            for await (const chunk of response) {
                // Log time to first token
                if (firstTokenTime === null) {
                    firstTokenTime = Date.now();
                    const ttft = firstTokenTime - apiCallStart;
                    console.log(`[TIMING] Model: gpt-4o-mini | Time to first token: ${ttft}ms`);
                }

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

            // If no tool calls, model decided to respond directly
            if (toolCalls.length === 0) {
                logger.logDecision('direct_response');
                logger.logMiniTextGeneration(assistantContent.length);
                break;
            }

            // Log tool call decisions
            for (const tc of toolCalls) {
                logger.logDecision('tool_call', tc.name);
                totalToolCalls++;
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
            // Track if we've already called request_interpretation to prevent duplicates
            let hasCalledInterpretation = false;

            for (const toolCall of toolCalls) {
                const parsedArgs = JSON.parse(toolCall.arguments || '{}');
                logger.logToolCall(toolCall.name, parsedArgs);

                send({
                    type: 'tool_call',
                    id: toolCall.id,
                    name: toolCall.name,
                    arguments: parsedArgs
                });

                let toolResult: string;

                try {
                    const args = parsedArgs;

                    switch (toolCall.name) {
                        case 'list_spreads': {
                            const result = executeListSpreads();
                            toolResult = JSON.stringify(result, null, 2);
                            logger.logToolResult('list_spreads', true, `${result.spreads.length} spreads`);
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
                                logger.logToolResult('draw_cards', true, `${result.spreadWithCards.cards.length} cards drawn`);
                            } else {
                                toolResult = JSON.stringify({ error: result.error });
                                logger.logToolResult('draw_cards', false, result.error || 'Unknown error');
                            }
                            break;
                        }

                        case 'request_interpretation': {
                            // Prevent duplicate interpretation calls in same turn
                            if (hasCalledInterpretation) {
                                toolResult = 'SYSTEM: Interpretation already provided. Do not call this again.';
                                logger.logToolResult('request_interpretation', false, 'Duplicate call blocked');
                                break;
                            }
                            hasCalledInterpretation = true;

                            if (!currentActiveSpread) {
                                toolResult = 'Error: No spread has been laid yet. Please draw cards first.';
                                logger.logToolResult('request_interpretation', false, 'No active spread');
                            } else {
                                // Log thinking handoff
                                thinkingCalls++;
                                logger.logThinkingHandoff(
                                    currentActiveSpread.spread.name,
                                    currentActiveSpread.question
                                );

                                // Stream interpretation from thinking model
                                send({ type: 'text', content: '\n\n' });

                                const context: InterpretationContext = {
                                    activeSpread: currentActiveSpread,
                                    // Pass the same messages array that mini receives
                                    // This ensures thinking sees the exact same conversation context
                                    messages: messages.slice(-20),
                                    spreadLedger: currentLedger,
                                    conversationSummary,
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

                                // Add spacing before mini's closing message
                                send({ type: 'text', content: '\n\n' });

                                toolResult = `SYSTEM: You have just shared a complete interpretation with the user. Now briefly invite them to share their thoughts or ask questions. Speak warmly and directly to them. Do NOT summarize or repeat the interpretation.`;
                                logger.logToolResult('request_interpretation', true, `${interpretation.length} chars from thinking`);
                            }
                            break;
                        }

                        default:
                            toolResult = `Unknown tool: ${toolCall.name}`;
                            logger.logToolResult(toolCall.name, false, 'Unknown tool');
                    }
                } catch (error) {
                    toolResult = `Tool error: ${error instanceof Error ? error.message : 'Unknown error'}`;
                    logger.logError(`tool:${toolCall.name}`, error);
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
        logger.logSessionEnd(totalToolCalls, thinkingCalls);
    } catch (error) {
        console.error('Chat processing error:', error);
        logger.logError('processChat', error);
        send({
            type: 'error',
            message: error instanceof Error ? error.message : 'Chat processing failed'
        });
    } finally {
        close();
    }
}
