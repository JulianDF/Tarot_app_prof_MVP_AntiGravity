# Contributing

This project moves fast. These rules keep it maintainable.

If you are working solo, treat this as your “reviewer.”
If you are working with others, treat this as the shared contract.

---

## Core principles (non-negotiable)

### 1) Small, reversible changes
- Prefer small PRs.
- One PR should do one thing.
- If you’re experimenting, you must be able to revert quickly.

### 2) Specs/docs are the source of truth
- When behavior changes, update docs/specs first (even brief bullets).
- Code implements the spec; the spec doesn’t chase the code.

### 3) Clear boundaries (UI vs logic vs domain)
- UI renders.
- Hooks/state orchestrate.
- Domain functions compute.

---

## Workflow

### Branching
- Create a branch for any non-trivial change.
- Name it clearly: `ui-...`, `feat-...`, `fix-...`, `refactor-...`.

### Commit discipline
- Commit often (every 15–30 minutes during active work).
- Each commit should be coherent and describable.
- Use intent-based messages:
  - `ui: ...`
  - `feat: ...`
  - `fix: ...`
  - `domain: ...`
  - `refactor: ...`
  - `docs: ...`

---

## Feature flags (required for experiments)

### What a feature flag is
A feature flag is a boolean switch to toggle a feature/behavior ON/OFF without deleting old code mid-experiment.

### When to use flags
Use flags for:
- UI redesigns / component swaps
- alternative flows / interactions
- UX behavior changes
- animations / polish experiments

Do NOT use flags for:
- data model invariants
- persistence schema changes
- security logic
- randomness/correctness-critical logic

### Where flags live
- All flags are defined in `src/config/features.ts` (single source of truth).
- Use env overrides for quick local toggles:
  - `NEXT_PUBLIC_FLAG_SOMETHING=true`

### How to use flags cleanly
**Do not sprinkle flags everywhere.**
Use a single “gate” module per area:
- Example: `SpreadViewer.tsx` decides between old/new components.
- Keep the flagged logic contained.

### Flag lifecycle
Every flag must end in one of these outcomes:
- Keep: remove flag + delete old path
- Kill: delete new path + remove flag

Rule: a flag must be removable in one commit.

---

## Project boundaries (where code goes)

These are the intended layers:

### `src/domain/`
Pure functions/types:
- No React
- No network calls
- No direct global state
- Deterministic where possible
- Easy to test

### `src/components/`
UI components:
- Prefer “dumb” components (props in, UI out)
- Avoid business logic and data transforms inside components

### `src/hooks/` or `src/state/`
Orchestration:
- fetching
- state transitions
- calling domain functions
- UI side effects (scrolling, toasts, focus)
- feature-flagged behavior

### `src/config/`
- Feature flags
- environment config
- constants

Rule: if you catch yourself writing “rules” in a component, move it into `domain/` or a hook.

---

## Definition of Done (required before merging)

### Build & correctness
- `npm run build` passes
- TypeScript passes (no `@ts-ignore` unless documented)
- Lint passes
- No new runtime console errors

### Manual smoke testing
At minimum:
- Happy path for the changed feature
- One relevant edge case

### Code hygiene
- Remove dead code and commented-out blocks
- Remove unused imports/vars
- Remove debug logs
- Do not leave half-finished experiments unflagged
- Do not let flags accumulate

---

## Refactoring policy (prevents “code noodles”)

### 1:5 rule
For every ~5 hours of feature work, spend ~1 hour refactoring:
- move logic out of components
- extract repeated UI
- rename unclear types/variables
- delete dead paths and old flags

### Boy Scout rule
Whenever you touch a file, leave it slightly cleaner.

---

## AI / vibe-coding rules

AI-generated code can work while still being structurally wrong.

Rules:
1) Integrate in small slices, not big pastes.
2) Enforce layer boundaries (domain vs hooks vs UI).
3) Avoid “mystery fixes.” If you don’t understand it, revert and redo smaller.
4) Prefer deletion over patching. Git is your safety net.
5) One experiment at a time. Don’t mix multiple big ideas in one PR.

---

## PR checklist

Every PR should:
- explain intent (what + why)
- indicate whether a flag is used
- document manual testing
- confirm build/type/lint checks
- remove dead code

See `.github/pull_request_template.md`.

---

## Optional: decision log
For non-obvious architecture decisions, add a short entry in `docs/decisions.md`:
- Decision
- Why
- Revisit when

This helps future-you undo or evolve choices confidently.
