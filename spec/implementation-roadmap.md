# MVP Implementation Roadmap

This document outlines the implementation phases for the AI-first Tarot Reader MVP.

---

## Phase 1: Prove the AI Flow (Backend)

**Goal:** Validate dual-model architecture works before investing in UI

| Step | Description | Status |
|------|-------------|--------|
| 1.1 | Implement `/api/chat` endpoint with streaming | [x] |
| 1.2 | Wire up tool definitions (`list_spreads`, `draw_cards`, `request_interpretation`) | [x] |
| 1.3 | Implement `request_interpretation` → thinking model handoff | [x] |
| 1.4 | Test via Postman/curl or simple textarea | [x] |

**Deliverable:** Chat via API, AI lays spreads and interprets seamlessly.

**Reference:** `spec/ai-architecture.md`, `app/src/prompts/`

---

## Phase 2: Mobile Chat UI (Frontend)

**Goal:** Build the interface from ui-spec.md

| Step | Description | Status |
|------|-------------|--------|
| 2.1 | ChatPanel component (messages, streaming, input) | [ ] |
| 2.2 | SpreadViewer component (pinned, collapsible) | [ ] |
| 2.3 | Keyboard handling (FAB collapse/expand) | [ ] |
| 2.4 | CardDetail modal | [ ] |
| 2.5 | Multi-spread navigation | [ ] |

**Deliverable:** Mobile-ready chat UI connected to the chat API.

**Reference:** `spec/ui-spec.md`

---

## Phase 3: Context Management

**Goal:** Implement summarization and spread ledger

| Step | Description | Status |
|------|-------------|--------|
| 3.1 | Message history tracking (last 20) | [ ] |
| 3.2 | Summarization trigger (when >20 messages) | [ ] |
| 3.3 | Spread ledger generation | [ ] |

**Deliverable:** Conversation context stays bounded while preserving meaning.

**Reference:** `spec/Data Model.txt` (sections 1.7, 1.8)

---

## Key Specs

| Document | Purpose |
|----------|---------|
| [Feature list.txt](./Feature%20list.txt) | MVP scope and definitions of done |
| [ui-spec.md](./ui-spec.md) | Mobile layout states and components |
| [ai-architecture.md](./ai-architecture.md) | Dual-model architecture and tools |
| [Data Model.txt](./Data%20Model.txt) | Data types and contracts |
