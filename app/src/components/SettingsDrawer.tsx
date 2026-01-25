'use client';

import React from 'react';

interface SettingsDrawerProps {
    isOpen: boolean;
    onClose: () => void;
    includeReversals: boolean;
    onToggleReversals: (value: boolean) => void;
    allowDuplicates: boolean;
    onToggleDuplicates: (value: boolean) => void;
}

export function SettingsDrawer({
    isOpen,
    onClose,
    includeReversals,
    onToggleReversals,
    allowDuplicates,
    onToggleDuplicates,
}: SettingsDrawerProps) {
    if (!isOpen) return null;

    return (
        <>
            {/* Backdrop */}
            <div style={styles.backdrop} onClick={onClose} />

            {/* Drawer */}
            <div style={styles.drawer}>
                <div style={styles.header}>
                    <h2 style={styles.title}>Settings</h2>
                    <button onClick={onClose} style={styles.closeBtn}>✕</button>
                </div>

                <div style={styles.content}>
                    <h3 style={styles.sectionTitle}>Reading Options</h3>

                    {/* Include Reversals Toggle */}
                    <div style={styles.optionRow}>
                        <div style={styles.optionInfo}>
                            <span style={styles.optionLabel}>Include Reversals</span>
                            <span style={styles.optionDesc}>Cards may appear upside-down</span>
                        </div>
                        <button
                            onClick={() => onToggleReversals(!includeReversals)}
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
                            onClick={() => onToggleDuplicates(!allowDuplicates)}
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
                </div>

                <div style={styles.footer}>
                    <span style={styles.footerText}>More settings coming soon</span>
                </div>
            </div>
        </>
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
        left: 0,
        width: '280px',
        height: '100%',
        backgroundColor: '#1a1a2e',
        zIndex: 101,
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '4px 0 20px rgba(0, 0, 0, 0.3)',
        animation: 'slideInLeft 0.25s ease-out',
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
        padding: '20px',
        overflowY: 'auto',
    },
    sectionTitle: {
        fontSize: '12px',
        fontWeight: 600,
        color: '#888',
        textTransform: 'uppercase',
        letterSpacing: '1px',
        marginBottom: '16px',
    },
    optionRow: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 0',
        borderBottom: '1px solid #2a2a3e',
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
    footer: {
        padding: '16px 20px',
        borderTop: '1px solid #2a2a3e',
    },
    footerText: {
        fontSize: '12px',
        color: '#666',
        fontStyle: 'italic',
    },
};
