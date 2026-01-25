'use client';

import React, { useState, useRef } from 'react';
import { useChatUI } from '@/contexts/ChatUIContext';
import { useChat } from '@/hooks/useChat';
import { SpreadViewer } from './SpreadViewer';
import { ChatPanel } from './ChatPanel';
import { MessageInput } from './MessageInput';
import { AppHeader } from '../AppHeader';
import { SettingsDrawer } from '../drawers/SettingsDrawer';
import { HistoryDrawer } from '../drawers/HistoryDrawer';

export function ChatLayout() {
    const { spreadViewMode, activeSpread, showMockSpread } = useChatUI();
    const { messages, isLoading, sendMessage, clearMessages } = useChat();

    // Container ref for drawer portals (ensures drawers render within app bounds)
    const containerRef = useRef<HTMLDivElement>(null);

    // Drawer states
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [isHistoryOpen, setIsHistoryOpen] = useState(false);

    // Settings states (with defaults)
    const [includeReversals, setIncludeReversals] = useState(true);
    const [allowDuplicates, setAllowDuplicates] = useState(false);

    // Calculate spread height based on view mode
    let spreadHeight = '44px'; // Default to header-only for collapsed mode
    let showSpread = false;

    // Show spread if: (mock spread is active) OR (there's an active spread)
    const hasVisibleSpread = (showMockSpread && !activeSpread) || activeSpread;

    if (hasVisibleSpread) {
        showSpread = true;
        if (spreadViewMode === 'expanded') {
            spreadHeight = '70vh'; // Large view for card inspection
        } else if (spreadViewMode === 'compact') {
            spreadHeight = '50%'; // Increased to fit card content without cropping
        } else {
            spreadHeight = '44px'; // Collapsed - header only
        }
    }

    // Handler functions
    const handleNewSession = () => {
        clearMessages();
        // TODO: Reset spread state when implemented
        alert('New session started! (placeholder)');
    };

    const handleOpenAccount = () => {
        alert('Account feature coming soon! (placeholder)');
    };

    const handleSelectSession = (sessionId: string) => {
        alert(`Loading session ${sessionId}... (placeholder)`);
        setIsHistoryOpen(false);
    };

    const handleSearchHistory = () => {
        alert('Search feature coming soon! (placeholder)');
    };

    return (
        <div ref={containerRef} style={styles.container}>
            {/* App Header */}
            <AppHeader
                onNewSession={handleNewSession}
                onOpenAccount={handleOpenAccount}
            />

            {/* Top Region: Spread Viewer with Elegant Frame */}
            <div style={{
                ...styles.spreadRegion,
                height: showSpread ? spreadHeight : '0px',
                position: 'relative',
                overflow: 'visible',
                zIndex: 20,
            }}>
                {showSpread && (
                    <div style={styles.spreadFrame}>
                        <div style={styles.spreadContent}>
                            <SpreadViewer />
                        </div>
                    </div>
                )}
            </div>

            {/* Settings Drawer (left side) */}
            <SettingsDrawer
                open={isSettingsOpen}
                onOpenChange={setIsSettingsOpen}
                container={containerRef.current}
            >
                <div style={styles.settingsContent}>
                    <h3 style={styles.sectionTitle}>Reading Options</h3>

                    {/* Include Reversals Toggle */}
                    <div style={styles.optionRow}>
                        <div style={styles.optionInfo}>
                            <span style={styles.optionLabel}>Include Reversals</span>
                            <span style={styles.optionDesc}>Cards may appear upside-down</span>
                        </div>
                        <button
                            onClick={() => setIncludeReversals(!includeReversals)}
                            style={{
                                ...styles.toggle,
                                backgroundColor: includeReversals ? '#6d28d9' : '#3a3a4e',
                            }}
                        >
                            <div style={{
                                ...styles.toggleKnob,
                                transform: includeReversals ? 'translateX(20px)' : 'translateX(0)',
                            }} />
                        </button>
                    </div>

                    {/* Allow Duplicates Toggle */}
                    <div style={styles.optionRow}>
                        <div style={styles.optionInfo}>
                            <span style={styles.optionLabel}>Allow Duplicates</span>
                            <span style={styles.optionDesc}>Same card can appear multiple times</span>
                        </div>
                        <button
                            onClick={() => setAllowDuplicates(!allowDuplicates)}
                            style={{
                                ...styles.toggle,
                                backgroundColor: allowDuplicates ? '#6d28d9' : '#3a3a4e',
                            }}
                        >
                            <div style={{
                                ...styles.toggleKnob,
                                transform: allowDuplicates ? 'translateX(20px)' : 'translateX(0)',
                            }} />
                        </button>
                    </div>

                    <p style={styles.footerText}>More settings coming soon</p>
                </div>
            </SettingsDrawer>

            {/* History Drawer (right side) */}
            <HistoryDrawer
                open={isHistoryOpen}
                onOpenChange={setIsHistoryOpen}
                container={containerRef.current}
            >
                <div style={styles.historyContent}>
                    {/* Mock sessions */}
                    {[
                        { id: '1', date: 'Jan 21', name: 'Career Crossroads', summary: 'Celtic Cross spread about job change.' },
                        { id: '2', date: 'Jan 20', name: 'Relationship Clarity', summary: 'Three-card reading about communication.' },
                        { id: '3', date: 'Jan 18', name: 'Monthly Overview', summary: 'Diamond spread for January.' },
                    ].map((session) => (
                        <button
                            key={session.id}
                            onClick={() => handleSelectSession(session.id)}
                            style={styles.sessionCard}
                        >
                            <div style={styles.sessionHeader}>
                                <span style={styles.sessionName}>{session.name}</span>
                                <span style={styles.sessionDate}>{session.date}</span>
                            </div>
                            <p style={styles.sessionSummary}>{session.summary}</p>
                        </button>
                    ))}

                    <button onClick={handleSearchHistory} style={styles.searchBtn}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="11" cy="11" r="8" />
                            <line x1="21" y1="21" x2="16.65" y2="16.65" />
                        </svg>
                        Search History
                    </button>
                </div>
            </HistoryDrawer>

            {/* Middle Region: Chat Panel */}
            <div style={styles.chatRegion}>
                <ChatPanel messages={messages} isLoading={isLoading} />
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
        position: 'relative',
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
        overflow: 'visible',
        flexShrink: 0,
    },
    spreadFrame: {
        width: '100%',
        height: '100%',
        position: 'relative',
        background: 'linear-gradient(180deg, rgba(35, 30, 55, 0.95) 0%, rgba(22, 22, 38, 0.98) 100%)',
        backdropFilter: 'blur(12px)',
        borderRadius: '0 0 12px 12px',
        border: '1px solid rgba(139, 92, 246, 0.25)',
        borderTop: 'none',
        boxShadow: '0 4px 24px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.05)',
    },
    spreadContent: {
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        borderRadius: '0 0 12px 12px',
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
    },
    // Settings content styles
    settingsContent: {
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
    },
    sectionTitle: {
        fontSize: '12px',
        fontWeight: 600,
        color: '#888',
        textTransform: 'uppercase',
        letterSpacing: '1px',
        marginBottom: '8px',
        margin: 0,
    },
    optionRow: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 0',
        borderBottom: '1px solid rgba(139, 92, 246, 0.15)',
    },
    optionInfo: {
        display: 'flex',
        flexDirection: 'column',
        gap: '2px',
    },
    optionLabel: {
        fontSize: '15px',
        color: '#e0e0e0',
    },
    optionDesc: {
        fontSize: '12px',
        color: '#888',
    },
    toggle: {
        width: '44px',
        height: '24px',
        borderRadius: '12px',
        border: 'none',
        cursor: 'pointer',
        position: 'relative',
        transition: 'background-color 0.2s ease',
        padding: 0,
    },
    toggleKnob: {
        position: 'absolute',
        top: '2px',
        left: '2px',
        width: '20px',
        height: '20px',
        borderRadius: '50%',
        backgroundColor: 'white',
        transition: 'transform 0.2s ease',
    },
    footerText: {
        fontSize: '12px',
        color: '#666',
        fontStyle: 'italic',
        marginTop: '16px',
    },
    // History content styles
    historyContent: {
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
    },
    sessionCard: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        textAlign: 'left',
        padding: '12px',
        backgroundColor: 'rgba(37, 37, 56, 0.8)',
        border: '1px solid rgba(139, 92, 246, 0.2)',
        borderRadius: '10px',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        width: '100%',
    },
    sessionHeader: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        width: '100%',
        marginBottom: '6px',
    },
    sessionName: {
        fontSize: '14px',
        fontWeight: 600,
        color: '#d4b7fa',
    },
    sessionDate: {
        fontSize: '11px',
        color: '#888',
    },
    sessionSummary: {
        fontSize: '12px',
        color: '#a0a0b0',
        lineHeight: 1.4,
        margin: 0,
    },
    searchBtn: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px',
        width: '100%',
        padding: '12px',
        marginTop: '8px',
        backgroundColor: 'rgba(42, 42, 62, 0.8)',
        border: '1px solid rgba(139, 92, 246, 0.2)',
        borderRadius: '10px',
        color: '#a0a0b0',
        fontSize: '14px',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
    },
};
