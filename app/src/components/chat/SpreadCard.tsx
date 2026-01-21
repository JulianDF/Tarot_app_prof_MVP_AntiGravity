'use client';

import React from 'react';
import Image from 'next/image';
import { Card } from '@/types';

interface SpreadCardProps {
    card: Card;
    positionIndex: number;
    isReversed: boolean;
    isCompact?: boolean;
    onClick?: () => void;
}

export function SpreadCard({ card, isReversed, isCompact = false, onClick }: SpreadCardProps) {
    return (
        <div
            onClick={onClick}
            style={{
                width: '100%',
                height: '100%',
                transform: isReversed ? 'rotate(180deg)' : 'none',
                transition: 'transform 0.3s ease',
            }}
        >
            <div style={{
                width: '100%',
                height: '100%',
                borderRadius: isCompact ? '4px' : '8px',
                overflow: 'hidden',
                boxShadow: '0 2px 8px rgba(0,0,0,0.5)',
                border: '1px solid #444',
                backgroundColor: '#1a1a2e',
                position: 'relative',
            }}>
                {card.image ? (
                    <Image
                        src={card.image}
                        alt={card.name}
                        fill
                        sizes={isCompact ? "80px" : "150px"}
                        style={{ objectFit: 'cover' }}
                    />
                ) : (
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        height: '100%',
                        fontSize: isCompact ? '8px' : '12px',
                        color: '#aaa',
                        textAlign: 'center',
                        padding: '4px',
                    }}>
                        {card.name}
                    </div>
                )}
            </div>
        </div>
    );
}
