'use client';

import { useState, useMemo, use } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { useSession } from '@/context/sessionContext';
import { getAllCards } from '@/services/cardService';
import { parseLayoutDescriptor } from '@/lib/layoutParser';
import { Card, ReadingCard, AiInterpretationResult } from '@/types';
import styles from './page.module.css';

interface PageProps {
    params: Promise<{ id: string }>;
}

export default function ReadingPage({ params }: PageProps) {
    const { id } = use(params);
    const router = useRouter();
    const { getReadingById, addInterpretation } = useSession();

    const [selectedPosition, setSelectedPosition] = useState<number | null>(null);
    const [isInterpreting, setIsInterpreting] = useState(false);
    const [interpretError, setInterpretError] = useState<string | null>(null);

    const reading = getReadingById(id);
    const allCards = useMemo(() => getAllCards(), []);

    // Parse the layout
    const layoutGrid = useMemo(() => {
        if (!reading) return [];
        return parseLayoutDescriptor(reading.spread_snapshot.layout_descriptor);
    }, [reading]);

    // Get card data for a position
    const getCardForPosition = (positionIndex: number): { card: Card; readingCard: ReadingCard } | null => {
        const readingCard = reading?.cards.find(c => c.position_index === positionIndex);
        if (!readingCard) return null;
        const card = allCards.find(c => c.id === readingCard.card_id);
        if (!card) return null;
        return { card, readingCard };
    };

    // Handle AI interpretation
    const handleInterpret = async () => {
        if (!reading) return;

        setIsInterpreting(true);
        setInterpretError(null);

        try {
            const response = await fetch('/api/ai/interpret', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ reading, depth: 'medium' }),
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to get interpretation');
            }

            const { interpretation } = await response.json();
            addInterpretation(reading.id, interpretation);
        } catch (err) {
            console.error('Interpretation error:', err);
            setInterpretError(err instanceof Error ? err.message : 'Failed to get interpretation');
        } finally {
            setIsInterpreting(false);
        }
    };

    if (!reading) {
        return (
            <div className={styles.loading}>
                <div className={styles.loadingSpinner} />
                <p>Loading reading...</p>
            </div>
        );
    }

    const selectedCardData = selectedPosition !== null ? getCardForPosition(selectedPosition) : null;
    const selectedPositionMeaning = selectedPosition !== null
        ? reading.spread_snapshot.positions.find(p => p.index === selectedPosition)
        : null;

    return (
        <div className={styles.container}>
            <div className="container">
                {/* Header */}
                <header className={styles.header}>
                    <button className={styles.backButton} onClick={() => router.push('/')}>
                        ← New Reading
                    </button>
                    <div className={styles.headerContent}>
                        <h1 className={styles.spreadName}>{reading.spread_snapshot.name}</h1>
                        <p className={styles.question}>"{reading.question}"</p>
                    </div>
                    <div style={{ width: '100px' }} /> {/* Spacer for centering */}
                </header>

                {/* Layout Grid */}
                <section className={styles.layoutSection}>
                    <div className={styles.layoutGrid}>
                        {layoutGrid.map((row, rowIndex) => (
                            <div key={rowIndex} className={styles.layoutRow}>
                                {row.map((cell, colIndex) => {
                                    if (cell.type === 'empty') {
                                        return (
                                            <div
                                                key={`${rowIndex}-${colIndex}`}
                                                className={`${styles.cardSlot} ${styles.cardSlotEmpty}`}
                                            />
                                        );
                                    }

                                    const cardData = getCardForPosition(cell.positionIndex);
                                    if (!cardData) {
                                        return (
                                            <div
                                                key={`${rowIndex}-${colIndex}`}
                                                className={styles.cardSlot}
                                            />
                                        );
                                    }

                                    const isSelected = selectedPosition === cell.positionIndex;

                                    return (
                                        <div
                                            key={`${rowIndex}-${colIndex}`}
                                            className={`${styles.cardSlot} ${styles.cardSlotFilled}`}
                                            onClick={() => setSelectedPosition(
                                                isSelected ? null : cell.positionIndex
                                            )}
                                        >
                                            <span className={styles.positionBadge}>{cell.positionIndex + 1}</span>
                                            <Image
                                                src={cardData.card.image}
                                                alt={cardData.card.name}
                                                width={100}
                                                height={174}
                                                className={`${styles.cardImage} ${cardData.readingCard.reversed ? styles.cardReversed : ''} ${isSelected ? styles.cardSelected : ''}`}
                                            />
                                        </div>
                                    );
                                })}
                            </div>
                        ))}
                    </div>
                </section>

                {/* Selected Card Details */}
                {selectedCardData && selectedPositionMeaning && (
                    <section className={styles.detailsPanel}>
                        <div className={styles.detailsHeader}>
                            <h2 className={styles.cardName}>{selectedCardData.card.name}</h2>
                            {selectedCardData.readingCard.reversed && (
                                <span className={styles.reversedBadge}>Reversed</span>
                            )}
                        </div>

                        <div className={styles.positionMeaning}>
                            <p className={styles.positionLabel}>
                                Position {selectedPosition! + 1}
                            </p>
                            <p className={styles.positionText}>
                                {selectedPositionMeaning.meaning}
                            </p>
                        </div>

                        <div className={styles.cardMeaning}>
                            <p className={styles.meaningLabel}>Card Meaning</p>
                            <p className={styles.meaningText}>
                                {selectedCardData.readingCard.reversed
                                    ? selectedCardData.card.meaning_reversed
                                    : selectedCardData.card.meaning}
                            </p>
                        </div>

                        <div className={styles.keywords}>
                            {(selectedCardData.readingCard.reversed
                                ? selectedCardData.card.keywords_reversed
                                : selectedCardData.card.keywords
                            ).map((keyword, i) => (
                                <span key={i} className={styles.keyword}>{keyword}</span>
                            ))}
                        </div>
                    </section>
                )}

                {/* All Cards List */}
                <section style={{ marginBottom: 'var(--space-2xl)' }}>
                    <h2 style={{ marginBottom: 'var(--space-lg)' }}>All Cards in This Reading</h2>
                    <div className={styles.allCards}>
                        {reading.spread_snapshot.positions.map((position) => {
                            const cardData = getCardForPosition(position.index);
                            if (!cardData) return null;

                            return (
                                <div
                                    key={position.index}
                                    className={styles.cardItem}
                                    onClick={() => setSelectedPosition(position.index)}
                                >
                                    <Image
                                        src={cardData.card.image}
                                        alt={cardData.card.name}
                                        width={60}
                                        height={104}
                                        className={`${styles.cardItemImage} ${cardData.readingCard.reversed ? styles.cardItemReversed : ''}`}
                                    />
                                    <div className={styles.cardItemInfo}>
                                        <p className={styles.cardItemPosition}>
                                            Position {position.index + 1}: {position.meaning}
                                        </p>
                                        <h3 className={styles.cardItemName}>
                                            {cardData.card.name}
                                            {cardData.readingCard.reversed && ' (Reversed)'}
                                        </h3>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </section>

                {/* AI Interpretation */}
                {!reading.ai?.one_shot ? (
                    <section className={styles.interpretSection}>
                        <h2 style={{ marginBottom: 'var(--space-lg)' }}>AI Interpretation</h2>
                        <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-lg)' }}>
                            Get a personalized interpretation of your reading
                        </p>
                        {interpretError && (
                            <p style={{ color: 'hsl(0, 70%, 60%)', marginBottom: 'var(--space-md)' }}>
                                {interpretError}
                            </p>
                        )}
                        <button
                            className={`btn btn-primary ${styles.interpretButton}`}
                            onClick={handleInterpret}
                            disabled={isInterpreting}
                        >
                            {isInterpreting ? 'Interpreting...' : '✨ Interpret This Reading'}
                        </button>
                    </section>
                ) : (
                    <section className={styles.interpretation}>
                        <div className={styles.interpretationHeader}>
                            <h2 className={styles.interpretationTitle}>✨ AI Interpretation</h2>
                            <span className={styles.interpretationMeta}>
                                {new Date(reading.ai.one_shot.created_at).toLocaleString()}
                            </span>
                        </div>
                        <p className={styles.interpretationText}>
                            {reading.ai.one_shot.output_text}
                        </p>
                    </section>
                )}

                {/* RNG Provenance */}
                <div className={styles.provenance}>
                    <span className={styles.provenanceLabel}>Cards drawn via:</span>
                    <span className={styles.provenanceMethod}>
                        {reading.rng.method_used === 'qrng' && 'Quantum Random (ANU QRNG)'}
                        {reading.rng.method_used === 'random_org' && 'Random.org'}
                        {reading.rng.method_used === 'fallback' && 'Cryptographic Random'}
                        {reading.rng.method_used === 'manual' && 'Manual Selection'}
                    </span>
                </div>
            </div>
        </div>
    );
}
