# Tarot App (MVP → V1)

A tarot-reading assistant that helps users lay spreads, view position + card meanings, and (in paid tiers later) get AI-generated interpretations and chat grounded in the active reading.

This repo is the implementation. The product requirements and data contracts live in `/spec`.

---

## Repo structure

- `/spec` — product specs + data contracts (treat as the “source of truth”)
  - `Feature list.txt`
  - `data-model.md`
  - `cards.with_image_paths.json`
  - `spreads.revised.json`
- `/src` — application code (Next.js + TypeScript)
- `/public` — static assets served directly (images, icons, etc.)

---

## MVP scope (high level)

- Load tarot card metadata from `cards.with_image_paths.json`
- Load standard spreads from `spreads.revised.json` + support custom spread creation (session-scoped)
- New reading flow: pick spread → enter question → draw cards
- RNG cascade: ANU QRNG (default) → random.org fallback → slot-machine click fallback
- Reading view: layout + card images + position meanings + card meanings
- AI one-shot interpretation (no chat in MVP)

See `/spec/Feature list.txt` for full MVP/V1/V2 scope.

---


## Getting started

### Requirements
- Node.js 18+ (recommended: 20+)
- npm (or pnpm/yarn)

### Install
```bash
npm install
