# Tarot App — Mobile UI Specification

This document defines the mobile-first UI for the AI Tarot Reader MVP. The design prioritizes **simultaneous access to spread and conversation** while maintaining a fluid chat experience.

---

## Design Philosophy

- **AI-first**: The core experience is a conversation with an AI reader, not a manual tool
- **Mobile-native**: Designed for portrait mobile screens; desktop is a secondary concern
- **Spread visibility**: The active spread should be accessible without leaving the conversation
- **Low friction**: Minimize taps to access information

---

## Visual Design

The app uses a **warm parchment minimal** aesthetic—premium, calm, and editorial. See `Design_Brief.txt` and `Design_Tokens.json` for complete specifications.

**Key principles:**
- Warm parchment neutrals + muted brass accents
- Rider–Waite card colors remain the hero
- Museum label / book paper / quiet luxury vibe
- No gradients beyond extremely soft vignettes
- Subtle pressed-paper texture on spread stage

---

## Spread View States

The spread viewer has **three states** that control screen real estate distribution:

| State | Spread Area | Chat Area | Use Case |
|-------|-------------|-----------|----------|
| **Expanded** | 75% of screen | 25% visible | Detailed card inspection during reading |
| **Compact** | 50% of screen | 50% visible | Default view during conversation |
| **Collapsed** | Header only (44px) | Full screen | Focused typing/chatting |

### State Behaviors

**Expanded (75%)**
- Cards displayed at larger size for detail inspection
- Spread label shows question/title
- Tap individual card → card flips to show meaning
- Toggle button to contract to Compact

**Compact (50%)**
- Default conversational state
- Cards displayed at recognizable but compact size
- Spread label visible
- Toggle button to expand or collapse

**Collapsed (Header Only)**
- Spread area contracts to just the header bar (44px)
- Spread title/name visible in header
- Chat area maximizes for typing
- Tap header or toggle to expand back

**Auto-collapse behavior:** The spread automatically contracts when a message is sent (not on keyboard appearance).

---

## Layout Regions

### Header Bar
| Element | Description |
|---------|-------------|
| Left | Menu button (hamburger icon) |
| Center | Spread title / session name |
| Right | History button (clock icon) |

### Spread Stage
| Element | Description |
|---------|-------------|
| Cards | Laid out according to `layout_descriptor` |
| Controls | Expand/collapse toggle buttons below cards |
| Navigation | ← → arrows when multiple spreads exist |

### Chat Area
| Element | Description |
|---------|-------------|
| Messages | Scrollable, newest at bottom |
| Input | Text field + send button at bottom |

---

## Multi-Spread Navigation

When session contains multiple spreads (follow-up questions, clarifications):

| Element | Behavior |
|---------|----------|
| **← / → Arrows** | Navigate between spreads (only visible when >1 spread) |
| **Dot indicator** | Shows position (e.g., ●○○ = first of three) |
| **Spread label** | Updates to show question/title for current spread |

**Order:** Chronological (oldest left, newest right). The most recent spread is always visible by default.

---

## Component Breakdown

### SpreadViewer
- Renders cards in layout grid based on `layout_descriptor`
- Adapts card size based on view mode (expanded/compact)
- Handles expand/collapse/collapsed state transitions
- Emits: `onCardTap(cardIndex)`, `onExpandRequest`, `onCollapseRequest`

### SpreadNavigator
- Renders ← → arrows and dot indicator
- Tracks `currentSpreadIndex` and `totalSpreads`
- Emits: `onNavigate(direction)`

### ChatPanel
- Scrollable message list
- Auto-scroll on new messages
- Message types: user, assistant, system (spread laid notification)
- Typing indicator for AI responses

### CardDetailModal
- Overlay showing single card details
- Displays: card image, name, orientation, meaning, position meaning
- Dismiss on tap outside or swipe down

---

## State Machine

```
                    ┌────────────────────────┐
                    │       COLLAPSED        │
                    │   (Header only 44px,   │
                    │    chat maximized)     │
                    └───────────┬────────────┘
                                │ expand
                    ┌───────────┴───────────┐
                    │                       │
                    ▼                       │
          ┌─────────────────┐               │
          │     COMPACT     │◄──────────────┤
          │   (50% spread,  │    contract   │
          │    50% chat)    │               │
          └────────┬────────┘               │
                   │ expand                 │
                   ▼                        │
          ┌─────────────────┐               │
          │    EXPANDED     │───────────────┘
          │   (75% spread,  │    collapse
          │    25% chat)    │
          └─────────────────┘
```

**Transitions:**
- Tap expand button → move up one state (collapsed → compact → expanded)
- Tap collapse/contract button → move down one state
- Tap header (in collapsed mode) → expand to compact
- Send message → auto-collapse to compact
- Spread navigation (L/R) available in compact and expanded states

---

## Side Menus

### Left Menu (Settings)
- Triggered by hamburger button in header
- Slide-out drawer from left
- Contains: "Include reversals" toggle, "Allow duplicates" toggle

### Right Menu (History)
- Triggered by clock button in header
- Slide-out drawer from right
- Contains: Past sessions list, search history button

---

## Responsive Considerations

### Mobile (Primary Target)
- Portrait orientation assumed
- Bottom 40% reserved for keyboard when typing
- Minimum touch targets: 44×44 pts

### Tablet / Desktop (Secondary)
- Could use side-by-side layout (spread left, chat right)
- Not in MVP scope — default to mobile layout scaled

---

## Animation Guidelines

| Transition | Duration | Easing |
|------------|----------|--------|
| Spread expand/contract | 300ms | ease-in-out |
| Spread collapse to header | 250ms | ease-out |
| Header expand to spread | 300ms | ease-in-out |
| Spread navigate (L/R) | 200ms | ease-in-out |
| Card flip (reveal) | 400ms | ease-in-out |
| Modal appear/dismiss | 250ms | ease-out |
| Drawer slide in/out | 300ms | ease-in-out |

All animations should respect `prefers-reduced-motion`.
