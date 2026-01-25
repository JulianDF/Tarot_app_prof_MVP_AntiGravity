'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { SpreadWithCards } from '@/types';

// Spread view states: collapsed = header only, compact = small spread, expanded = full spread
export type SpreadViewMode = 'collapsed' | 'compact' | 'expanded';

interface ChatUIContextType {
    // State
    spreadViewMode: SpreadViewMode;
    activeSpread: SpreadWithCards | null;
    spreadHistory: SpreadWithCards[];
    currentSpreadIndex: number;
    isTyping: boolean;
    showMockSpread: boolean;

    // Actions
    setSpreadViewMode: (mode: SpreadViewMode) => void;
    addSpread: (spread: SpreadWithCards) => void;
    navigateSpread: (direction: 'prev' | 'next') => void;
    setTypingMode: (isTyping: boolean) => void;
    contractMockSpread: () => void;
}

const ChatUIContext = createContext<ChatUIContextType | undefined>(undefined);

export function ChatUIProvider({ children }: { children: ReactNode }) {
    const [spreadHistory, setSpreadHistory] = useState<SpreadWithCards[]>([]);
    const [currentSpreadIndex, setCurrentSpreadIndex] = useState(-1);
    const [spreadViewMode, setSpreadViewMode] = useState<SpreadViewMode>('expanded');
    const [isTyping, setIsTyping] = useState(false);
    const [showMockSpread, setShowMockSpread] = useState(true);

    // Derive active spread from history and index
    const activeSpread = currentSpreadIndex >= 0 && currentSpreadIndex < spreadHistory.length
        ? spreadHistory[currentSpreadIndex]
        : null;

    // Contract mock spread when first message is sent (but keep it visible as placeholder)
    const contractMockSpread = useCallback(() => {
        if (showMockSpread && !activeSpread) {
            // Contract the mock spread (don't hide it yet)
            setSpreadViewMode('compact');
        }
    }, [showMockSpread, activeSpread]);

    // Add a new spread to history
    const addSpread = useCallback((spread: SpreadWithCards) => {
        setSpreadHistory(prev => [...prev, spread]);
        setCurrentSpreadIndex(prev => prev + 1);
        setSpreadViewMode('compact');
        setIsTyping(false);
        setShowMockSpread(false); // Hide mock when real spread is added
    }, []);

    // Navigate between spreads
    const navigateSpread = useCallback((direction: 'prev' | 'next') => {
        setCurrentSpreadIndex(prev => {
            if (direction === 'prev' && prev > 0) {
                return prev - 1;
            }
            if (direction === 'next' && prev < spreadHistory.length - 1) {
                return prev + 1;
            }
            return prev;
        });
    }, [spreadHistory.length]);

    // Auto-hide when no spreads and mock is turned off
    useEffect(() => {
        if (spreadHistory.length === 0 && !showMockSpread) {
            setSpreadViewMode('collapsed');
        }
    }, [spreadHistory.length, showMockSpread]);

    return (
        <ChatUIContext.Provider value={{
            spreadViewMode,
            activeSpread,
            spreadHistory,
            currentSpreadIndex,
            isTyping,
            showMockSpread,
            setSpreadViewMode,
            addSpread,
            navigateSpread,
            setTypingMode: setIsTyping,
            contractMockSpread,
        }}>
            {children}
        </ChatUIContext.Provider>
    );
}

export function useChatUI() {
    const context = useContext(ChatUIContext);
    if (context === undefined) {
        throw new Error('useChatUI must be used within a ChatUIProvider');
    }
    return context;
}
