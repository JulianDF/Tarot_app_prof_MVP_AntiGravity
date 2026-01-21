'use client';

import React from 'react';
import { useChatUI } from '@/contexts/ChatUIContext';
import { useChat } from '@/hooks/useChat';
import { SpreadViewer } from './SpreadViewer';
import { ChatPanel } from './ChatPanel';
import { MessageInput } from './MessageInput';
import { SpreadFAB } from './SpreadFAB';

export function ChatLayout() {
    const { spreadViewMode, activeSpread, showMockSpread } = useChatUI();
    const { messages, isLoading, sendMessage } = useChat();

    // Calculate spread height based on view mode
    let spreadHeight = '0px';
    let showSpread = false;

    // Show spread if: (mock spread is active) OR (there's an active spread and not hidden)
    const hasVisibleSpread = (showMockSpread && !activeSpread) || (activeSpread && spreadViewMode !== 'hidden');

    if (hasVisibleSpread) {
        showSpread = true;
        if (spreadViewMode === 'expanded') {
            spreadHeight = '70vh'; // Large view for card inspection
        } else {
            spreadHeight = '40%'; // Compact pinned view - needs room for multi-row spreads
        }
    }

    return (
        <div style={styles.container}>
            {/* Top Region: Spread Viewer */}
            {showSpread && (
                <div style={{
                    ...styles.spreadRegion,
                    height: spreadHeight,
                }}>
                    <SpreadViewer />
                </div>
            )}

            {/* Middle Region: Chat Panel */}
            <div style={styles.chatRegion}>
                <ChatPanel messages={messages} isLoading={isLoading} />

                {/* FAB (only when spread is hidden) */}
                {activeSpread && spreadViewMode === 'hidden' && (
                    <SpreadFAB />
                )}
            </div>

            {/* Bottom Region: Input */}
            <div style={styles.inputRegion}>
                <MessageInput onSend={sendMessage} isLoading={isLoading} />
            </div>
        </div>
    );
}

const styles: Record<string, React.CSSProperties> = {
    container: {
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        width: '100%',
        overflow: 'hidden',
        backgroundColor: '#0f0f1a',
        color: '#e0e0e0',
    },
    spreadRegion: {
        transition: 'height 0.3s ease-in-out',
        width: '100%',
        overflow: 'hidden',
        flexShrink: 0,
    },
    chatRegion: {
        flex: 1,
        position: 'relative',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
    },
    inputRegion: {
        width: '100%',
        backgroundColor: '#1a1a2e',
        borderTop: '1px solid #2a2a3a',
        flexShrink: 0,
    }
};
