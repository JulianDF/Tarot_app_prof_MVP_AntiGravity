# AGENTS.md

## Project Vision
Mobile-first AI Tarot reader with open, flowing conversation. The core experience is chatting with an AI reader — spreads are laid within the conversation and displayed in a mobile-optimized format.

## MVP Scope
- **GUI**: Simultaneous spread + chat access; multi-spread navigation; keyboard-aware collapse/expand
- **AI**: Low-latency conversation (<1s to first token) + nuanced interpretations via dual-model architecture
- **Context**: AI anchored in question, current spread, past spreads, and conversation history

See `spec/Feature list.txt` for definitions of done.

## Key Specs
- `spec/ui-spec.md` — Mobile layout states, components, state machine
- `spec/ai-architecture.md` — Dual-model (mini + thinking) architecture
- `spec/Data Model.txt` — Session state, chat types, interpretation types

## Data Contracts
- Card database: 78 cards with upright/reversed meanings + keywords (from `spec/cards.json`)
- Spreads: Diamond (5), Energy Mix (4), Blockage (6), Two Paths (8) (from `spec/spreads.json`)
- Layout parsing: rows split by `\n`, tokens split by comma/whitespace; `X` = empty; integers are 1-based position indexes

## AI Architecture
- **Conversation model**: Claude Haiku 4.5 — fast responses, clarifications, emotional support
- **Interpretation model**: GPT 5.2 Thinking — called as tool for deep spread analysis
- **Context window**: Last 20 messages + summary + active spread + spread ledger

## RNG Cascade
1. Primary: QRNG (ANU)
2. Fallback: random.org
3. Fallback: slot-machine click selection

## Implementation Guardrails
- Keep MVP objects aligned with V1 persistence shapes
- Use backend proxy for QRNG/random.org (CORS + unified fallbacks)
- Context summarization is deterministic and session-level
