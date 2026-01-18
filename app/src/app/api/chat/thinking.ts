/**
 * Thinking Model Integration
 * 
 * Handles the handoff to the thinking model (GPT 5.2 Thinking) for deep
 * spread interpretation. The response is streamed back and integrated
 * into the mini model's output seamlessly.
 */

import OpenAI from 'openai';
import { THINKING_SYSTEM_PROMPT } from '@/prompts/thinking-system';
import { SpreadWithCards, SpreadLedgerEntry, Card } from '@/types';
import { formatLedgerForAI } from './tools';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface InterpretationContext {
    activeSpread: SpreadWithCards;
    conversationContext: string;
    spreadLedger?: SpreadLedgerEntry[];
    focusArea?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Thinking Model
// ─────────────────────────────────────────────────────────────────────────────

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Build the interpretation prompt for the thinking model
 */
function buildInterpretationPrompt(context: InterpretationContext): string {
    const { activeSpread, conversationContext, spreadLedger, focusArea } = context;

    const lines: string[] = [];

    // Question
    lines.push(`## Question`);
    lines.push(activeSpread.question);
    lines.push('');

    // Conversation context (recent exchanges)
    if (conversationContext) {
        lines.push(`## Recent Conversation`);
        lines.push(conversationContext);
        lines.push('');
    }

    // Spread information
    lines.push(`## Spread: ${activeSpread.spread.name}`);
    lines.push(`**Purpose:** ${activeSpread.spread.purpose}`);
    lines.push('');

    // Cards drawn with full details
    lines.push(`## Cards Drawn`);
    for (const { position_index, card, reversed } of activeSpread.cards) {
        const position = activeSpread.spread.positions.find(p => p.index === position_index);
        const orientation = reversed ? 'Reversed' : 'Upright';
        const meaning = reversed ? card.meaning_reversed : card.meaning;
        const keywords = reversed ? card.keywords_reversed : card.keywords;

        lines.push(`### Position ${position_index + 1}: ${position?.meaning}`);
        lines.push(`**Card:** ${card.name} (${orientation})`);
        lines.push(`**Keywords:** ${keywords.join(', ')}`);
        lines.push(`**Meaning:** ${meaning}`);
        lines.push('');
    }

    // Past spreads in session
    if (spreadLedger && spreadLedger.length > 0) {
        lines.push(formatLedgerForAI(spreadLedger));
    }

    // Focus area if specified
    if (focusArea) {
        lines.push(`## Focus Area`);
        lines.push(`Please pay special attention to: ${focusArea}`);
        lines.push('');
    }

    return lines.join('\n');
}

/**
 * Request interpretation from the thinking model
 * Returns an async generator that yields text chunks
 */
export async function* requestThinkingInterpretation(
    context: InterpretationContext
): AsyncGenerator<string, void, unknown> {
    const prompt = buildInterpretationPrompt(context);

    try {
        const stream = await openai.chat.completions.create({
            // Use the best available reasoning model
            // In production this would be gpt-5.2-thinking or similar
            model: 'gpt-4o',
            messages: [
                {
                    role: 'system',
                    content: THINKING_SYSTEM_PROMPT,
                },
                {
                    role: 'user',
                    content: prompt,
                },
            ],
            stream: true,
            max_tokens: 2000,
            temperature: 0.7,
        });

        for await (const chunk of stream) {
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
            const orientation = reversed ? 'reversed' : 'upright';
            const meaning = reversed ? card.meaning_reversed : card.meaning;

            yield `**${card.name}** in the position of "${position?.meaning}" (${orientation}): ${meaning}\n\n`;
        }

        yield `\nLet these cards guide your reflection on your question about ${context.activeSpread.question.toLowerCase()}.`;
    }
}

/**
 * Get full interpretation as a single string (non-streaming)
 * Used for error recovery or simple cases
 */
export async function getFullInterpretation(
    context: InterpretationContext
): Promise<string> {
    const chunks: string[] = [];

    for await (const chunk of requestThinkingInterpretation(context)) {
        chunks.push(chunk);
    }

    return chunks.join('');
}
