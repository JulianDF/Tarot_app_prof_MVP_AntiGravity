'use client';

import { Spread } from '@/types';
import styles from './SpreadCard.module.css';

interface SpreadCardProps {
    spread: Spread;
    selected?: boolean;
    onClick?: () => void;
}

export function SpreadCard({ spread, selected = false, onClick }: SpreadCardProps) {
    return (
        <div
            className={`${styles.card} ${selected ? styles.cardSelected : ''}`}
            onClick={onClick}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && onClick?.()}
            aria-pressed={selected}
        >
            <div className={styles.cardHeader}>
                <h3 className={styles.cardName}>{spread.name}</h3>
                <span className={styles.cardBadge}>{spread.n_cards} cards</span>
            </div>

            <p className={styles.cardPurpose}>{spread.purpose}</p>

            <div className={styles.cardFooter}>
                <LayoutPreview descriptor={spread.layout_descriptor} />
            </div>
        </div>
    );
}

/**
 * Mini layout preview showing the spread shape
 */
function LayoutPreview({ descriptor }: { descriptor: string }) {
    const rows = descriptor.split('\n');

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            {rows.map((row, i) => (
                <div key={i} style={{ display: 'flex', gap: '2px' }}>
                    {row.split('').map((char, j) => (
                        <div
                            key={j}
                            style={{
                                width: '8px',
                                height: '12px',
                                borderRadius: '2px',
                                background: char === 'X'
                                    ? 'transparent'
                                    : 'var(--color-secondary)',
                                opacity: char === 'X' ? 0 : 0.6,
                            }}
                        />
                    ))}
                </div>
            ))}
        </div>
    );
}
