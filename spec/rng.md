# RNG Spec (MVP)

## Goal
Draw tarot cards with **uniform probability** across all cards, with random reversal (expected **~50/50** over large samples), using **ANU QRNG** as the default source of entropy. If ANU is unavailable, fall back to **random.org**, and if that fails, fall back to a **slot-machine click** mechanic.

This spec defines the **required algorithm**, **API contracts**, and **fallback behavior**. Implementations must follow this exactly.

---

## Definitions

- **Base card**: a tarot card ID in the range `0..77` (canonical order).
- **Oriented card state**: one of `156` equally likely states representing:
  - `0..77` = upright
  - `78..155` = reversed
- **allowDuplicates**:
  - `false` = do not repeat the same **base card** in a single draw batch
  - `true` = repetition allowed

- **allowReversals**:
  - `false` = system draws must be upright (reversed=false)
  - `true` = reversals allowed for system draws

Notes:
- `allowReversals` applies only to system draws (QRNG/random/slot). Manual entry always lets the user choose orientation.
- Do not balance reversals across a batch; randomness may skew in small samples.

---

## Entropy source (ANU QRNG)

### Endpoint
- Base URL: `https://api.quantumnumbers.anu.edu.au`
- Request:
  - method: `GET`
  - headers: `x-api-key: <ANU_QRNG_API_KEY>`
  - query params:
    - `type=uint16`
    - `length=<L>` where `L <= 1024` per request

Response JSON contains a `data` array of integers in `[0..65535]`.

---

## Uniform mapping (critical)

### Problem
Using `num % M` is biased unless `M` divides `65536`.

### Solution: rejection sampling
Use:
- `M = 156`
- `limit = floor(65536 / M) * M`

Accept only numbers where:
- `num < limit`

Then compute:
- `card = num % M`  (uniform in `0..155`)

Derived values:
- `base_idx = card % 78`  (uniform in `0..77`)
- `reversed = (card >= 78)` (expected ~50/50 over large samples)
- If `allowReversals=false`, force `reversed=false`

---

## Uniqueness rule (when allowDuplicates=false)
Track a set of used base card IDs:

- If `allowDuplicates=false`:
  - only accept a candidate if `base_idx` not in `used_set`
  - add `base_idx` to `used_set` when accepted
- If `allowDuplicates=true`:
  - do not track / enforce uniqueness

Hard rule:
- if `allowDuplicates=false` and `n > 78`, return an error (cannot draw >78 unique base cards).

---

## Draw loop behavior
To draw `n` cards:

1. Initialize:
   - `draws = []`
   - `used_base = set()` (only if `allowDuplicates=false`)
   - `attempts = []` (for provenance)

2. While `len(draws) < n`:
   - `needed = n - len(draws)`
   - request `length = min(needed, 1024)` numbers from ANU
   - for each `num` returned:
     - if `num >= limit`: reject (bias prevention)
     - compute `card = num % 156`
     - compute `base_idx = card % 78`
     - if uniqueness enforced and `base_idx in used_base`: reject
     - accept:
       - `cardId = base_idx`
       - `reversed = card >= 78`
      - if `allowReversals=false`, force `reversed=false`
       - append `{ cardId, reversed }` to `draws`
       - if uniqueness enforced: add base_idx to used_base
   - continue until `n` accepted

3. Return draws + provenance.

---

## Required output format

A draw returns an array of:

```json
[
  { "cardId": 12, "reversed": false },
  { "cardId": 55, "reversed": true }
]

