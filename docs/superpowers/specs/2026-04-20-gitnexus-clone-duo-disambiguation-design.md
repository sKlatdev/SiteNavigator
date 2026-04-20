# Plan C Design — GitNexus-Powered Clone Duo Disambiguation

**Goal:** Reduce `UNRESOLVED_AMBIGUOUS` fields in Clone Duo drafts by querying the GitNexus graph to corroborate the most authoritative candidate value — no new AI provider required.

**Depends on:** Plan A (GitNexus integration — `graphQueryClient`).

**Independent of:** Plan B (gap analysis).

---

## Architecture

A new `cloneDuoGraphResolver.js` module exposes `resolveAmbiguityWithGraph()`. When `cloneDuoMapping.js` detects `UNRESOLVED_AMBIGUOUS`, it calls this function before giving up. If GitNexus returns a clear winner (confidence ≥ 0.6), the field is promoted to `RESOLVED` with `resolvedBy: "graph"` metadata. If GitNexus is unavailable or scores are too close, the field stays `UNRESOLVED_AMBIGUOUS` — no regression.

Debug logging for all fallback paths is gated behind `process.env.DEBUG_GITNEXUS`.

---

## File Map

| Path | Action | Responsibility |
|------|--------|----------------|
| `server/src/cloneDuoGraphResolver.js` | Create | `resolveAmbiguityWithGraph()` — query + scoring |
| `server/tests/cloneDuoGraphResolver.test.js` | Create | Unit tests: unavailable, clear winner, too-close tie |
| `server/src/cloneDuoMapping.js` | Modify | Call resolver on `UNRESOLVED_AMBIGUOUS`; `resolveFieldState` → async |

---

## Component Designs

### `cloneDuoGraphResolver.js` (new)

```js
// resolveAmbiguityWithGraph: for each candidate value, queries GitNexus and picks
// the most-corroborated value. Returns { resolvedValue, confidence, evidenceUrls }
// or null if unavailable or scores too close to call.
export async function resolveAmbiguityWithGraph(field, candidateValues, context)
```

**Algorithm:**
1. If `!graphQueryClient.isAvailable()`: log debug, return `null`.
2. For each candidate value: call `graphQueryClient.search(value + " " + field.label, { limit: 3 })`.
3. Score each candidate: sum of `item.score` across its search results.
4. If top candidate score ≥ 0.6 AND top score - second score ≥ 0.15 (clear margin): return `{ resolvedValue: topCandidate, confidence: topScore, evidenceUrls: [...] }`.
5. Otherwise (tie or low confidence): log debug with scores, return `null`.

**`context`** is passed for logging only (field label, source page URL) — not used in scoring.

### `cloneDuoMapping.js` (modified)

- `resolveFieldState` becomes `async`.
- After setting `state.status = FIELD_STATUS.UNRESOLVED_AMBIGUOUS`:

```js
const graphResult = await resolveAmbiguityWithGraph(field, uniqueValues, { fieldId: field.id });
if (graphResult) {
  state.status = FIELD_STATUS.RESOLVED;
  state.value = graphResult.resolvedValue;
  state.resolvedBy = "graph";
  state.graphConfidence = graphResult.confidence;
  state.graphEvidenceUrls = graphResult.evidenceUrls;
}
```

- `buildCloneDuoDraft` calls `resolveFieldState` inside `fieldDefinitions.map(...)` — change to `await Promise.all(fieldDefinitions.map(async (field) => resolveFieldState(field, evidence)))`.
- All callers of `buildCloneDuoDraft` are async already (`/api/clone-duo/saml/transform` handler) — no signature changes needed upstream.

---

## Data Flow

```
POST /api/clone-duo/saml/transform
→ buildCloneDuoDraft({ sourceItems, sourceBundle, blueprintFamily })
  → await Promise.all(fields.map(resolveFieldState))
    → if UNRESOLVED_AMBIGUOUS:
      → resolveAmbiguityWithGraph(field, candidates)
        → graphQueryClient.search() per candidate    [GitNexus available, clear margin]
        → returns { resolvedValue, confidence }
        → state: RESOLVED, resolvedBy: "graph"
        → OR: null → state stays UNRESOLVED_AMBIGUOUS [unavailable or tie]
  → buildSectionDraft, buildTransformIssues (unchanged)
→ enhanceCloneDuoDraft (unchanged)
```

---

## Error Handling

| Scenario | Behavior |
|----------|----------|
| GitNexus unavailable | `resolveAmbiguityWithGraph` returns `null`, field stays `UNRESOLVED_AMBIGUOUS`, `console.debug` logs |
| Search throws | Caught inside resolver, returns `null`, same fallback |
| Confidence < 0.6 | Returns `null` — don't guess if not confident |
| Score margin < 0.15 (tie) | Returns `null` — ambiguity is genuine, let reviewer decide |
| Single candidate value | `UNRESOLVED_AMBIGUOUS` only fires for 2+ values — resolver never called for singles |

---

## `resolvedBy: "graph"` in the UI

The `FIELD_STATUS.RESOLVED` state is already rendered in `CloneDuoWorkspace.jsx`. Fields promoted by the graph resolver will show as resolved. The `resolvedBy: "graph"` metadata is stored on the field state for future use (e.g., a "resolved by graph search" badge), but no UI change is required in this plan — the reviewer simply sees fewer unresolved fields.

---

## Testing

**`server/tests/cloneDuoGraphResolver.test.js`:**
- Returns `null` when `graphQueryClient.isAvailable() === false`
- Returns `{ resolvedValue, confidence }` for the higher-scored candidate when mocked search returns distinct scores
- Returns `null` when top two candidates have margin < 0.15 (tie)
- Returns `null` when top confidence < 0.6

**Integration smoke test:**
- Build a source bundle with a page known to have conflicting Entity ID values
- Call `/api/clone-duo/saml/transform` with GitNexus available + indexed
- Confirm `UNRESOLVED_AMBIGUOUS` count is lower than without graph resolver
- With `DEBUG_GITNEXUS=true`: confirm debug logs show resolution decisions

---

## Self-Review Notes

- Confidence threshold (0.6) and margin (0.15) are initial estimates — tune after seeing real data. Values are constants at the top of `cloneDuoGraphResolver.js`, easy to adjust.
- The resolver makes N search calls (one per candidate value). For fields with 2-3 candidates this is fine; for pathological cases with many conflicts it could be slow. A 5s timeout guard per search call prevents hang.
- `resolvedBy: "graph"` is not part of the existing `FIELD_STATUS` enum — it's extra metadata on the field object. No schema migration needed; JSON serialization handles it transparently.
- This plan does not improve prose quality — that remains deterministic or openai-compatible per existing `cloneDuoGeneration.js`. Prose improvement is explicitly out of scope.
