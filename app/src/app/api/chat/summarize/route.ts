/**
 * Summarization API — Compresses older conversation history
 * 
 * Called client-side when messages exceed threshold.
 * Uses GPT 5.2 Thinking model for quality summarization.
 */

import { NextRequest } from 'next/server';
import { summarizeConversation } from '@/lib/summarization';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { messages, existingSummary, threshold, keepRecent } = body;

        if (!messages || !Array.isArray(messages)) {
            return new Response(
                JSON.stringify({ error: 'Messages array is required' }),
                { status: 400, headers: { 'Content-Type': 'application/json' } }
            );
        }

        const result = await summarizeConversation(
            messages,
            existingSummary || null,
            threshold || 20,
            keepRecent || 3
        );

        if (!result) {
            return new Response(
                JSON.stringify({ needsSummarization: false }),
                { status: 200, headers: { 'Content-Type': 'application/json' } }
            );
        }

        return new Response(
            JSON.stringify({
                needsSummarization: true,
                summary: result.summary,
                messagesRemoved: result.messagesRemoved,
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
    } catch (error) {
        console.error('Summarization API error:', error);
        return new Response(
            JSON.stringify({ error: 'Summarization failed' }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
    }
}
