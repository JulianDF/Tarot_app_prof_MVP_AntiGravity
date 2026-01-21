'use client';

import { useChatUI } from '@/contexts/ChatUIContext';

/**
 * Mini diamond spread icon component
 * Renders a tiny visual representation of the diamond spread layout
 */
function DiamondSpreadIcon() {
    const cardStyle = {
        width: '6px',
        height: '9px',
        backgroundColor: '#d4b7fa',
        borderRadius: '1px',
        border: '0.5px solid rgba(255,255,255,0.3)',
    };

    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '2px',
        }}>
            {/* Top card */}
            <div style={cardStyle} />
            {/* Middle row - 3 cards */}
            <div style={{ display: 'flex', gap: '2px' }}>
                <div style={cardStyle} />
                <div style={cardStyle} />
                <div style={cardStyle} />
            </div>
            {/* Bottom card */}
            <div style={cardStyle} />
        </div>
    );
}

export function SpreadFAB() {
    const { setSpreadViewMode } = useChatUI();

    return (
        <button
            onClick={() => setSpreadViewMode('compact')}
            style={{
                position: 'absolute',
                top: '16px',
                right: '16px',
                width: '52px',
                height: '52px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #6d28d9 0%, #4c1d95 100%)',
                color: 'white',
                border: '1px solid rgba(255,255,255,0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
                cursor: 'pointer',
                zIndex: 50,
            }}
            aria-label="Show spread"
        >
            <DiamondSpreadIcon />
        </button>
    );
}
