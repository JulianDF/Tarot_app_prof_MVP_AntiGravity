'use client';

import React from 'react';

interface AppHeaderProps {
    onNewSession: () => void;
    onOpenAccount: () => void;
}

export function AppHeader({
    onNewSession,
    onOpenAccount,
}: AppHeaderProps) {
    return (
        <header style={styles.header}>
            {/* Left side: New Session */}
            <div style={styles.leftGroup}>
                <button
                    onClick={onNewSession}
                    style={styles.iconButton}
                    title="New Session"
                    aria-label="Start new session"
                >
                    <NewSessionIcon />
                </button>
            </div>

            {/* Center: App title (optional, can be logo) */}
            <div style={styles.center}>
                <span style={styles.title}>✨</span>
            </div>

            {/* Right side: Account */}
            <div style={styles.rightGroup}>
                <button
                    onClick={onOpenAccount}
                    style={styles.iconButton}
                    title="Account"
                    aria-label="Open account"
                >
                    <AccountIcon />
                </button>
            </div>
        </header>
    );
}

// Icon components
function NewSessionIcon() {
    return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 5v14M5 12h14" />
        </svg>
    );
}

function AccountIcon() {
    return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="8" r="4" />
            <path d="M4 20c0-4 4-6 8-6s8 2 8 6" />
        </svg>
    );
}

const styles: Record<string, React.CSSProperties> = {
    header: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '8px 12px',
        backgroundColor: '#1a1a2e',
        borderBottom: '1px solid #2a2a3e',
        height: '48px',
        flexShrink: 0,
    },
    leftGroup: {
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
    },
    center: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
    },
    title: {
        fontSize: '18px',
    },
    rightGroup: {
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
    },
    iconButton: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '36px',
        height: '36px',
        borderRadius: '8px',
        border: 'none',
        backgroundColor: 'transparent',
        color: '#a0a0b0',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
    },
};
