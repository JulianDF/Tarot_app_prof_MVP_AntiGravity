/**
 * Spread Service — Load and access spread templates
 */

import { Spread, SpreadSnapshot, SpreadType } from '@/types';
import spreadsData from '../../spreads.json';

// Type assertion for the JSON data
interface SpreadsJson {
    meta: {
        schema_version: string;
        language: string;
        generated_at: string;
        notes: string;
    };
    spreads: Record<string, Omit<Spread, 'id' | 'type'> & { type: SpreadType }>;
}

const typedSpreadsData = spreadsData as SpreadsJson;

// Cache the spreads array
let systemSpreadsCache: Spread[] | null = null;

/**
 * Get all system spreads
 */
export function getSystemSpreads(): Spread[] {
    if (!systemSpreadsCache) {
        systemSpreadsCache = Object.entries(typedSpreadsData.spreads).map(([, spread]) => {
            const { type: _type, ...rest } = spread;
            return {
                id: spread.slug, // For MVP, id equals slug
                type: 'system' as SpreadType,
                ...rest,
            };
        });
    }
    return systemSpreadsCache;
}

/**
 * Get a spread by its slug
 */
export function getSpreadBySlug(slug: string): Spread | undefined {
    return getSystemSpreads().find(spread => spread.slug === slug);
}

/**
 * Get a spread by its ID
 */
export function getSpreadById(id: string): Spread | undefined {
    return getSystemSpreads().find(spread => spread.id === id);
}

/**
 * Create a spread snapshot from a spread
 * Used when creating a reading to freeze the spread state
 */
export function createSpreadSnapshot(spread: Spread): SpreadSnapshot {
    return {
        name: spread.name,
        purpose: spread.purpose,
        n_cards: spread.n_cards,
        positions: [...spread.positions], // Shallow copy of positions
        layout_descriptor: spread.layout_descriptor,
        source: {
            type: spread.type,
            spread_id: spread.id,
            slug: spread.slug,
        },
    };
}

/**
 * Get spreads metadata
 */
export function getSpreadsMeta(): typeof typedSpreadsData.meta {
    return typedSpreadsData.meta;
}
