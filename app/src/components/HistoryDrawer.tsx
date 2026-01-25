'use client';

import React from 'react';

interface Session {
    id: string;
    date: string;
    name: string;
    summary: string;
}

// Mock data for past sessions
const MOCK_SESSIONS: Session[] = [
    {
        id: '1',
        date: '2026-01-21',
        name: 'Career Crossroads',
        summary: 'Explored a job change decision using the Celtic Cross spread.'
    },
    {
        id: '2',
        date: '2026-01-20',
        name: 'Relationship Clarity',
        summary: 'Three-card reading about communication in a partnership.'
    },
    {
        id: '3',
        date: '2026-01-18',
        name: 'Monthly Overview',
        summary: 'Diamond spread for January energy and focus areas.'
    },
    {
        id: '4',
        date: '2026-01-15',
        name: 'Creative Block',
        summary: 'Single card pull for breaking through artistic resistance.'
    },
    {
        id: '5',
        date: '2026-01-12',
        name: 'Financial Decision',
        summary: 'Past-Present-Future reading about an investment opportunity.'
    }
];

interface HistoryDrawerProps {
    isOpen: boolean;
    onClose: () => void;
    onSelectSession: (sessionId: string) => void;
    onSearchHistory: () => void;
}

export function HistoryDrawer({
    isOpen,
    onClose,
    onSelectSession,
    onSearchHistory,
}: HistoryDrawerProps) {
    if (!isOpen) return null;

    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    };

    return (
        <>
            {/* Backdrop */}
            <div style={styles.backdrop} onClick={onClose} />

            {/* Drawer */}
            <div style={styles.drawer}>
                <div style={styles.header}>
                    <h2 style={styles.title}>Past Sessions</h2>
                    <button onClick={onClose} style={styles.closeBtn}>✕</button>
                </div>

                <div style={styles.content}>
                    {MOCK_SESSIONS.map((session) => (
                        <button
                            key={session.id}
                            onClick={() => onSelectSession(session.id)}
                            style={styles.sessionCard}
                        >
                            <div style={styles.sessionHeader}>
                                <span style={styles.sessionName}>{session.name}</span>
                                <span style={styles.sessionDate}>{formatDate(session.date)}</span>
                            </div>
                            <p style={styles.sessionSummary}>{session.summary}</p>
                        </button>
                    ))}
                </div>

                <div style={styles.footer}>
                    <button onClick={onSearchHistory} style={styles.searchBtn}>
                        <SearchIcon />
                        Search History
                    </button>
                </div>
            </div>
        </>
    );
}

function SearchIcon() {
    return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
    );
}

const styles: Record<string, React.CSSProperties> = {
    backdrop: {
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        zIndex: 100,
    },
    drawer: {
        position: 'fixed',
        top: 0,
        right: 0,
        width: '300px',
        height: '100%',
        backgroundColor: '#1a1a2e',
        zIndex: 101,
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '-4px 0 20px rgba(0, 0, 0, 0.3)',
        animation: 'slideInRight 0.25s ease-out',
    },
    header: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '16px 20px',
        borderBottom: '1px solid #2a2a3e',
    },
    title: {
        fontSize: '18px',
        fontWeight: 600,
        color: '#e0e0e0',
        margin: 0,
    },
    closeBtn: {
        background: 'none',
        border: 'none',
        color: '#888',
        fontSize: '18px',
        cursor: 'pointer',
        padding: '4px',
    },
    content: {
        flex: 1,
        padding: '12px',
        overflowY: 'auto',
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
        backgroundColor: '#252538',
        border: '1px solid #2a2a3e',
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
    footer: {
        padding: '12px 16px',
        borderTop: '1px solid #2a2a3e',
    },
    searchBtn: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px',
        width: '100%',
        padding: '12px',
        backgroundColor: '#2a2a3e',
        border: '1px solid #3a3a4e',
        borderRadius: '10px',
        color: '#a0a0b0',
        fontSize: '14px',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
    },
};
