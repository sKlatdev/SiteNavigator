# Plan B Design — Server-Side Gap Analysis with GitNexus

**Goal:** Move Smart Gap Finder computation server-side, backed by GitNexus BM25+semantic search, while keeping the existing token-matcher as a transparent fallback.

**Depends on:** Plan A (GitNexus integration — `graphQueryClient`, `/api/compare/related`, `--output-dir` crawl output).

**Independent of:** Plan C (Clone Duo disambiguation).

---

## Architecture

A new `POST /api/gap/analyze` endpoint accepts batches of competitor items and returns gap findings. The client gap `useEffect` calls a new `fetchGapItems()` helper instead of running `relationScore` inline. When GitNexus is unavailable, `fetchGapItems` falls back silently to the existing token-matcher — no UI change, no regression.

Debug logging for all fallback paths is gated behind `DEBUG_GITNEXUS=true` on the server and `localStorage.debug = 'gitnexus'` on the client.

---

## File Map

| Path | Action | Responsibility |
|------|--------|----------------|
| `server/src/server.js` | Modify | Add `POST /api/gap/analyze` route |
| `server/tests/gapAnalyze.test.js` | Create | Unit tests for endpoint shape and fallback |
| `client/src/features/sitenavigator/gapAnalysis.js` | Create | `fetchGapItems()` with server-first + token-matcher fallback |
| `client/src/App.jsx` | Modify | Make gap `step()` async, call `fetchGapItems` per chunk |

---

## Component Designs

### `POST /api/gap/analyze` (server.js)

**Request body:**
```json
{
  "competitorItems": [{ "id": "...", "title": "...", "summary": "...", "vendor": "...", "url": "..." }],
  "limit": 3
}
```

**Behavior:**
- For each competitor item, call `graphQueryClient.search(item.title + " " + item.summary, { limit })` to find Duo counterparts.
- Map results to gap finding shape: `{ id, title, summary, vendor, url, severity, gapType, whyFlagged, relatedDuoTitle, relationScore, evidenceCount, tags }`.
- Severity scoring mirrors current client logic: `severityScore = spreadScore + recencyScore + Math.max(0, 6 - relationScore)`.
- When `!graphQueryClient.isAvailable()`: return `{ ok: false, fallback: true, message: "GitNexus unavailable" }`.
- Debug log (when `process.env.DEBUG_GITNEXUS`): log fallback reason and item count.

**Response (success):**
```json
{ "ok": true, "findings": [...] }
```

**Response (fallback):**
```json
{ "ok": false, "fallback": true, "message": "GitNexus unavailable" }
```

### `gapAnalysis.js` (new client module)

```js
// fetchGapItems: calls /api/gap/analyze, falls back to inline token-matcher on error or fallback:true.
// Returns array in the same shape App.jsx currently builds in the gap useEffect.
export async function fetchGapItems(competitorItems, duoCatalog, feedbackSnapshot, options = {})
```

- On `fallback: true` or network error: call existing inline computation (extracted into `computeGapItemsLocally()`), log to `console.debug` if `localStorage.debug === 'gitnexus'`.
- Returns same item shape as today — App.jsx `setSmartGapItems` call is unchanged.

### App.jsx gap `useEffect`

- Extract current inline gap computation into `computeGapItemsLocally(competitorItems, duoItems, feedbackSnapshot)` — pure function, no state calls.
- `step()` becomes `async`; `slice.forEach` → `await Promise.all(slice.map(async ...))`.
- Call `fetchGapItems(slice, catalog, feedbackSnapshot)` per chunk.
- `cancelled` flag checked before `setSmartGapItems` — same as Compare Mode pattern.
- `step(0)` → `step(0).catch(() => {})`.

---

## Data Flow

```
User opens Smart Gap Finder → runSmartGapAnalysis() → smartGapRunNonce++
→ gap useEffect fires
→ step(0) [async]
  → fetchGapItems(slice, catalog, feedbackSnapshot)
    → POST /api/gap/analyze
      → graphQueryClient.search() per competitor item   [GitNexus available]
      → returns findings with semantic scores
    → OR: computeGapItemsLocally()                      [fallback — silent]
  → setSmartGapItems(partial)
→ step(nextIndex) [recursive, awaited]
```

---

## Error Handling

| Scenario | Behavior |
|----------|----------|
| GitNexus unavailable | Server returns `fallback: true` → client falls back inline, `console.debug` logs reason |
| Server timeout >10s | `fetchGapItems` catches, falls back inline, `console.debug` logs |
| `cancelled` during async step | Check before `setSmartGapItems`, skip — same as today |
| Partial chunk failure | Catch per-chunk, fall back that chunk inline, continue |

---

## Testing

**`server/tests/gapAnalyze.test.js`:**
- Returns `{ ok: false, fallback: true }` when `graphQueryClient.isAvailable() === false`
- Returns `{ ok: true, findings: [...] }` with correct shape when client is mocked available
- `findings[n].severity` is one of `"high" | "medium" | "low"`

**Client smoke test (dev server):**
- GitNexus unavailable → gap results identical to current behavior (fallback confirmed)
- GitNexus available → gap results sourced from server (check Network tab for `/api/gap/analyze` 200)
- `DEBUG_GITNEXUS=true` + `localStorage.debug = 'gitnexus'` → fallback reason logged

---

## Self-Review Notes

- Severity scoring is duplicated (client + server). The server copy is authoritative when GitNexus is available; the client copy is the fallback. If scoring logic changes, update both — a shared `gapScoring.js` is YAGNI until there's a third consumer.
- `competitorItems` payload could be large for big catalogs. Chunking at the call site (same `chunkSize = 20` as today) keeps individual requests small.
- `feedbackSnapshot` stays client-only — the server doesn't need it; dismissed/confirmed filtering happens after `fetchGapItems` returns, same as today.
