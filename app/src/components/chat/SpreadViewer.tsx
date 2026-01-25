'use client';

import React, { useMemo, useState, useRef, useEffect } from 'react';
import { useChatUI } from '@/contexts/ChatUIContext';
import { SpreadCard } from './SpreadCard';
import { parseLayoutDescriptor, getGridDimensions } from '@/lib/layoutParser';
import { SpreadWithCards, Card } from '@/types';
import Image from 'next/image';

// Mock card for placeholders (satisfies Card interface)
const createMockCard = (id: number): Card => ({
    id,
    name: '?',
    arcana: 'major',
    suit: null,
    rank: null,
    keywords: [],
    meaning: '',
    keywords_reversed: [],
    meaning_reversed: '',
    image: '',
});

// Mock spread for the initial state (Diamond layout - 5 cards)
const MOCK_SPREAD: SpreadWithCards = {
    reading_id: 'mock-reading',
    question: '',
    spread: {
        name: 'Your Reading',
        purpose: 'Awaiting your question...',
        n_cards: 5,
        layout_descriptor: 'X1X\n234\nX5X',
        positions: [
            { index: 0, meaning: 'Focus' },
            { index: 1, meaning: 'Internal' },
            { index: 2, meaning: 'Present' },
            { index: 3, meaning: 'External' },
            { index: 4, meaning: 'Outcome' },
        ],
        source: { type: 'system', spread_id: 'mock_spread', slug: 'mock_spread' },
    },
    cards: [
        { position_index: 0, card: createMockCard(0), reversed: false },
        { position_index: 1, card: createMockCard(1), reversed: false },
        { position_index: 2, card: createMockCard(2), reversed: false },
        { position_index: 3, card: createMockCard(3), reversed: false },
        { position_index: 4, card: createMockCard(4), reversed: false },
    ],
};

