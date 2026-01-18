# Tarot App — AI Architecture Specification

This document defines the dual-model architecture for the AI Tarot Reader MVP, optimizing for **low latency**, **high-quality interpretations**, and **seamless conversation flow**.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         USER                                     │
│                          │                                       │
│                          ▼                                       │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                  CONVERSATION MODEL                        │  │
│  │                  (GPT 5.2 mini)                           │  │
│  │                                                            │  │
│  │  - Low latency responses                                   │  │
│  │  - Conversational flow (acknowledgments, clarifications)  │  │
│  │  - Context management                                      │  │
│  │  - Tool orchestration (spreads, interpretation)            │  │
│  │                                                            │  │
│  │  Tools:                                                    │  │
│  │  ├── list_spreads                                          │  │
│  │  ├── draw_cards                                            │  │
│  │  └── request_interpretation ──┐                            │  │
│  └───────────────────────────────┼────────────────────────────┘  │
│                                  │                               │
│                                  ▼                               │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                  INTERPRETATION MODEL                      │  │
│  │                  (GPT 5.2 Thinking)                       │  │
│  │                                                            │  │
│  │  - Deep, nuanced spread interpretation                     │  │
│  │  - Reasoning over card relationships                       │  │
│  │  - Output streamed back through mini                       │  │
│  └───────────────────────────────────────────────────────────┘  │
│                          │                                       │
│                          ▼                                       │
│                       USER                                       │
└─────────────────────────────────────────────────────────────────┘
```

---

## Model Roles

### Conversation Model (GPT 5.2 mini)

**Purpose:** Fast, conversational responses that maintain flow and rapport.

**Responsibilities:**
- Greet user and establish rapport
- Ask clarifying questions about the question/situation
- Choose appropriate spread for user's question (default behavior)
- Lay spreads and invoke interpretation
- Parse and present interpretation output seamlessly
- Handle follow-up questions about specific cards/positions
- Answer simple card meaning questions directly (no tool call)

**Latency target:** <1 second for first token (streaming)

**System prompt:** See `app/src/prompts/mini-system.ts`

---

### Interpretation Model (GPT 5.2 Thinking)

**Purpose:** Deep, nuanced spread analysis with reasoning.

**Responsibilities:**
- Interpret each card in its position (1-2 paragraphs per card)
- Synthesize entire spread in conversational context (1-2 paragraphs)
- Consider card-to-card relationships and patterns
- Address reversals meaningfully
- Connect to user's specific question

**Latency target:** 3-8 seconds total (acceptable for "interpretation" moments)

**System prompt:** See `app/src/prompts/thinking-system.ts`

---

## Tools

### `list_spreads`

Returns available spreads with their purpose and position meanings.

**Usage:** Mini calls this to choose an appropriate spread for the user's question. By default, mini chooses — only defers to user if they insist.

**Context behavior:** Tool results are **ephemeral** — not persisted to conversation history. After mini makes its choice, only the decision is recorded, not the full spread list.

```json
{
  "name": "list_spreads",
  "description": "List available spreads with their purpose and position meanings. Use this to choose an appropriate spread for the user's question.",
  "parameters": {}
}
```

---

### `draw_cards`

Lays a spread by drawing cards via RNG cascade (QRNG → random.org → slot machine).

**Parameters:**
- `spread_slug` (string): Slug of built-in spread, OR
- `custom_positions` (array): For custom spreads, array of position meanings
- `question` (string): The user's question for this reading

```json
{
  "name": "draw_cards",
  "description": "Lay a spread by drawing cards. For built-in spreads, provide spread_slug. For custom spreads, provide custom_positions array.",
  "parameters": {
    "type": "object",
    "properties": {
      "spread_slug": {
        "type": "string",
        "description": "Slug of built-in spread (e.g., 'diamond', 'two_paths')"
      },
      "custom_positions": {
        "type": "array",
        "items": { "type": "string" },
        "description": "For custom spreads: array of position meanings"
      },
      "question": {
        "type": "string",
        "description": "The user's question for this reading"
      }
    },
    "required": ["question"]
  }
}
```

---

### `request_interpretation`

Invokes the thinking model for deep spread interpretation.

**Behavior:** Connects to the thinking model, which streams its interpretation back through mini as if mini generated it. The user experiences one seamless voice.

```json
{
  "name": "request_interpretation",
  "description": "Request a deep interpretation of the current spread. Call after laying a spread. The interpretation will flow through you seamlessly.",
  "parameters": {
    "type": "object",
    "properties": {
      "focus_area": {
        "type": "string",
        "description": "Optional: specific card or aspect to emphasize"
      }
    }
  }
}
```

---

## Context Management

### What Mini Always Sees

1. **System prompt** — persona, behavior, tool definitions
2. **Last 20 messages** — user + assistant turns
3. **Summary text** — compressed history beyond last 20
4. **Active spread** — current spread with question, cards, positions
5. **Spread ledger** — summary of previous spreads in session

### What Thinking Model Receives

1. **System prompt** — interpretation-focused
2. **Question** — user's question for this spread
3. **Conversation context** — recent exchanges leading to this spread
4. **Spread data** — name, purpose, cards with positions and meanings
5. **Spread ledger** — summary of past spreads (if any)

### Ephemeral Tool Results

Tool calls that produce reference data (like `list_spreads`) are **not persisted** to conversation history. Implementation:

```typescript
// When saving to conversation history:
if (message.role === 'tool' && message.name === 'list_spreads') {
  // Skip — ephemeral reference material
  continue;
}
```

---

## Streaming Strategy

To minimize perceived latency when interpretation is requested:

1. **Mini streams a bridge message:**
   > "Let me look deeper into this spread..."

2. **Thinking model streams through mini:**
   - Backend invokes thinking model
   - Response streams in real-time
   - Chunks pass through to client as mini's voice

3. **Mini adds closing (optional):**
   > "...that's what I see here. What resonates with you?"

---

## Error Handling

| Scenario | Behavior |
|----------|----------|
| Thinking model timeout | Mini apologizes, offers to retry: "The cards are being stubborn... let me try again." |
| Thinking model error | Mini provides abbreviated interpretation from its own knowledge |
| Rate limit | Queue request, show "Reading in progress..." |
| Context overflow | Summarize older spreads more aggressively |

---

## Metrics to Track

- **Time to first token** (mini responses) — target: <1s
- **Interpretation total time** — target: <10s
- **Tool call accuracy** — is mini calling tools at appropriate moments?
- **User satisfaction** — does conversation feel seamless?
