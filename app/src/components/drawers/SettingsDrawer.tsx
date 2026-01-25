'use client';

import React from 'react';
import { Drawer } from 'vaul';
import { FolderTab } from './FolderTab';

interface SettingsDrawerProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    children: React.ReactNode;
    container?: HTMLElement | null;
}

/**
 * SettingsDrawer - Left side drawer for app settings
 * Uses Vaul for smooth animations and gesture support
 * Accepts optional container prop for portal targeting (needed for phone emulator)
 */
export function SettingsDrawer({ open, onOpenChange, children, container }: SettingsDrawerProps) {
    const SettingsIcon = (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="4" y1="6" x2="20" y2="6" />
            <line x1="4" y1="12" x2="20" y2="12" />
            <line x1="4" y1="18" x2="20" y2="18" />
        </svg>
    );

    return (
        <>
            {/* Folder Tab Trigger - always visible when drawer is closed */}
            {!open && (
                <FolderTab
                    side="left"
                    icon={SettingsIcon}
                    onClick={() => onOpenChange(true)}
                    ariaLabel="Open Settings"
                />
            )}

            <Drawer.Root
                open={open}
                onOpenChange={onOpenChange}
                direction="left"
            >
                <Drawer.Portal container={container}>
                    <Drawer.Overlay className="drawer-overlay" />
                    <Drawer.Content className="drawer-content drawer-content--left">
                        <div className="drawer-header">
                            <Drawer.Title className="drawer-title">Settings</Drawer.Title>
                            <button
                                className="drawer-close"
                                onClick={() => onOpenChange(false)}
                                aria-label="Close Settings"
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

export default SettingsDrawer;