export function SpreadViewer() {
    const {
        activeSpread,
        spreadViewMode,
        setSpreadViewMode,
        spreadHistory,
        currentSpreadIndex,
        navigateSpread,
        showMockSpread,
    } = useChatUI();
    const [selectedCardIndex, setSelectedCardIndex] = useState<number | null>(null);
    const gridRef = useRef<HTMLDivElement>(null);
    const [cardSize, setCardSize] = useState({ width: 80, height: 120 });
    const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });

    const isExpanded = spreadViewMode === 'expanded';
    const isCollapsed = spreadViewMode === 'collapsed';

    // Use mock spread when showMockSpread is true and there's no active spread
    const displaySpread = showMockSpread && !activeSpread ? MOCK_SPREAD : activeSpread;
    const isMockMode = showMockSpread && !activeSpread;

    // Parse grid layout
    const gridLayout = useMemo(() => {
        if (!displaySpread) return null;
        return parseLayoutDescriptor(displaySpread.spread.layout_descriptor);
    }, [displaySpread]);

    // Calculate grid dimensions
    const dimensions = useMemo(() => {
        if (!gridLayout) return { rows: 0, cols: 0 };
        return getGridDimensions(gridLayout);
    }, [gridLayout]);

    // Use a callback ref to reliably attach the ResizeObserver whenever the DOM node exists
    const resizeObserverRef = useRef<ResizeObserver | null>(null);

    const setGridRef = React.useCallback((node: HTMLDivElement | null) => {
        // Update the ref expectation
        (gridRef as React.MutableRefObject<HTMLDivElement | null>).current = node;

        // Cleanup previous observer
        if (resizeObserverRef.current) {
            resizeObserverRef.current.disconnect();
            resizeObserverRef.current = null;
        }

        // Attach new observer if node exists
        if (node) {
            const observer = new ResizeObserver((entries) => {
                for (const entry of entries) {
                    const rect = entry.contentRect; // use contentRect for ResizeObserver
                    if (rect.width > 0 && rect.height > 0) {
                        setContainerSize({
                            width: rect.width,
                            height: rect.height
                        });
                    }
                }
            });
            observer.observe(node);
            resizeObserverRef.current = observer;

            // Initial measure
            const rect = node.getBoundingClientRect();
            if (rect.width > 0 && rect.height > 0) {
                setContainerSize({ width: rect.width, height: rect.height });
            }
        }
    }, [spreadViewMode]); // Re-attach if view mode changes (just in case structure shifts)

    // Calculate card size
    React.useLayoutEffect(() => {
        if (!containerSize.width || !containerSize.height || !dimensions.rows || !dimensions.cols) return;

        const gap = isExpanded ? 10 : 6;
        const cardAspect = 1.5;
        const verticalBuffer = 85; // Increased safety margin to prevent bottom overflow/cropping
        const horizontalBuffer = 16;

        const availableWidth = containerSize.width - horizontalBuffer;
        const availableHeight = containerSize.height - verticalBuffer;

        const maxCardWidth = (availableWidth - (dimensions.cols - 1) * gap) / dimensions.cols;
        const maxCardHeight = (availableHeight - (dimensions.rows - 1) * gap) / dimensions.rows;

        let finalWidth = maxCardWidth;
        let finalHeight = finalWidth * cardAspect;

        if (finalHeight > maxCardHeight) {
            finalHeight = maxCardHeight;
            finalWidth = finalHeight / cardAspect;
        }

        finalWidth = Math.max(40, finalWidth);
        finalHeight = Math.max(60, finalHeight);

        setCardSize({ width: Math.floor(finalWidth), height: Math.floor(finalHeight) });
    }, [containerSize, dimensions, isExpanded]);

    // If nothing to show
    if (!displaySpread || !gridLayout) {
        return (
            <div style={styles.emptyContainer}>
                <p style={styles.emptyText}>Start a reading to see the spread</p>
            </div>
        );
    }

    const handleSpreadClick = () => {
        if (!isExpanded) {
            setSpreadViewMode('expanded');
        }
    };

    const handleCardClick = (e: React.MouseEvent, index: number) => {
        e.stopPropagation();
        // In mock mode, only allow expansion (not card detail)
        if (isMockMode) {
            if (!isExpanded) {
                setSpreadViewMode('expanded');
            }
            return;
        }
        // Normal mode
        if (isExpanded) {
            setSelectedCardIndex(index);
        } else {
            setSpreadViewMode('expanded');
        }
    };

    const closeCardDetail = () => setSelectedCardIndex(null);

    const selectedCardData = selectedCardIndex !== null && activeSpread
        ? activeSpread.cards.find(c => c.position_index === selectedCardIndex)
        : null;

    const hasMultipleSpreads = spreadHistory.length > 1;
    const canGoPrev = currentSpreadIndex > 0;
    const canGoNext = currentSpreadIndex < spreadHistory.length - 1;

    return (
        <div style={styles.container}>
            {/* Header with spread name */}
            <div
                style={{
                    ...styles.header,
                    cursor: isCollapsed ? 'pointer' : 'default',
                }}
                onClick={isCollapsed ? () => setSpreadViewMode('compact') : undefined}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={styles.spreadName}>
                        {isMockMode ? 'Awaiting Reading' : displaySpread.spread.name}
                    </span>
                    {/* Subtle expand indicator when collapsed */}
                    {isCollapsed && (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ color: 'rgba(212, 183, 250, 0.6)' }}>
                            <polyline points="6 9 12 15 18 9" />
                        </svg>
                    )}
                </div>
                {isExpanded && !isMockMode && displaySpread.question && (
                    <span style={styles.spreadTopic}>
                        &quot;{displaySpread.question}&quot;
                    </span>
                )}
            </div>

            {/* Main spread area - hidden when collapsed */}
            {!isCollapsed && (
                <>
                    <div style={styles.spreadArea}>
                        {/* Left navigation arrow - hide container if not needed to save space */}
                        {hasMultipleSpreads && (
                            <div style={styles.navButtonContainer}>
                                <button
                                    onClick={(e) => { e.stopPropagation(); navigateSpread('prev'); }}
                                    style={{
                                        ...styles.navArrow,
                                        opacity: canGoPrev ? 1 : 0.3,
                                    }}
                                    disabled={!canGoPrev}
                                >
                                    ‹
                                </button>
                            </div>
                        )}

                        {/* Grid container - this is what we measure */}
                        <div
                            ref={setGridRef}
                            style={styles.gridContainer}
                            onClick={handleSpreadClick}
                        >
                            {/* Actual grid with cards */}
                            <div
                                style={{
                                    display: 'grid',
                                    gridTemplateRows: `repeat(${dimensions.rows}, ${cardSize.height}px)`,
                                    gridTemplateColumns: `repeat(${dimensions.cols}, ${cardSize.width}px)`,
                                    gap: isExpanded ? '10px' : '6px',
                                    cursor: isExpanded ? 'default' : 'pointer',
                                }}
                            >
                                {gridLayout.map((row, r) => (
                                    row.map((cell, c) => {
                                        if (cell.type === 'empty') {
                                            return <div key={`${r}-${c}`} />;
                                        }

                                        const cardData = displaySpread.cards.find(card => card.position_index === cell.positionIndex);
                                        if (!cardData) return <div key={`${r}-${c}`} />;

                                        return (
                                            <div
                                                key={`${r}-${c}`}
                                                style={{
                                                    width: cardSize.width,
                                                    height: cardSize.height,
                                                    cursor: isExpanded && !isMockMode ? 'pointer' : (isExpanded ? 'default' : 'pointer'),
                                                }}
                                                onClick={(e) => handleCardClick(e, cell.positionIndex)}
                                            >
                                                {isMockMode ? (
                                                    <CardBack />
                                                ) : (
                                                    <SpreadCard
                                                        card={cardData.card}
                                                        positionIndex={cell.positionIndex}
                                                        isReversed={cardData.reversed}
                                                        isCompact={!isExpanded}
                                                    />
                                                )}
                                            </div>
                                        );
                                    })
                                ))}
                            </div>
                        </div>

                        {/* Right navigation arrow - hide container if not needed */}
                        {hasMultipleSpreads && (
                            <div style={styles.navButtonContainer}>
                                <button
                                    onClick={(e) => { e.stopPropagation(); navigateSpread('next'); }}
                                    style={{
                                        ...styles.navArrow,
                                        opacity: canGoNext ? 1 : 0.3,
                                    }}
                                    disabled={!canGoNext}
                                >
                                    ›
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Bottom area: indicator dots + expand/collapse button */}
                    <div style={styles.bottomArea}>
                        {/* Indicator dots */}
                        {hasMultipleSpreads && (
                            <div style={styles.dotsContainer}>
                                <span style={styles.pageIndicator}>
                                    {currentSpreadIndex + 1} of {spreadHistory.length}
                                </span>
                                <div style={styles.dots}>
                                    {spreadHistory.map((_, index) => (
                                        <div
                                            key={index}
                                            style={{
                                                ...styles.dot,
                                                backgroundColor: index === currentSpreadIndex
                                                    ? '#d4b7fa'
                                                    : 'rgba(255,255,255,0.3)',
                                            }}
                                        />
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Mock mode hint text */}
                        {isMockMode && (
                            <div style={styles.mockHint}>
                                Ask a question to reveal your cards
                            </div>
                        )}

                        {/* Control buttons - positioned at bottom center */}
                        <div style={styles.controlButtons}>
                            {/* Expand/Contract toggle button */}
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setSpreadViewMode(isExpanded ? 'compact' : 'expanded');
                                }}
                                style={styles.controlBtn}
                                title={isExpanded ? 'Contract spread' : 'Expand spread'}
                            >
                                <svg
                                    width="20"
                                    height="20"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    style={{
                                        transition: 'transform 0.2s ease',
                                    }}
                                >
                                    {isExpanded ? (
                                        <polyline points="18 15 12 9 6 15" />
                                    ) : (
                                        <polyline points="6 9 12 15 18 9" />
                                    )}
                                </svg>
                            </button>

                            {/* Collapse to FAB button */}
                            {!isMockMode && (
                                <button
                                    onClick={(e) => { e.stopPropagation(); setSpreadViewMode('collapsed'); }}
                                    style={styles.controlBtn}
                                    title="Minimize spread"
                                >
                                    <svg
                                        width="18"
                                        height="18"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="2"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                    >
                                        <line x1="18" y1="6" x2="6" y2="18" />
                                        <line x1="6" y1="6" x2="18" y2="18" />
                                    </svg>
                                </button>
                            )}
                        </div>
                    </div>

                </>
            )}

            {/* Card Detail Modal */}
            {selectedCardIndex !== null && selectedCardData && activeSpread && (
                <div style={styles.modalOverlay} onClick={closeCardDetail}>
                    <div style={styles.modalContent} onClick={e => e.stopPropagation()}>
                        <button style={styles.modalClose} onClick={closeCardDetail}>✕</button>
                        <div style={{
                            ...styles.modalImageContainer,
                            transform: selectedCardData.reversed ? 'rotate(180deg)' : 'none',
                        }}>
                            <Image
                                src={selectedCardData.card.image}
                                alt={selectedCardData.card.name}
                                fill
                                style={{ objectFit: 'contain' }}
                            />
                        </div>
                        <div style={styles.modalText}>
                            <h3>{selectedCardData.card.name} {selectedCardData.reversed && '(Reversed)'}</h3>
                            <p style={{ color: '#aaa', fontSize: '14px' }}>
                                Position {selectedCardIndex + 1}: {activeSpread.spread.positions[selectedCardIndex]?.meaning}
                            </p>
                            <p style={{ marginTop: '10px', fontSize: '14px', lineHeight: 1.5 }}>
                                {selectedCardData.reversed
                                    ? selectedCardData.card.meaning_reversed
                                    : selectedCardData.card.meaning}
                            </p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

/**
 * Card back component for the mock spread
 */
function CardBack() {
    return (
        <div style={{
            width: '100%',
            height: '100%',
            borderRadius: '8px',
            overflow: 'hidden',
            boxShadow: '0 4px 12px rgba(0,0,0,0.6), 0 0 16px rgba(139, 92, 246, 0.3)',
            border: '1px solid rgba(139, 92, 246, 0.4)',
            position: 'relative',
        }}>
            <Image
                src="/card-back.png"
                alt="Card back"
                fill
                sizes="200px"
                style={{ objectFit: 'cover' }}
            />
        </div>
    );
}

const styles: Record<string, React.CSSProperties> = {
    container: {
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: 'transparent', // Parent frame provides the glass effect
        color: 'white',
        overflow: 'hidden',
        position: 'relative',
    },
    emptyContainer: {
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#161626',
    },
    emptyText: {
        color: '#666',
        fontSize: '14px',
    },
    header: {
        height: '44px',
        minHeight: '44px',
        padding: '0 16px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        borderBottom: '1px solid rgba(255,255,255,0.1)',
        flexShrink: 0,
    },
    spreadName: {
        fontWeight: 600,
        color: '#d4b7fa',
        textTransform: 'uppercase',
        letterSpacing: '1px',
        fontSize: '12px',
    },
    spreadTopic: {
        fontSize: '13px',
        color: '#888',
        fontStyle: 'italic',
        marginTop: '4px',
        maxWidth: '300px',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
    },
    spreadArea: {
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        padding: '8px 0',
    },
    navButtonContainer: {
        width: '50px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
    },
    navArrow: {
        background: 'rgba(255,255,255,0.08)',
        border: '1px solid rgba(255,255,255,0.15)',
        color: 'white',
        fontSize: '32px',
        fontWeight: 300,
        width: '44px',
        height: '70px',
        borderRadius: '10px',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'all 0.2s ease',
    },
    gridContainer: {
        flex: 1,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'hidden',
        height: '100%',
    },
    bottomArea: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '8px 16px 12px',
        gap: '8px',
        flexShrink: 0,
    },
    dotsContainer: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '4px',
    },
    pageIndicator: {
        fontSize: '11px',
        color: '#888',
    },
    dots: {
        display: 'flex',
        gap: '6px',
    },
    dot: {
        width: '8px',
        height: '8px',
        borderRadius: '50%',
        transition: 'background-color 0.2s ease',
    },
    mockHint: {
        fontSize: '13px',
        color: '#9b59b6',
        fontStyle: 'italic',
    },
    controlButtons: {
        display: 'flex',
        gap: '12px',
        alignItems: 'center',
        justifyContent: 'center',
    },
    controlBtn: {
        background: 'rgba(255,255,255,0.08)',
        border: '1px solid rgba(255,255,255,0.15)',
        color: 'rgba(255,255,255,0.7)',
        width: '40px',
        height: '40px',
        borderRadius: '50%',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'all 0.2s ease',
        backdropFilter: 'blur(8px)',
    },
    modalOverlay: {
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.5)',
        backdropFilter: 'blur(4px)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
    },
    modalContent: {
        backgroundColor: '#1f1f2e',
        borderRadius: '16px',
        padding: '20px',
        maxWidth: '340px',
        width: '100%',
        maxHeight: '85vh',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
        border: '1px solid rgba(255,255,255,0.1)',
        overflowY: 'auto',
    },
    modalClose: {
        position: 'absolute',
        top: '10px',
        right: '10px',
        background: 'rgba(255,255,255,0.1)',
        border: 'none',
        color: 'white',
        width: '30px',
        height: '30px',
        borderRadius: '50%',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2,
    },
    modalImageContainer: {
        width: '100%',
        height: '280px',
        position: 'relative',
        marginBottom: '16px',
        flexShrink: 0,
    },
    modalText: {
        overflowY: 'auto',
    }
};
