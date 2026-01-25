'use client';

import React from 'react';
import { Drawer } from 'vaul';
import { FolderTab } from './FolderTab';

interface HistoryDrawerProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    children: React.ReactNode;
    container?: HTMLElement | null;
}

/**
 * HistoryDrawer - Right side drawer for past sessions
 * Uses Vaul for smooth animations and gesture support
 * Accepts optional container prop for portal targeting (needed for phone emulator)
 */
export function HistoryDrawer({ open, onOpenChange, children, container }: HistoryDrawerProps) {
    const HistoryIcon = (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
        </svg>
    );

    return (
        <>
            {/* Folder Tab Trigger - always visible when drawer is closed */}
            {!open && (
                <FolderTab
                    side="right"
                    icon={HistoryIcon}
                    onClick={() => onOpenChange(true)}
                    ariaLabel="Open History"
                />
            )}

            <Drawer.Root
                open={open}
                onOpenChange={onOpenChange}
                direction="right"
            >
                <Drawer.Portal container={container}>
                    <Drawer.Overlay className="drawer-overlay" />
                    <Drawer.Content className="drawer-content drawer-content--right">
                        <div className="drawer-header">
                            <Drawer.Title className="drawer-title">Past Sessions</Drawer.Title>
                            <button
                                className="drawer-close"
                                onClick={() => onOpenChange(false)}
                                aria-label="Close History"
                            >
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <line x1="18" y1="6" x2="6" y2="18" />
                                    <line x1="6" y1="6" x2="18" y2="18" />
                                </svg>
                            </button>
                        </div>
                        <div className="drawer-body">
                            {children}
                        </div>
                    </Drawer.Content>
                </Drawer.Portal>
            </Drawer.Root>
        </>
    );
}

export default HistoryDrawer;
