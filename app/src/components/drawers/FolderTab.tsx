'use client';

import React from 'react';

interface FolderTabProps {
    side: 'left' | 'right';
    icon: React.ReactNode;
    onClick: () => void;
    ariaLabel: string;
}

/**
 * FolderTab - A button styled as a folder tab that peeks from the screen edge
 * Uses CSS border-radius for the tab shape instead of SVG paths
 */
export function FolderTab({ side, icon, onClick, ariaLabel }: FolderTabProps) {
    return (
        <button
            className={`folder-tab folder-tab--${side}`}
            onClick={onClick}
            aria-label={ariaLabel}
        >
            {icon}
        </button>
    );
}

export default FolderTab;
