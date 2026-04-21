# Sync Concurrency Increase + Throttle/Drop Logging + Dashboard Sync Panel

**Date:** 2026-04-21  
**Status:** Approved

## Overview

Three coordinated changes to improve sync throughput visibility and surface the sync status on the dashboard:

1. Raise the default Ketch concurrency from 8 to 48
2. Add throttle/drop classification and logging to `ketchSync.js`
3. Replace the backup-stale banner on the Dashboard with a persistent sync status panel featuring a premium animated progress bar

---

## 1. Concurrency Change

### What changes

In `server/src/ketchSync.js` line 30, change the default for `SITENAVIGATOR_KETCH_CONCURRENCY` from `8` to `48`:

```js
const ketchConcurrency = Math.max(1, Number(process.env.SITENAVIGATOR_KETCH_CONCURRENCY || 48));
```

### Rationale

With 4 vendors and a per-host concurrency cap of 2 inside Ketch, the real throughput ceiling is approximately `num_distinct_hosts × 2`. At 8 workers, the pool is starved. At 48, workers fill efficiently across all vendor domains without breaching the per-host cap ceiling (~64) or triggering remote rate limits. The env var override remains available for tuning.

### Out of scope

The legacy crawler's `CONCURRENCY = 8` constant in `crawler.js` is unchanged — it only applies when the Ketch engine is unavailable.

---

## 2. Throttle/Drop Classification and Logging

### New function: `classifyKetchError(record)`

A single utility function added near the top of `ketchSync.js`, after the constants block. Takes a raw Ketch JSON record and returns:

```js
{ type: "throttle" | "drop" | "error", detail: string }
```

**Classification rules** (applied in order):

| Signal | Type | Match |
|--------|------|-------|
| `record.statusCode === 429` | `throttle` | Exact |
| Stringified error matches `/429\|rate.?limit\|too many request/i` | `throttle` | Regex |
| Stringified error matches `/ECONNRESET\|ECONNREFUSED\|connection reset\|EOF\|timed?\s*out\|i\/o timeout/i` | `drop` | Regex |
| Anything else | `error` | Fallback |

The `detail` field is always the raw stringified value of `record.error` (or `record.statusCode` if error is absent), so nothing is silently swallowed. Handles string, boolean, and object error shapes defensively.

### Stats additions

Two new counters added alongside `errorCount` everywhere stats are initialized, updated, and persisted:

- `throttledCount` — incremented when classifier returns `"throttle"`
- `droppedCount` — incremented when classifier returns `"drop"`

These are added to:
- The `stats` object in `runKetchIncrementalSync`
- The `syncProgress` object (initial reset + live updates)
- The `updateSyncRun` call at end of run (persisted to store)

### Updated error branch in `runSeedCrawl`

The existing `if (record?.error)` block (currently just increments `errorCount`) becomes:

```js
if (record?.error) {
  const { type, detail } = classifyKetchError(record);
  const url = String(record?.page?.url || record?.url || "");
  if (type === "throttle") {
    stats.throttledCount += 1;
    syncProgress.throttledCount = stats.throttledCount;
    syncLog(`[${vendorRun.id}] throttled: ${url} (${detail})`);
  } else if (type === "drop") {
    stats.droppedCount += 1;
    syncProgress.droppedCount = stats.droppedCount;
    syncLog(`[${vendorRun.id}] dropped: ${url} (${detail})`);
  } else {
    syncLog(`[${vendorRun.id}] error: ${url} (${detail})`);
  }
  stats.errorCount += 1;
  syncProgress.errorCount = stats.errorCount;
  continue;
}
```

Note: `errorCount` still increments for all three types — throttled and dropped pages are errors. The new counters are additive breakdowns, not replacements.

### Updated summary log lines

**Vendor done** (`runVendorCrawl`):
```
[duo] vendor done — 450 pages, 3 throttled, 1 dropped in 12.3s
```
Throttle/drop counts only appear when non-zero.

**Sync done** (`runKetchIncrementalSync`):
```
sync done — 1800 pages, 5 throttled, 2 dropped in 94.1s
```

---

## 3. Dashboard Sync Status Panel

