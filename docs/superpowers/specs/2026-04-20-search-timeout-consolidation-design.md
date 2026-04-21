# Design: Consolidate `searchWithTimeout` into `graphQueryClient.js`

**Date:** 2026-04-20  
**Status:** Approved

## Problem

`graphSearchWithTimeout` in `cloneDuoMapping.js` and `searchWithTimeout` in `cloneDuoGraphResolver.js` are identical in logic — both wrap `client.search()` in a `Promise.race()` with a 5 000 ms timeout and catch to `[]`. The duplication means any future change (timeout value, error handling, fallback shape) must be made in two places.

## Goal

Replace both private copies with a single exported utility in `graphQueryClient.js`, the natural owner of anything that wraps `client.search()`.

## Design

### `graphQueryClient.js` — new additions

Add after the existing `gitnexusBin` constant:

```js
const GRAPH_SEARCH_TIMEOUT_MS =
  Number(process.env.SITENAVIGATOR_GRAPH_SEARCH_TIMEOUT_MS) || 5_000;

export async function searchWithTimeout(query, opts, client) {
  return Promise.race([
    client.search(query, opts),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error("graph search timeout")), GRAPH_SEARCH_TIMEOUT_MS)
    ),
  ]).catch(() => []);
}
```

- Env var `SITENAVIGATOR_GRAPH_SEARCH_TIMEOUT_MS` follows the existing naming convention; defaults to `5_000`.
- Plain named export — no class involvement.

### `cloneDuoGraphResolver.js` — removals + import update

- Import `searchWithTimeout` from `./graphQueryClient.js`.
- Delete private `searchWithTimeout` function (lines 72–79).
- Delete `SEARCH_TIMEOUT_MS` constant (line 6). `SEARCH_LIMIT` stays — it is caller-specific.
- No call-site changes needed (same function name, same signature).

### `cloneDuoMapping.js` — removals + import update

- Import `searchWithTimeout` from `./graphQueryClient.js`.
- Delete private `graphSearchWithTimeout` function (lines 458–465) and `GRAPH_SEARCH_TIMEOUT_MS` constant (line 456).
- Rename the one call site: `graphSearchWithTimeout(query, { limit: 3 }, client)` → `searchWithTimeout(query, { limit: 3 }, client)`.

## Constraints

- No behavior changes — same signature, same default timeout, same `catch(() => [])` fallback.
- Existing tests that inject a mock `client` continue to work unchanged; `searchWithTimeout` accepts the client as a parameter.

## Environment Variable

| Variable | Default | Description |
|----------|---------|-------------|
| `SITENAVIGATOR_GRAPH_SEARCH_TIMEOUT_MS` | `5000` | Timeout in ms for `client.search()` calls via `searchWithTimeout` |

## Out of Scope

- Changing timeout behavior or fallback shape.
- Migrating other callers that may wrap `client.search()` directly.
- Updating CLAUDE.md (no new architectural pattern introduced).
