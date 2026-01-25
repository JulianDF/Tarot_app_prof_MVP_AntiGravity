/**
 * Thinking Model — Deep interpretation layer
 * 
 * Called by mini (via request_interpretation tool) when:
 * - A spread has been laid and needs interpretation
 * - Complex synthesis across multiple spreads is needed
 * 
 * Receives the SAME context as mini to ensure conversation continuity.
 * Once called, mini's turn ends and thinking streams directly to user.
 */

import OpenAI from 'openai';
import { SpreadWithCards, SpreadLedgerEntry } from '@/types';
import { formatSpreadForAI, formatLedgerForAI } from './tools';
import { THINKING_SYSTEM_PROMPT } from '@/prompts/thinking-system';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface InterpretationContext {
    activeSpread: SpreadWithCards;
    // Messages array - same as what mini receives
    messages: Array<{ role: 'user' | 'assistant'; content: string }>;
    spreadLedger?: SpreadLedgerEntry[];
    conversationSummary?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Thinking Model
// ─────────────────────────────────────────────────────────────────────────────

import { getOpenAIKey } from '@/lib/envHelper';

const openai = new OpenAI({
    apiKey: getOpenAIKey(),
});

/**
 * Build the system content for thinking model
 * Uses the SAME structure as mini's system content
 */
function buildThinkingSystemContent(context: InterpretationContext): string {
    const { activeSpread, spreadLedger, conversationSummary } = context;

    let systemContent = THINKING_SYSTEM_PROMPT;

    // Add conversation summary if present (compressed older messages)
    if (conversationSummary) {
        systemContent += '\n\n---\n\n## Summary of Earlier Conversation\n' + conversationSummary;
    }

    // Add active spread context (same as mini's formatSpreadForAI)
    systemContent += '\n\n---\n\n' + formatSpreadForAI(activeSpread);

    // Add spread ledger if present
    if (spreadLedger && spreadLedger.length > 0) {
        systemContent += '\n\n---\n\n' + formatLedgerForAI(spreadLedger);
    }

    return systemContent;
}

/**
 * Request interpretation from the thinking model
 * Returns an async generator that yields text chunks
 * 
 * Now receives the SAME context structure as mini for continuity.
 */
export async function* requestThinkingInterpretation(
    context: InterpretationContext
): AsyncGenerator<string, void, unknown> {
    const systemContent = buildThinkingSystemContent(context);

    // Build messages array - same format as mini
    // System message with all context, then conversation history
    const thinkingMessages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
        { role: 'system', content: systemContent },
        ...context.messages.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
    ];

    // Log context sent to thinking model
    const { logModelContext } = await import('@/lib/chatLogger');
    logModelContext('thinking', {
        systemPrompt: systemContent,
        messages: thinkingMessages,
        conversationSummary: context.conversationSummary,
        ledger: context.spreadLedger,
    });

    try {
        const apiCallStart = Date.now();

        // Log the FULL API call payload
        console.log(`\n[API CALL - THINKING]`);
        console.log(JSON.stringify({
            model: 'gpt-5.2',
            messages: thinkingMessages,
            max_completion_tokens: 2000,
            temperature: 0.7,
        }, null, 2));

        const stream = await openai.chat.completions.create({
            model: 'gpt-5.2',
            messages: thinkingMessages,
            stream: true,
            max_completion_tokens: 2000,
            temperature: 0.7,
        });

        let firstTokenLogged = false;
        for await (const chunk of stream) {
            if (!firstTokenLogged) {
                const ttft = Date.now() - apiCallStart;
                console.log(`[TIMING] Model: gpt-5.2 | Time to first token: ${ttft}ms`);
                firstTokenLogged = true;
            }
            const content = chunk.choices[0]?.delta?.content;
            if (content) {
                yield content;
            }
        }
    } catch (error) {
        console.error('Thinking model error:', error);

        // Fallback: provide a brief interpretation using the card data
        yield '\n\n*I sense some interference in my deeper connection, but let me share what I can see...*\n\n';

        for (const { position_index, card, reversed } of context.activeSpread.cards) {
            const position = context.activeSpread.spread.positions.find(p => p.index === position_index);
            const orientation = reversed ? 'Reversed' : 'Upright';
            const meaning = reversed ? card.meaning_reversed : card.meaning;
            yield `**${position?.meaning}:** ${card.name} (${orientation}) — ${meaning}\n\n`;
        }
    }
}
