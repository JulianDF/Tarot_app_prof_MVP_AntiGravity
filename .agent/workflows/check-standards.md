---
description: Review project standards and architectural rules
---

# Project Standards Check

Before making architectural changes or significant features, review these documents:

## 1. Review CONTRIBUTING.md
Read `/CONTRIBUTING.md` to understand:
- Core principles (small reversible changes, specs as source of truth, clear boundaries)
- Project boundaries (UI vs logic vs domain)
- Feature flag discipline
- Refactoring policy (1:5 rule)
- AI/vibe-coding rules

## 2. Check Architectural Boundaries

### Domain Layer (`src/domain/`)
- Pure functions and types only
- No React, no network calls, no global state
- Deterministic where possible
- Easy to test

### Components (`src/components/`)
- Prefer "dumb" components (props in, UI out)
- Avoid business logic and data transforms

### Hooks/State (`src/hooks/`, `src/state/`)
- Orchestration layer
- Fetching, state transitions, calling domain functions
- Feature-flagged behavior

### Config (`src/config/`)
- Feature flags in `src/config/features.ts`
- Environment config
- Constants

## 3. Feature Flag Requirements

When adding experimental features:
- Define flags in `src/config/features.ts` (single source of truth)
- Use a single "gate" module per area
- Document the flag lifecycle (keep or kill)
- Flag must be removable in one commit
- Do NOT use flags for: data model, persistence schema, security, or correctness-critical logic

## 4. Definition of Done

Before considering work complete:
- [ ] `npm run build` passes
- [ ] TypeScript passes (no `@ts-ignore` unless documented)
- [ ] Lint passes
- [ ] No new runtime console errors
- [ ] Manual smoke testing (happy path + one edge case)
- [ ] Dead code removed
- [ ] No debug logs left
- [ ] Flags not scattered across files

## 5. AI-Specific Rules

When working with AI-generated code:
1. Integrate in small slices, not big pastes
2. Enforce layer boundaries (domain vs hooks vs UI)
3. Avoid "mystery fixes" - if you don't understand it, revert and redo smaller
4. Prefer deletion over patching
5. One experiment at a time

## 6. PR Self-Review Checklist

Use `.github/pull_request_template.md` as a self-review guide even when working solo.
