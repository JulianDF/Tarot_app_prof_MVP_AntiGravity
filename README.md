# Tarot App (MVP)

An AI-first tarot reading experience built for mobile. Have an open, flowing conversation with an AI Tarot reader while spreads are displayed and accessible within the chat interface.

---

## What This MVP Proves

1. **Mobile UI**: Spreads (current and past) can be conveniently displayed during a mobile chat session
2. **Conversational AI**: Low-latency, flowing conversation without sacrificing quality or nuance
3. **Context Management**: AI remains anchored in relevant context across the entire interaction

---

## Repo Structure

- `/spec` — product specs + data contracts (source of truth)
  - `Feature list.txt` — MVP/V1/V2 scope
  - `Data Model.txt` — data types and contracts
  - `ui-spec.md` — mobile UI specification
  - `ai-architecture.md` — dual-model AI architecture
  - `cards.json` / `spreads.json` — static data
- `/app/src` — application code (Next.js + TypeScript)
- `/public` — static assets (card images, icons)

---

## Key Features

- **Chat-first experience**: Converse naturally with an AI reader
- **Pinned spread viewer**: See your spread while chatting
- **Multi-spread sessions**: Navigate between spreads laid in the same session
- **Dual-model AI**: Fast mini model for conversation, thinking model for deep interpretations
- **RNG cascade**: QRNG → random.org → slot-machine fallback

---

## Getting Started

### Requirements
- Node.js 18+ (recommended: 20+)
- npm (or pnpm/yarn)
- OpenAI API key

### Install
```bash
cd app
npm install
```

### Run
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)
