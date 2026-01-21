/**
 * Chat Tools — Tool definitions and execution for the chat API
 * 
 * Tools:
 * - list_spreads: Returns available spreads (ephemeral)
 * - draw_cards: Draws cards via RNG cascade
 * - request_interpretation: Invokes thinking model for deep interpretation
 */

import { v4 as uuidv4 } from 'uuid';
import { getSystemSpreads, createSpreadSnapshot, getSpreadBySlug } from '@/services/spreadService';
import { getAllCards, getCardById } from '@/services/cardService';
import {
    Reading,
    ReadingCard,
    SpreadWithCards,
    SpreadLedgerEntry,
    Card,
    RngProvenance
} from '@/types';

// ─────────────────────────────────────────────────────────────────────────────
// Tool Definitions (for OpenAI function calling)
// ─────────────────────────────────────────────────────────────────────────────

export const TOOL_DEFINITIONS = [
    {
        type: 'function' as const,
        function: {
            name: 'list_spreads',
            description: 'List available spreads with their purpose and position meanings. Use this to choose an appropriate spread for the user\'s question.',
            parameters: {
                type: 'object',
                properties: {},
                required: [],
            },
        },
    },
    {
        type: 'function' as const,
        function: {
            name: 'draw_cards',
            description: 'Lay a spread by drawing cards. For built-in spreads, provide spread_slug. For custom spreads, provide custom_positions array.',
            parameters: {
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
    },
    {
        type: 'function' as const,
        function: {
            name: 'request_interpretation',
            description: 'Hand off to deeper intelligence for interpretation or complex reasoning. Once called, thinking will respond directly to the user and your turn ends. Call this after laying a spread, or when the user asks a complex question that benefits from deeper analysis.',
            parameters: {
                type: 'object',
                properties: {},
                required: [],
            },
        },
    },
];

// ─────────────────────────────────────────────────────────────────────────────
// Tool Execution
// ─────────────────────────────────────────────────────────────────────────────

export interface ToolExecutionContext {
    activeSpread?: SpreadWithCards;
    spreadLedger?: SpreadLedgerEntry[];
    conversationContext?: string;
}

export interface ListSpreadsResult {
    spreads: Array<{
        slug: string;
        name: string;
        purpose: string;
        n_cards: number;
        positions: Array<{ index: number; meaning: string }>;
    }>;
}

export interface DrawCardsResult {
    success: boolean;
    reading?: Reading;
    spreadWithCards?: SpreadWithCards;
    error?: string;
}

/**
 * Execute list_spreads tool
 * Returns available spreads with their purpose and positions
 */
export function executeListSpreads(): ListSpreadsResult {
    const systemSpreads = getSystemSpreads();

    return {
        spreads: systemSpreads.map(spread => ({
            slug: spread.slug,
            name: spread.name,
            purpose: spread.purpose,
            n_cards: spread.n_cards,
            positions: spread.positions,
        })),
    };
}

/**
 * Execute draw_cards tool
 * Draws cards via RNG cascade and creates a reading
 */
export async function executeDrawCards(args: {
    spread_slug?: string;
    custom_positions?: string[];
    question: string;
}): Promise<DrawCardsResult> {
    const { spread_slug, custom_positions, question } = args;

    // Determine spread to use
    let spreadName: string;
    let spreadPurpose: string;
    let positions: Array<{ index: number; meaning: string }>;
    let layoutDescriptor: string;
    let spreadId: string;

    if (spread_slug) {
        // Use built-in spread
        const spread = getSpreadBySlug(spread_slug);
        if (!spread) {
            return {
                success: false,
                error: `Unknown spread: ${spread_slug}. Available spreads: ${getSystemSpreads().map(s => s.slug).join(', ')}`
            };
        }
        spreadName = spread.name;
        spreadPurpose = spread.purpose;
        positions = spread.positions;
        layoutDescriptor = spread.layout_descriptor;
        spreadId = spread.id;
    } else if (custom_positions && custom_positions.length > 0) {
        // Create custom spread
        spreadName = 'Custom Spread';
        spreadPurpose = 'A custom spread created for this reading';
        positions = custom_positions.map((meaning, index) => ({ index, meaning }));
        layoutDescriptor = positions.map((_, i) => i + 1).join(' '); // Simple row layout
        spreadId = 'custom_' + uuidv4();
    } else {
        return {
            success: false,
            error: 'Must provide either spread_slug or custom_positions'
        };
    }

    const nCards = positions.length;

    try {
        // Draw cards via RNG API
        const drawResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/rng/draw`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                n: nCards,
                allowDuplicates: false,
                allowReversals: true,
            }),
        });

        if (!drawResponse.ok) {
            throw new Error(`RNG API error: ${drawResponse.status}`);
        }

        const { draws, provenance } = await drawResponse.json() as {
            draws: Array<{ cardId: number; reversed: boolean }>;
            provenance: RngProvenance;
        };

        // Build reading cards
        const readingCards: ReadingCard[] = draws.map((draw, index) => ({
            position_index: index,
            card_id: draw.cardId,
            reversed: draw.reversed,
        }));

        // Create reading object
        const readingId = uuidv4();
        const reading: Reading = {
            id: readingId,
            created_at: new Date().toISOString(),
            spread_id: spreadId,
            spread_snapshot: {
                name: spreadName,
                purpose: spreadPurpose,
                n_cards: nCards,
                positions,
                layout_descriptor: layoutDescriptor,
                source: {
                    type: spread_slug ? 'system' : 'custom',
                    spread_id: spreadId,
                    slug: spread_slug,
                },
            },
            question,
            allow_duplicates: false,
            allow_reversals: true,
            cards: readingCards,
            rng: provenance,
        };

        // Build SpreadWithCards for context
        const allCards = getAllCards();
        const spreadWithCards: SpreadWithCards = {
            reading_id: readingId,
            question,
            spread: reading.spread_snapshot,
            cards: readingCards.map(rc => ({
                position_index: rc.position_index,
                card: allCards.find(c => c.id === rc.card_id) as Card,
                reversed: rc.reversed,
            })),
        };

        return {
            success: true,
            reading,
            spreadWithCards,
        };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to draw cards',
        };
    }
}

/**
 * Format a spread with cards for the AI context
 */
export function formatSpreadForAI(spreadWithCards: SpreadWithCards): string {
    const lines: string[] = [
        `## Current Spread: ${spreadWithCards.spread.name}`,
        `**Question:** ${spreadWithCards.question}`,
        `**Purpose:** ${spreadWithCards.spread.purpose}`,
        '',
        '**Cards drawn:**',
    ];

    for (const { position_index, card, reversed } of spreadWithCards.cards) {
        const position = spreadWithCards.spread.positions.find(p => p.index === position_index);
        const orientation = reversed ? 'Reversed' : 'Upright';
        const keywords = reversed ? card.keywords_reversed : card.keywords;

        lines.push(
            `- Position ${position_index + 1} (${position?.meaning}): **${card.name}** (${orientation})`,
            `  Keywords: ${keywords.join(', ')}`
        );
    }

    return lines.join('\n');
}

/**
 * Format spread ledger for AI context
 */
export function formatLedgerForAI(ledger: SpreadLedgerEntry[]): string {
    if (!ledger || ledger.length === 0) {
        return '';
    }

    const lines = ['## Previous Spreads in This Session', ''];

    for (const entry of ledger) {
        lines.push(
            `- **${entry.spread_name}** (${entry.created_at})`,
            `  Question: ${entry.question_summary}`,
            `  Cards: ${entry.cards_summary}`,
            ''
        );
    }

    return lines.join('\n');
}

/**
 * Create a ledger entry from a reading
 */
export function createLedgerEntry(reading: Reading, allCards: Card[]): SpreadLedgerEntry {
    const cardsSummary = reading.cards
        .map(rc => {
            const card = allCards.find(c => c.id === rc.card_id);
            const name = card?.name || `Card ${rc.card_id}`;
            return rc.reversed ? `${name} (R)` : name;
        })
        .join(', ');

    return {
        reading_id: reading.id,
        question_summary: reading.question.length > 100
            ? reading.question.substring(0, 97) + '...'
            : reading.question,
        spread_name: reading.spread_snapshot.name,
        cards_summary: cardsSummary,
        created_at: reading.created_at,
    };
}
