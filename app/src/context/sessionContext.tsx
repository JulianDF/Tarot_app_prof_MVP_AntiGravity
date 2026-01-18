'use client';

/**
 * Session Context — Manages in-memory session state for MVP
 * 
 * This context holds:
 * - System spreads (loaded from spreads.json)
 * - Multiple readings per session
 * - Active reading tracking
 */

import React, { createContext, useContext, useReducer, useCallback, ReactNode } from 'react';
import { v4 as uuidv4 } from 'uuid';
import {
    SessionState,
    Reading,
    Spread,
    SpreadSnapshot,
    ReadingCard,
    RngProvenance,
    AiInterpretationResult,
} from '@/types';

// ─────────────────────────────────────────────────────────────────────────────
// Session Actions
// ─────────────────────────────────────────────────────────────────────────────

type SessionAction =
    | { type: 'INIT_SESSION'; spreads: Spread[] }
    | { type: 'CREATE_READING'; reading: Reading }
    | { type: 'SET_ACTIVE_READING'; readingId: string }
    | { type: 'ADD_CARDS_TO_READING'; readingId: string; cards: ReadingCard[]; rng: RngProvenance }
    | { type: 'ADD_INTERPRETATION'; readingId: string; interpretation: AiInterpretationResult }
    | { type: 'UPDATE_NOTES'; readingId: string; notes: { general?: string; by_position?: Record<number, string> } };

// ─────────────────────────────────────────────────────────────────────────────
// Initial State
// ─────────────────────────────────────────────────────────────────────────────

const createInitialState = (): SessionState => ({
    session_id: uuidv4(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    spreads: { system: [], custom: [] },
    readings: [],
    active_reading_id: undefined,
});

// ─────────────────────────────────────────────────────────────────────────────
// Reducer
// ─────────────────────────────────────────────────────────────────────────────

function sessionReducer(state: SessionState, action: SessionAction): SessionState {
    const now = new Date().toISOString();

    switch (action.type) {
        case 'INIT_SESSION':
            return {
                ...state,
                spreads: { ...state.spreads, system: action.spreads },
                updated_at: now,
            };

        case 'CREATE_READING':
            return {
                ...state,
                readings: [...state.readings, action.reading],
                active_reading_id: action.reading.id,
                updated_at: now,
            };

        case 'SET_ACTIVE_READING':
            return {
                ...state,
                active_reading_id: action.readingId,
                updated_at: now,
            };

        case 'ADD_CARDS_TO_READING':
            return {
                ...state,
                readings: state.readings.map(r =>
                    r.id === action.readingId
                        ? { ...r, cards: action.cards, rng: action.rng }
                        : r
                ),
                updated_at: now,
            };

        case 'ADD_INTERPRETATION':
            return {
                ...state,
                readings: state.readings.map(r =>
                    r.id === action.readingId
                        ? { ...r, ai: { ...r.ai, one_shot: action.interpretation } }
                        : r
                ),
                updated_at: now,
            };

        case 'UPDATE_NOTES':
            return {
                ...state,
                readings: state.readings.map(r =>
                    r.id === action.readingId
                        ? { ...r, notes: { ...r.notes, ...action.notes } }
                        : r
                ),
                updated_at: now,
            };

        default:
            return state;
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Context
// ─────────────────────────────────────────────────────────────────────────────

interface SessionContextValue {
    state: SessionState;
    // Actions
    initSession: (spreads: Spread[]) => void;
    createReading: (spread: Spread, spreadSnapshot: SpreadSnapshot, question: string, options?: { allowDuplicates?: boolean; allowReversals?: boolean }) => Reading;
    setActiveReading: (readingId: string) => void;
    addCardsToReading: (readingId: string, cards: ReadingCard[], rng: RngProvenance) => void;
    addInterpretation: (readingId: string, interpretation: AiInterpretationResult) => void;
    // Selectors
    getActiveReading: () => Reading | undefined;
    getReadingById: (id: string) => Reading | undefined;
}

const SessionContext = createContext<SessionContextValue | null>(null);

// ─────────────────────────────────────────────────────────────────────────────
// Provider
// ─────────────────────────────────────────────────────────────────────────────

export function SessionProvider({ children }: { children: ReactNode }) {
    const [state, dispatch] = useReducer(sessionReducer, null, createInitialState);

    const initSession = useCallback((spreads: Spread[]) => {
        dispatch({ type: 'INIT_SESSION', spreads });
    }, []);

    const createReading = useCallback((
        spread: Spread,
        spreadSnapshot: SpreadSnapshot,
        question: string,
        options: { allowDuplicates?: boolean; allowReversals?: boolean } = {}
    ): Reading => {
        const reading: Reading = {
            id: uuidv4(),
            created_at: new Date().toISOString(),
            spread_id: spread.id,
            spread_snapshot: spreadSnapshot,
            question,
            allow_duplicates: options.allowDuplicates ?? false,
            allow_reversals: options.allowReversals ?? true,
            cards: [],
            rng: { method_used: 'qrng', attempts: [] },
        };
        dispatch({ type: 'CREATE_READING', reading });
        return reading;
    }, []);

    const setActiveReading = useCallback((readingId: string) => {
        dispatch({ type: 'SET_ACTIVE_READING', readingId });
    }, []);

    const addCardsToReading = useCallback((readingId: string, cards: ReadingCard[], rng: RngProvenance) => {
        dispatch({ type: 'ADD_CARDS_TO_READING', readingId, cards, rng });
    }, []);

    const addInterpretation = useCallback((readingId: string, interpretation: AiInterpretationResult) => {
        dispatch({ type: 'ADD_INTERPRETATION', readingId, interpretation });
    }, []);

    const getActiveReading = useCallback(() => {
        return state.readings.find(r => r.id === state.active_reading_id);
    }, [state.readings, state.active_reading_id]);

    const getReadingById = useCallback((id: string) => {
        return state.readings.find(r => r.id === id);
    }, [state.readings]);

    const value: SessionContextValue = {
        state,
        initSession,
        createReading,
        setActiveReading,
        addCardsToReading,
        addInterpretation,
        getActiveReading,
        getReadingById,
    };

    return (
        <SessionContext.Provider value={value}>
            {children}
        </SessionContext.Provider>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────────────────────

export function useSession() {
    const context = useContext(SessionContext);
    if (!context) {
        throw new Error('useSession must be used within a SessionProvider');
    }
    return context;
}
