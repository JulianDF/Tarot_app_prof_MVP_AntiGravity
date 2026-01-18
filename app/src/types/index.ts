/**
 * Tarot App — Type Definitions
 * Matches the data model in spec/Data Model.txt
 */

// ─────────────────────────────────────────────────────────────────────────────
// Enums
// ─────────────────────────────────────────────────────────────────────────────

export type RngMethod = 'qrng' | 'random_org' | 'slot_machine' | 'manual' | 'fallback';
export type AiDepth = 'short' | 'medium' | 'deep';
export type SpreadType = 'system' | 'custom';
export type MessageRole = 'user' | 'assistant' | 'system';

// ─────────────────────────────────────────────────────────────────────────────
// Card (static, from cards.json)
// ─────────────────────────────────────────────────────────────────────────────

export interface Card {
  id: number; // 0–77 canonical
  name: string;
  arcana: 'major' | 'minor';
  suit: 'wands' | 'cups' | 'swords' | 'pentacles' | null;
  rank: string | null;
  keywords: string[];
  meaning: string;
  keywords_reversed: string[];
  meaning_reversed: string;
  image: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Spread (system or custom templates)
// ─────────────────────────────────────────────────────────────────────────────

export interface SpreadPosition {
  index: number; // 0-based
  meaning: string;
}

export interface Spread {
  id: string; // For MVP system spreads, equals slug
  type: SpreadType;
  slug: string;
  name: string;
  purpose: string;
  n_cards: number;
  positions: SpreadPosition[];
  layout_descriptor: string; // e.g., "X5X\n213\nX4X"
}

// ─────────────────────────────────────────────────────────────────────────────
// Spread Snapshot (frozen at time of reading)
// ─────────────────────────────────────────────────────────────────────────────

export interface SpreadSnapshotSource {
  type: SpreadType;
  spread_id: string;
  slug?: string;
}

export interface SpreadSnapshot {
  name: string;
  purpose: string;
  n_cards: number;
  positions: SpreadPosition[];
  layout_descriptor: string;
  source: SpreadSnapshotSource;
}

// ─────────────────────────────────────────────────────────────────────────────
// RNG Provenance (cascade audit trail)
// ─────────────────────────────────────────────────────────────────────────────

export interface RngAttemptError {
  code?: string;
  message: string;
}

export interface RngAttempt {
  method: RngMethod;
  provider?: string; // e.g., 'anu_qrng', 'random_org'
  started_at: string; // ISO
  ended_at: string; // ISO
  success: boolean;
  error?: RngAttemptError;
  meta?: Record<string, unknown>;
}

export interface RngProvenance {
  method_used: RngMethod;
  attempts: RngAttempt[];
  final_seed_or_receipt?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Reading Card (card drawn to a position)
// ─────────────────────────────────────────────────────────────────────────────

export interface ReadingCard {
  position_index: number;
  card_id: number; // 0–77
  reversed: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// AI Interpretation Result
// ─────────────────────────────────────────────────────────────────────────────

export interface AiUsage {
  input_tokens?: number;
  output_tokens?: number;
}

export interface AiCostHint {
  credits_estimated?: number;
}

export interface AiInterpretationResult {
  id: string;
  created_at: string; // ISO
  depth: AiDepth;
  prompt_version: string;
  output_text: string;
  usage?: AiUsage;
  cost_hint?: AiCostHint;
}

// ─────────────────────────────────────────────────────────────────────────────
// Reading (session-scoped)
// ─────────────────────────────────────────────────────────────────────────────

export interface ReadingNotes {
  general?: string;
  by_position?: Record<number, string>;
}

export interface ReadingAi {
  one_shot?: AiInterpretationResult;
}

export interface Reading {
  id: string;
  created_at: string; // ISO
  spread_id: string;
  spread_snapshot: SpreadSnapshot;
  question: string;
  allow_duplicates: boolean;
  allow_reversals: boolean;
  cards: ReadingCard[];
  notes?: ReadingNotes;
  rng: RngProvenance;
  ai?: ReadingAi;
}

// ─────────────────────────────────────────────────────────────────────────────
// Session State (MVP: in-memory, multiple readings per session)
// ─────────────────────────────────────────────────────────────────────────────

export interface SessionSpreads {
  system: Spread[];
  custom: Spread[];
}

export interface SessionState {
  session_id: string;
  created_at: string; // ISO
  updated_at: string; // ISO
  spreads: SessionSpreads;
  readings: Reading[];
  active_reading_id?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// API Request/Response Types
// ─────────────────────────────────────────────────────────────────────────────

export interface DrawRequest {
  n: number;
  allowDuplicates?: boolean;
  allowReversals?: boolean;
}

export interface CardDraw {
  cardId: number;
  reversed: boolean;
}

export interface DrawResponse {
  draws: CardDraw[];
  provenance: RngProvenance;
}

export interface InterpretRequest {
  reading: Reading;
  depth?: AiDepth;
}

export interface InterpretResponse {
  interpretation: AiInterpretationResult;
}

// ─────────────────────────────────────────────────────────────────────────────
// Layout Grid Types (for rendering)
// ─────────────────────────────────────────────────────────────────────────────

export type LayoutCell = 
  | { type: 'empty' }
  | { type: 'position'; positionIndex: number };

export type LayoutGrid = LayoutCell[][];
