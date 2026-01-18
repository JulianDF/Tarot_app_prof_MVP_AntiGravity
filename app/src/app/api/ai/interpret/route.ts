/**
 * AI Interpretation API — One-shot reading interpretation
 */

import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { v4 as uuidv4 } from 'uuid';
import { InterpretRequest, InterpretResponse, AiInterpretationResult, AiDepth } from '@/types';
import { getAllCards } from '@/services/cardService';

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: NextRequest) {
    try {
        const body: InterpretRequest = await request.json();
        const { reading, depth = 'medium' } = body;

        if (!reading) {
            return NextResponse.json({ error: 'Reading is required' }, { status: 400 });
        }

        if (!process.env.OPENAI_API_KEY) {
            return NextResponse.json(
                { error: 'OpenAI API key not configured. Please add OPENAI_API_KEY to your environment.' },
                { status: 500 }
            );
        }

        const allCards = getAllCards();

        // Build the prompt
        const prompt = buildInterpretationPrompt(reading, allCards, depth);

        // Call OpenAI
        const response = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
                {
                    role: 'system',
                    content: getSystemPrompt(),
                },
                {
                    role: 'user',
                    content: prompt,
                },
            ],
            max_tokens: getMaxTokens(depth),
            temperature: 0.7,
        });

        const outputText = response.choices[0]?.message?.content || 'Unable to generate interpretation.';

        const interpretation: AiInterpretationResult = {
            id: uuidv4(),
            created_at: new Date().toISOString(),
            depth,
            prompt_version: 'mvp_v1',
            output_text: outputText,
            usage: {
                input_tokens: response.usage?.prompt_tokens,
                output_tokens: response.usage?.completion_tokens,
            },
        };

        const result: InterpretResponse = { interpretation };
        return NextResponse.json(result);
    } catch (error) {
        console.error('AI interpretation error:', error);

        if (error instanceof OpenAI.APIError) {
            return NextResponse.json(
                { error: `OpenAI API error: ${error.message}` },
                { status: error.status || 500 }
            );
        }

        return NextResponse.json(
            { error: 'Failed to generate interpretation' },
            { status: 500 }
        );
    }
}

function getSystemPrompt(): string {
    return `You are an expert Tarot reader with eons of experience and enormous amounts of knowledge and wisdom.

You're clear, sober, nuanced, wise and equipped with high emotional and spiritual intelligence.

Employ the highest level of expertise, skill and nuance to help the user to interpret Tarot spreads as a highly knowledgeable and experienced Tarot expert would.

You know that there's truth in the cards that can guide the user on their journey. It is of utmost personal importance to you to reveal this truth and share it with the user.

You don't hide anything you see.`;
}

function getMaxTokens(depth: AiDepth): number {
    switch (depth) {
        case 'short':
            return 500;
        case 'medium':
            return 1000;
        case 'deep':
            return 2000;
        default:
            return 1000;
    }
}

interface ReadingData {
    question: string;
    spread_snapshot: {
        name: string;
        purpose: string;
        positions: Array<{ index: number; meaning: string }>;
    };
    cards: Array<{ position_index: number; card_id: number; reversed: boolean }>;
}

interface CardData {
    id: number;
    name: string;
    meaning: string;
    meaning_reversed: string;
    keywords: string[];
    keywords_reversed: string[];
}

function buildInterpretationPrompt(
    reading: ReadingData,
    allCards: CardData[],
    depth: AiDepth
): string {
    const { question, spread_snapshot, cards } = reading;

    // Build card descriptions for each position
    const cardDescriptions = spread_snapshot.positions.map((position) => {
        const readingCard = cards.find(c => c.position_index === position.index);
        if (!readingCard) return null;

        const card = allCards.find(c => c.id === readingCard.card_id);
        if (!card) return null;

        const orientation = readingCard.reversed ? 'Reversed' : 'Upright';
        const meaning = readingCard.reversed ? card.meaning_reversed : card.meaning;
        const keywords = readingCard.reversed ? card.keywords_reversed : card.keywords;

        return `
Position ${position.index + 1}: ${position.meaning}
Card: ${card.name} (${orientation})
Keywords: ${keywords.join(', ')}
Meaning: ${meaning}`;
    }).filter(Boolean).join('\n');

    const depthInstruction = {
        short: 'Provide a brief, focused interpretation (2-3 paragraphs).',
        medium: 'Provide a thoughtful interpretation covering key themes and guidance (4-5 paragraphs).',
        deep: 'Provide an in-depth interpretation exploring each card\'s significance, their interconnections, and detailed guidance (6-8 paragraphs).',
    }[depth];

    return `
## Tarot Reading Request

**Question/Focus:** ${question}

**Spread:** ${spread_snapshot.name}
**Purpose:** ${spread_snapshot.purpose}

**Cards Drawn:**
${cardDescriptions}

---

${depthInstruction}

Consider how the cards interact with each other, what themes emerge, and what guidance they offer for the querent's question. Begin your interpretation:`;
}
