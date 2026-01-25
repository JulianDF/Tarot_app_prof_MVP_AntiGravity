/**
 * Chat API — Streaming chat endpoint with tool orchestration
 * 
 * Implements the dual-model architecture from spec/ai-architecture.md:
 * - Conversation model (Claude Haiku 4.5) for fast responses and tool calls
 * - Thinking model (GPT 5.2 Thinking) for deep interpretations (via request_interpretation tool)
 */

import { NextRequest } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { MINI_SYSTEM_PROMPT } from '@/prompts/mini-system';
import { ChatRequest, SpreadWithCards, SpreadLedgerEntry } from '@/types';
import {
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
// Clients
// ─────────────────────────────────────────────────────────────────────────────

const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
});

// Keep OpenAI for thinking model
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

// ─────────────────────────────────────────────────────────────────────────────
// Claude Tool Definitions
// ─────────────────────────────────────────────────────────────────────────────

const CLAUDE_TOOLS: Anthropic.Tool[] = [
    {
        name: 'list_spreads',
        description: 'List available spreads with their purpose and position meanings. Use this to choose an appropriate spread for the user\'s question.',
        input_schema: {
            type: 'object',
            properties: {},
            required: [],
        },
    },
    {
        name: 'draw_cards',
        description: 'Lay a spread by drawing cards. For built-in spreads, provide spread_slug. For custom spreads, provide custom_positions array.',
        input_schema: {
            type: 'object',
            properties: {
                spread_slug: {
                    type: 'string',
                    description: 'Slug of built-in spread (e.g., \'diamond_spread\', \'two_paths\', \'energy_mix\', \'blockage\')',
                },
                custom_positions: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'For custom spreads: array of position meanings',
                },
                question: {
                    type: 'string',
                    description: 'The user\'s question for this reading',
                },
            },
            required: ['question'],
        },
    },
    {
        name: 'request_interpretation',
        description: 'Hand off to deeper intelligence for interpretation or complex reasoning. Once called, thinking will respond directly to the user and your turn ends. Call this after laying a spread, or when the user asks a complex question that benefits from deeper analysis.',
        input_schema: {
            type: 'object',
            properties: {},
            required: [],
        },
    },
];

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
    // Validate API keys
    if (!process.env.ANTHROPIC_API_KEY) {
        return new Response(
            JSON.stringify({ error: 'Anthropic API key not configured' }),
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
// Chat Processing with Claude
// ─────────────────────────────────────────────────────────────────────────────

type ClaudeMessage = Anthropic.MessageParam;

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

        // Build conversation history for Claude
        const claudeMessages: ClaudeMessage[] = messages.map(m => ({
            role: m.role,
            content: m.content,
        }));

        // State for tool loop
        let currentActiveSpread = activeSpread;
        let currentLedger = spreadLedger || [];
        const maxToolIterations = 5;
        let toolIterations = 0;

        // Tool execution loop
        while (toolIterations < maxToolIterations) {
            toolIterations++;
            logger.logMiniCall(`Iteration ${toolIterations}`);

            // Log context sent to Claude (first iteration only)
            if (toolIterations === 1) {
                logger.logModelContext('claude-haiku', {
                    systemPrompt: systemContent,
                    messages: claudeMessages,
                    conversationSummary,
                    ledger: currentLedger,
                });
            }

            const apiCallStart = Date.now();
            console.log(`\n[API CALL - CLAUDE HAIKU 4.5 - Iteration ${toolIterations}]`);

            // Call Claude with streaming
            const stream = anthropic.messages.stream({
                model: 'claude-haiku-4-5-20251001',
                max_tokens: 2000,
                system: systemContent,
                messages: claudeMessages,
                tools: CLAUDE_TOOLS,
            });

            // Accumulate the response
            let assistantContent = '';
            let toolUseBlocks: Array<{
                id: string;
                name: string;
                input: Record<string, unknown>;
            }> = [];
            let firstTokenTime: number | null = null;

            // Process the stream
            for await (const event of stream) {
                // Log time to first token
                if (firstTokenTime === null && event.type === 'content_block_start') {
                    firstTokenTime = Date.now();
                    const ttft = firstTokenTime - apiCallStart;
                    console.log(`[TIMING] Model: claude-haiku-4-5 | Time to first token: ${ttft}ms`);
                }

                // Handle text content
                if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
                    assistantContent += event.delta.text;
                    send({ type: 'text', content: event.delta.text });
                }

                // Handle tool use blocks from final message
                if (event.type === 'message_stop') {
                    const finalMessage = await stream.finalMessage();
                    for (const block of finalMessage.content) {
                        if (block.type === 'tool_use') {
                            toolUseBlocks.push({
                                id: block.id,
                                name: block.name,
                                input: block.input as Record<string, unknown>,
                            });
                        }
                    }
                }
            }

            // If no tool calls, model decided to respond directly
            if (toolUseBlocks.length === 0) {
                logger.logDecision('direct_response');
                logger.logMiniTextGeneration(assistantContent.length);
                break;
            }

            // Log tool call decisions
            for (const tc of toolUseBlocks) {
                logger.logDecision('tool_call', tc.name);
                totalToolCalls++;
            }

            // Add assistant message with tool use to history
            const assistantMessage: ClaudeMessage = {
                role: 'assistant',
                content: (await stream.finalMessage()).content,
            };
            claudeMessages.push(assistantMessage);

            // Execute each tool call and collect results
            const toolResults: Array<{ type: 'tool_result'; tool_use_id: string; content: string }> = [];
            let hasCalledInterpretation = false;

            for (const toolUse of toolUseBlocks) {
                logger.logToolCall(toolUse.name, toolUse.input);

                send({
                    type: 'tool_call',
                    id: toolUse.id,
                    name: toolUse.name,
                    arguments: toolUse.input,
                });

                let toolResult: string;

                try {
                    switch (toolUse.name) {
                        case 'list_spreads': {
                            const result = executeListSpreads();
                            toolResult = JSON.stringify(result, null, 2);
                            logger.logToolResult('list_spreads', true, `${result.spreads.length} spreads`);
                            break;
                        }

                        case 'draw_cards': {
                            const args = toolUse.input as {
                                spread_slug?: string;
                                custom_positions?: string[];
                                question: string;
                            };
                            const result = await executeDrawCards(args);
                            if (result.success && result.reading && result.spreadWithCards) {
                                currentActiveSpread = result.spreadWithCards;

                                send({
                                    type: 'spread_laid',
                                    reading: result.reading,
                                    spreadWithCards: result.spreadWithCards,
                                });

                                toolResult = formatSpreadForAI(result.spreadWithCards);
                                logger.logToolResult('draw_cards', true, `${result.spreadWithCards.cards.length} cards drawn`);
                            } else {
                                toolResult = JSON.stringify({ error: result.error });
                                logger.logToolResult('draw_cards', false, result.error || 'Unknown error');
                            }
                            break;
                        }

                        case 'request_interpretation': {
                            // Prevent duplicate interpretation calls
                            if (hasCalledInterpretation) {
                                toolResult = 'Interpretation already provided.';
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
                                    messages: messages.slice(-20),
                                    spreadLedger: currentLedger,
                                    conversationSummary,
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

                                logger.logToolResult('request_interpretation', true, `${interpretation.length} chars from thinking`);

                                // THINKING TAKES OVER - End the turn completely
                                send({ type: 'done' });
                                logger.logSessionEnd(totalToolCalls, thinkingCalls);
                                close();
                                return;
                            }
                            break;
                        }

                        default:
                            toolResult = `Unknown tool: ${toolUse.name}`;
                            logger.logToolResult(toolUse.name, false, 'Unknown tool');
                    }
                } catch (error) {
                    toolResult = `Tool error: ${error instanceof Error ? error.message : 'Unknown error'}`;
                    logger.logError(`tool:${toolUse.name}`, error);
                }

                send({ type: 'tool_result', name: toolUse.name, result: toolResult });

                toolResults.push({
                    type: 'tool_result',
                    tool_use_id: toolUse.id,
                    content: toolResult,
                });
            }

            // Add tool results to conversation
            claudeMessages.push({
                role: 'user',
                content: toolResults,
            });
        }

        send({ type: 'done' });
        logger.logSessionEnd(totalToolCalls, thinkingCalls);
    } catch (error) {
        console.error('Chat processing error:', error);
        logger.logError('processChat', error);
        send({
            type: 'error',
            message: error instanceof Error ? error.message : 'Chat processing failed',
        });
    } finally {
        close();
    }
}
