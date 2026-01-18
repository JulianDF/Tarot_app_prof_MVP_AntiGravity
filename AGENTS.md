# AGENTS.md

## Project Scope
- MVP: single-session tarot reading loop (no accounts, no saving, no paywall).
- V1: accounts, persistence, premium gating, credits/payments, chat with context, search, exports, AI over history.
- V2: client workflows + daily email digests.

## MVP Requirements (From `spec/Feature list.txt`)
- Card database: 78 cards with upright/reversed meanings + keywords.
- Spreads: Diamond (5), Energy Mix (4), Blockage (6), Two Paths (8).
- Layout parsing: rows split by `\n`, tokens split by comma/whitespace; `X` = empty; integers are 1-based position indexes.
- Reading flow: question + spread selection (order flexible), draw mode (QRNG default), multiple readings per session.
- RNG cascade: QRNG → random.org → slot-machine click; allow duplicates toggle; `allow_reversals` applies only to system draws; no forced 50/50.
- Reading view: layout + drawn cards + position/card meanings; question locked after draw.
- AI interpretation: one-shot on active reading only.

## V1 Notes
- Custom spreads moved to V1.
- Notes per reading (general + by position) are V1.
- Save/history + accounts + premium + credits + chat + search/filters.

## Implementation Guardrails
- Keep MVP objects aligned with V1 persistence shapes: `Reading`, `Spread`, `CardDraw`, `RngProvenance`, `AiInterpretationResult`.
- Prefer backend proxy for QRNG/random.org to avoid CORS and unify fallbacks.
