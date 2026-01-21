/**
 * Conversation Summarization
 * 
 * Uses GPT 5.2 Thinking to compress older conversation history into a summary.
 * Triggered when messages exceed 20 turns.
 */

import OpenAI from 'openai';

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

const SUMMARIZATION_PROMPT = `You are summarizing a tarot reading conversation between a user and a tarot reader.

Create a concise summary (1-2 paragraphs) that captures:
1. The key questions or topics the user asked about
2. The spreads that were laid and their main themes
3. The essential insights and guidance that emerged
4. Any important emotional or spiritual context

The summary should allow someone to understand the conversation's arc without reading all the messages.
Be concise but don't omit anything that would be important for continuing the conversation.`;

export interface SummarizationResult {
    summary: string;
    messagesRemoved: number;
}

/**
 * Summarize older messages when conversation exceeds threshold
 * 
 * @param messages - Full message history
 * @param threshold - Number of messages to keep before summarizing (default 20)
 * @param keepRecent - Number of recent messages to preserve as breadcrumbs (default 3)
 * @returns Summary and count of removed messages, or null if no summarization needed
 */
export async function summarizeConversation(
    messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>,
    existingSummary: string | null,
    threshold: number = 20,
    keepRecent: number = 3
): Promise<SummarizationResult | null> {
    // Only summarize if we exceed threshold
    if (messages.length <= threshold) {
        return null;
    }

    // Messages to summarize: everything except the last 'keepRecent'
    const toSummarize = messages.slice(0, -keepRecent);

    // Build content to summarize
    let contentToSummarize = '';

    // Include existing summary if present
    if (existingSummary) {
        contentToSummarize += `## Previous Summary\n${existingSummary}\n\n`;
    }

    contentToSummarize += '## Conversation to Summarize\n';
    contentToSummarize += toSummarize.map(m => {
        const role = m.role === 'user' ? 'User' : m.role === 'assistant' ? 'Reader' : 'System';
        return `${role}: ${m.content}`;
    }).join('\n\n');

    try {
        const response = await openai.chat.completions.create({
            model: 'gpt-5.2',
            messages: [
                { role: 'system', content: SUMMARIZATION_PROMPT },
                { role: 'user', content: contentToSummarize }
            ],
            max_completion_tokens: 500,
            temperature: 0.5,
        });

        const summary = response.choices[0]?.message?.content || '';

        return {
            summary: summary.trim(),
            messagesRemoved: toSummarize.length,
        };
    } catch (error) {
        console.error('Summarization error:', error);
        // On error, return null (don't summarize)
        return null;
    }
}
