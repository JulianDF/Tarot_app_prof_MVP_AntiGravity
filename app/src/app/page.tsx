'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import Image from 'next/image';
import { useSession } from '@/context/sessionContext';
import { Spread, Reading } from '@/types';
import { getSystemSpreads, createSpreadSnapshot } from '@/services/spreadService';
import { getAllCards } from '@/services/cardService';
import { parseLayoutDescriptor } from '@/lib/layoutParser';
import styles from './page.module.css';

export default function Home() {
  const { state, initSession, createReading, setActiveReading, addCardsToReading, addInterpretation, getActiveReading } = useSession();

  // Controls state
  const [question, setQuestion] = useState('');
  const [selectedSpreadSlug, setSelectedSpreadSlug] = useState('diamond_spread');
  const [allowDuplicates, setAllowDuplicates] = useState(false);
  const [allowReversals, setAllowReversals] = useState(true);

  // Drawing state
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);
  const [flippedCards, setFlippedCards] = useState<Set<number>>(new Set());
  const [expandedCardPosition, setExpandedCardPosition] = useState<number | null>(null);

  // AI state
  const [isInterpreting, setIsInterpreting] = useState(false);
  const [interpretError, setInterpretError] = useState<string | null>(null);

  // Viewport-fit card sizing
  const spreadContainerRef = useRef<HTMLDivElement>(null);
  const [cardDimensions, setCardDimensions] = useState({ width: 80, height: 140 });

  // Data
  const allCards = useMemo(() => getAllCards(), []);
  const activeReading = getActiveReading();

  // Initialize session
  useEffect(() => {
    if (state.spreads.system.length === 0) {
      const spreads = getSystemSpreads();
      initSession(spreads);
    }
  }, [state.spreads.system.length, initSession]);

  // Get selected spread
  const selectedSpread = useMemo(() => {
    return state.spreads.system.find(s => s.slug === selectedSpreadSlug);
  }, [state.spreads.system, selectedSpreadSlug]);

  // Parse layout for display
  const layoutGrid = useMemo(() => {
    if (!selectedSpread) return [];
    return parseLayoutDescriptor(selectedSpread.layout_descriptor);
  }, [selectedSpread]);

  // Calculate dynamic card size based on spread and viewport
  const calculateCardSize = useCallback(() => {
    if (!spreadContainerRef.current || !layoutGrid.length) return;

    const container = spreadContainerRef.current;
    const containerWidth = container.clientWidth - 60;
    const containerHeight = container.clientHeight - 150; // More space for title

    const numRows = layoutGrid.length;
    const numCols = Math.max(...layoutGrid.map(row => row.length));

    const cardRatio = 1.75;
    const gapSize = 12;

    const maxCardWidth = (containerWidth - (numCols - 1) * gapSize) / numCols;
    const maxCardHeight = (containerHeight - (numRows - 1) * gapSize - 30) / numRows; // -30 for labels

    let cardWidth = Math.min(maxCardWidth, maxCardHeight / cardRatio);
    let cardHeight = cardWidth * cardRatio;

    // Clamp
    cardWidth = Math.max(55, Math.min(100, cardWidth));
    cardHeight = cardWidth * cardRatio;

    setCardDimensions({ width: Math.floor(cardWidth), height: Math.floor(cardHeight) });
  }, [layoutGrid]);

  useEffect(() => {
    calculateCardSize();
    window.addEventListener('resize', calculateCardSize);
    return () => window.removeEventListener('resize', calculateCardSize);
  }, [calculateCardSize]);

  // Get card data for a position
  const getCardForPosition = (positionIndex: number) => {
    if (!activeReading) return null;
    const readingCard = activeReading.cards.find(c => c.position_index === positionIndex);
    if (!readingCard) return null;
    const card = allCards.find(c => c.id === readingCard.card_id);
    if (!card) return null;
    return { card, readingCard };
  };

  // Handle spread change
  const handleSpreadChange = (slug: string) => {
    setSelectedSpreadSlug(slug);
    setHasDrawn(false);
    setFlippedCards(new Set());
    setExpandedCardPosition(null);
  };

  // Handle draw
  const handleDraw = async () => {
    if (!selectedSpread) return;

    setIsDrawing(true);
    setHasDrawn(false);
    setFlippedCards(new Set());
    setExpandedCardPosition(null);

    try {
      const snapshot = createSpreadSnapshot(selectedSpread);
      const reading = createReading(selectedSpread, snapshot, question.trim() || 'General reading', {
        allowDuplicates,
        allowReversals,
      });

      const response = await fetch('/api/rng/draw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          n: selectedSpread.n_cards,
          allowDuplicates,
          allowReversals,
        }),
      });

      if (!response.ok) throw new Error('Failed to draw cards');

      const { draws, provenance } = await response.json();
      const readingCards = draws.map((draw: { cardId: number; reversed: boolean }, index: number) => ({
        position_index: index,
        card_id: draw.cardId,
        reversed: draw.reversed,
      }));

      addCardsToReading(reading.id, readingCards, provenance);
      setHasDrawn(true);

      // Flip cards one by one
      for (let i = 0; i < readingCards.length; i++) {
        await new Promise(resolve => setTimeout(resolve, 300));
        setFlippedCards(prev => new Set([...prev, i]));
      }
    } catch (err) {
      console.error('Draw error:', err);
    } finally {
      setIsDrawing(false);
    }
  };

  // Handle card click - expand to show meanings
  const handleCardClick = (positionIndex: number) => {
    if (!hasDrawn || !flippedCards.has(positionIndex)) return;
    setExpandedCardPosition(expandedCardPosition === positionIndex ? null : positionIndex);
  };

  // Close expanded card when clicking backdrop
  const handleBackdropClick = () => {
    setExpandedCardPosition(null);
  };

  // Handle AI interpretation
  const handleInterpret = async () => {
    if (!activeReading) return;

    setIsInterpreting(true);
    setInterpretError(null);

    try {
      const response = await fetch('/api/ai/interpret', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reading: activeReading, depth: 'medium' }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to get interpretation');
      }

      const { interpretation } = await response.json();
      addInterpretation(activeReading.id, interpretation);
    } catch (err) {
      console.error('Interpretation error:', err);
      setInterpretError(err instanceof Error ? err.message : 'Failed to get interpretation');
    } finally {
      setIsInterpreting(false);
    }
  };

  // Handle new reading
  const handleNewReading = () => {
    setQuestion('');
    setHasDrawn(false);
    setFlippedCards(new Set());
    setExpandedCardPosition(null);
  };

  // Handle reading history click
  const handleHistoryClick = (reading: Reading) => {
    setActiveReading(reading.id);
    setHasDrawn(true);
    setFlippedCards(new Set(reading.cards.map(c => c.position_index)));
    setExpandedCardPosition(null);
    const spread = state.spreads.system.find(s => s.id === reading.spread_id);
    if (spread) {
      setSelectedSpreadSlug(spread.slug);
      setQuestion(reading.question);
    }
  };

  // Format relative time
  const formatRelativeTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return date.toLocaleDateString();
  };

  // Get expanded card data
  const expandedCardData = expandedCardPosition !== null ? getCardForPosition(expandedCardPosition) : null;
  const expandedPosition = expandedCardPosition !== null && selectedSpread ? selectedSpread.positions[expandedCardPosition] : null;

  return (
    <main className={styles.main}>
      {/* Header */}
      <header className={styles.header}>
        <div className={styles.logo}>🔮</div>
        <h1 className={styles.title}>Tarot Reading</h1>
        {hasDrawn && (
          <button className={styles.newReadingBtn} onClick={handleNewReading}>
            + New Reading
          </button>
        )}
      </header>

      <div className={styles.layout}>
        {/* Left Panel - Controls */}
        <aside className={styles.controlsPanel}>
          <div className={styles.controlGroup}>
            <label className={styles.label}>Your Question</label>
            <textarea
              className={styles.questionInput}
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="What would you like to explore?"
              rows={3}
              disabled={hasDrawn}
            />
          </div>

          <div className={styles.controlGroup}>
            <label className={styles.label}>Choose Spread</label>
            <div className={styles.spreadList}>
              {state.spreads.system.map((spread) => (
                <button
                  key={spread.slug}
                  className={`${styles.spreadOption} ${selectedSpreadSlug === spread.slug ? styles.spreadOptionActive : ''}`}
                  onClick={() => handleSpreadChange(spread.slug)}
                  disabled={hasDrawn}
                >
                  <span className={styles.spreadName}>{spread.name}</span>
                  <span className={styles.spreadCards}>{spread.n_cards} cards</span>
                </button>
              ))}
            </div>
          </div>

          <div className={styles.controlGroup}>
            <label className={styles.label}>Options</label>
            <label className={styles.checkbox}>
              <input
                type="checkbox"
                checked={allowReversals}
                onChange={(e) => setAllowReversals(e.target.checked)}
                disabled={hasDrawn}
              />
              <span>Allow reversed cards</span>
            </label>
            <label className={styles.checkbox}>
              <input
                type="checkbox"
                checked={allowDuplicates}
                onChange={(e) => setAllowDuplicates(e.target.checked)}
                disabled={hasDrawn}
              />
              <span>Allow duplicates</span>
            </label>
          </div>

          <button
            className={styles.drawButton}
            onClick={handleDraw}
            disabled={isDrawing || hasDrawn}
          >
            {isDrawing ? 'Drawing...' : hasDrawn ? 'Cards Drawn' : '✨ Draw Cards'}
          </button>

          {activeReading && (
            <div className={styles.provenance}>
              <span className={styles.provenanceLabel}>RNG:</span>
              <span className={styles.provenanceValue}>
                {activeReading.rng.method_used === 'qrng' && 'Quantum'}
                {activeReading.rng.method_used === 'random_org' && 'random.org'}
                {activeReading.rng.method_used === 'fallback' && 'Crypto'}
              </span>
            </div>
          )}
        </aside>

        {/* Center Panel - Spread Viewer */}
        <section
          className={styles.spreadPanel}
          ref={spreadContainerRef}
          style={{
            '--dynamic-card-width': `${cardDimensions.width}px`,
            '--dynamic-card-height': `${cardDimensions.height}px`,
          } as React.CSSProperties}
        >
          {selectedSpread && (
            <>
              <div className={styles.spreadHeader}>
                <h2 className={styles.spreadTitle}>{selectedSpread.name}</h2>
                <p className={styles.spreadPurpose}>{selectedSpread.purpose}</p>
              </div>

              <div className={styles.spreadGrid}>
                {layoutGrid.map((row, rowIndex) => (
                  <div key={rowIndex} className={styles.spreadRow}>
                    {row.map((cell, colIndex) => {
                      if (cell.type === 'empty') {
                        return <div key={`${rowIndex}-${colIndex}`} className={styles.cardSlotEmpty} />;
                      }

                      const positionIndex = cell.positionIndex;
                      const cardData = getCardForPosition(positionIndex);
                      const isFlipped = flippedCards.has(positionIndex);
                      const position = selectedSpread.positions[positionIndex];

                      return (
                        <div
                          key={`${rowIndex}-${colIndex}`}
                          className={styles.cardSlot}
                          onClick={() => handleCardClick(positionIndex)}
                        >
                          <div className={`${styles.card} ${isFlipped ? styles.cardFlipped : ''}`}>
                            {/* Card Back - Purple design (visible before flip) */}
                            <div className={styles.cardBack}>
                              <div className={styles.cardBackDesign}>
                                <span className={styles.cardPosition}>{positionIndex + 1}</span>
                              </div>
                            </div>

                            {/* Card Front - Image (visible after flip) */}
                            <div className={styles.cardFront}>
                              {cardData && (
                                <Image
                                  src={cardData.card.image}
                                  alt={cardData.card.name}
                                  fill
                                  className={`${styles.cardImage} ${cardData.readingCard.reversed ? styles.cardReversed : ''}`}
                                />
                              )}
                            </div>
                          </div>

                          <span className={styles.positionLabel}>
                            {position?.meaning.split(' ').slice(0, 3).join(' ')}...
                          </span>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>

              {hasDrawn && (
                <p className={styles.clickHint}>Click a card to reveal its meaning</p>
              )}
            </>
          )}

          {/* Expanded Card Modal */}
          {expandedCardPosition !== null && expandedCardData && expandedPosition && (
            <>
              <div className={styles.modalBackdrop} onClick={handleBackdropClick} />
              <div className={styles.expandedCard}>
                <button className={styles.closeBtn} onClick={handleBackdropClick}>×</button>

                <div className={styles.expandedCardImage}>
                  <Image
                    src={expandedCardData.card.image}
                    alt={expandedCardData.card.name}
                    width={140}
                    height={245}
                    className={expandedCardData.readingCard.reversed ? styles.cardReversed : ''}
                  />
                </div>

                <div className={styles.expandedCardContent}>
                  <h3 className={styles.expandedCardName}>
                    {expandedCardData.card.name}
                    {expandedCardData.readingCard.reversed && <span className={styles.reversedBadge}>Reversed</span>}
                  </h3>

                  <div className={styles.expandedSection}>
                    <h4>Position {expandedCardPosition + 1}</h4>
                    <p>{expandedPosition.meaning}</p>
                  </div>

                  <div className={styles.expandedSection}>
                    <h4>Card Meaning</h4>
                    <p>
                      {expandedCardData.readingCard.reversed
                        ? expandedCardData.card.meaning_reversed
                        : expandedCardData.card.meaning}
                    </p>
                  </div>

                  <div className={styles.expandedKeywords}>
                    {(expandedCardData.readingCard.reversed
                      ? expandedCardData.card.keywords_reversed
                      : expandedCardData.card.keywords
                    ).map((kw, i) => (
                      <span key={i} className={styles.keyword}>{kw}</span>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}
        </section>

        {/* Right Panel - Reading History & AI */}
        <aside className={styles.meaningsPanel}>
          <h2 className={styles.panelTitle}>Reading History</h2>

          <div className={styles.historyList}>
            {state.readings.length === 0 ? (
              <div className={styles.placeholder}>
                <p>Complete your first reading to see history here.</p>
              </div>
            ) : (
              state.readings.map((reading) => {
                const spread = state.spreads.system.find(s => s.id === reading.spread_id);
                const isActive = activeReading?.id === reading.id;

                return (
                  <button
                    key={reading.id}
                    className={`${styles.historyItem} ${isActive ? styles.historyItemActive : ''}`}
                    onClick={() => handleHistoryClick(reading)}
                  >
                    <div className={styles.historySpread}>{spread?.name || 'Unknown Spread'}</div>
                    <div className={styles.historyQuestion}>
                      {reading.question.length > 40 ? reading.question.slice(0, 40) + '...' : reading.question}
                    </div>
                    <div className={styles.historyMeta}>
                      <span className={styles.historyTime}>{formatRelativeTime(reading.created_at)}</span>
                      <span className={styles.historyCards}>{reading.cards.length} cards</span>
                      {reading.ai?.one_shot && <span className={styles.historyAi}>✨</span>}
                    </div>
                  </button>
                );
              })
            )}
          </div>

          {hasDrawn && activeReading && (
            <div className={styles.aiSection}>
              {!activeReading.ai?.one_shot ? (
                <>
                  {interpretError && (
                    <p className={styles.error}>{interpretError}</p>
                  )}
                  <button
                    className={styles.interpretButton}
                    onClick={handleInterpret}
                    disabled={isInterpreting}
                  >
                    {isInterpreting ? 'Interpreting...' : '✨ Interpret with AI'}
                  </button>
                </>
              ) : (
                <div className={styles.interpretation}>
                  <h3>✨ AI Interpretation</h3>
                  <p>{activeReading.ai.one_shot.output_text}</p>
                </div>
              )}
            </div>
          )}

          <div className={styles.chatPlaceholder}>
            <p className={styles.chatPlaceholderText}>💬 Chat coming in V1</p>
          </div>
        </aside>
      </div>
    </main>
  );
}