### Removed

The `backupStale` conditional block in the `Dashboard` component ([App.jsx:1434-1451]) is removed entirely. The `backupStale` and `onQuickExport` props are removed from `Dashboard`'s prop signature. (The export functionality remains accessible via other UI paths — this only removes the banner.)

### Added: `SyncStatusPanel` component

A new self-contained component in `App.jsx`, rendered as the first child of the `Dashboard` content area. It receives `syncState` as its only prop — the same object already polled and available in the parent.

**Always visible** — not conditional on sync being in progress.

#### Idle state (no sync running)

Shows last sync summary on a single line:
```
Engine Ketch · Last sync: 2026-04-21T03:32:57Z · duration 47m 42s · scanned 20667 · new 20667 · changed 0
```
If throttled/dropped counts from the last run are non-zero, they appear inline:
```
· 3 throttled · 1 dropped
```
Progress bar is shown at 100% fill, no shimmer, subdued opacity (`opacity-40`).

#### Active state (sync in progress)

Full panel:
1. **Last run summary line** (same as idle, from `syncState.lastRun`)
2. **Animated progress bar** (see below)
3. **Live stats line**: `Ketch · vendor 2/4 · pages scanned 14827 · new 14827 · changed 0 · active vendor Ping Identity`  
   — throttle/drop counts appended when non-zero: `· 3 throttled · 1 dropped`
4. **Current page line**: `Current page: https://docs.pingidentity.com/...` (truncated)

#### Progress bar visual spec

```
Track:   bg-slate-800/60, h-2.5, rounded-full, ring-1 ring-slate-700/50
Fill:    bg-gradient-to-r from-blue-500 via-indigo-500 to-violet-500
         box-shadow: 0 0 8px 1px rgba(99,102,241,0.5)   (indigo glow)
         background-size: 200% 100%
         transition: width 500ms ease-out
Shimmer: @keyframes shimmer { 0% { background-position: 200% 0 } 100% { background-position: -200% 0 } }
         animation: shimmer 2s linear infinite  (active state only)
         @media (prefers-reduced-motion) { animation: none }
Idle:    gradient fill at 100%, no shimmer, opacity-40 on fill element
```

The glow intensity does not animate — it is a static shadow applied only during active state.

#### Panel container

Uses existing glass card CSS variables for consistency with the rest of the dashboard:
```css
background: var(--glass-bg)
border: 1.5px solid var(--glass-border)
box-shadow: var(--glass-shadow)
backdrop-filter: blur(var(--glass-blur))
border-radius: var(--glass-radius)
padding: 1rem
```

### Dashboard prop changes

| Prop | Before | After |
|------|--------|-------|
| `backupStale` | required | removed |
| `onQuickExport` | required | removed |
| `syncState` | not present | added |

The parent call site updates accordingly.

---

## Testing

### Server

- Existing `ketch-sync.test.js` — add unit tests for `classifyKetchError`:
  - Returns `throttle` for `{ statusCode: 429 }`
  - Returns `throttle` for `{ error: "429 Too Many Requests" }`
  - Returns `throttle` for `{ error: "rate limit exceeded" }`
  - Returns `drop` for `{ error: "ECONNRESET" }`
  - Returns `drop` for `{ error: "connection timed out" }`
  - Returns `error` for `{ error: "404 Not Found" }`
  - Returns `error` for `{ error: true }` (boolean — detail is "true")

### Client

- Manual: start a sync and confirm the panel renders in the dashboard with live updates
- Manual: confirm the backup stale banner is gone
- Manual: confirm idle state shows last run summary with subdued bar
- Manual: confirm shimmer animates during sync and stops when complete
- Manual: confirm `prefers-reduced-motion` disables shimmer

---

## Files Changed

| File | Change |
|------|--------|
| `server/src/ketchSync.js` | Default concurrency 8→48; add `classifyKetchError`; update error branch; update stats/progress/logs |
| `server/tests/ketch-sync.test.js` | Add `classifyKetchError` unit tests |
| `client/src/App.jsx` | Add `SyncStatusPanel`; update `Dashboard` props; remove backup stale banner; thread `syncState` to Dashboard |
