/**
 * Card Service — Load and access tarot card data
 */

import { Card } from '@/types';
import cardsData from '../../cards.json';

// Cache the cards array
let cardsCache: Card[] | null = null;

/**
 * Get all 78 tarot cards
 */
export function getAllCards(): Card[] {
    if (!cardsCache) {
        cardsCache = cardsData.cards as Card[];
    }
    return cardsCache;
}

/**
 * Get a card by its ID (0-77)
 */
export function getCardById(id: number): Card | undefined {
    const cards = getAllCards();
    return cards.find(card => card.id === id);
}

/**
 * Get cards by arcana type
 */
export function getCardsByArcana(arcana: 'major' | 'minor'): Card[] {
    return getAllCards().filter(card => card.arcana === arcana);
}

/**
 * Get cards by suit (minor arcana only)
 */
export function getCardsBySuit(suit: 'wands' | 'cups' | 'swords' | 'pentacles'): Card[] {
    return getAllCards().filter(card => card.suit === suit);
}

/**
 * Get card metadata (from cards.json meta field)
 */
export function getCardsMeta(): typeof cardsData.meta {
    return cardsData.meta;
}
