# Sync Concurrency + Throttle Logging + Dashboard Sync Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Raise Ketch concurrency to 48, add throttle/drop error classification with logging, and replace the dashboard backup banner with a persistent animated sync status panel.

**Architecture:** Server changes are self-contained in `ketchSync.js` — new `classifyKetchError` export, stats additions, updated error branch and log lines. Client changes add a new `SyncStatusPanel` component to `App.jsx` that consumes the existing polled `syncState` object, replacing the `backupStale` banner in `Dashboard`. Shimmer animation CSS goes in `index.css`.

**Tech Stack:** Node.js 22, React 19, Tailwind CSS, Vite

---

## File Map

| File | Change |
|------|--------|
| `server/src/ketchSync.js` | Export `classifyKetchError`; update default concurrency; add `throttledCount`/`droppedCount` to stats/progress/store; update error branch; update log lines |
| `server/tests/ketch-sync.test.js` | Add 7 unit tests for `classifyKetchError` |
| `client/src/index.css` | Add `@keyframes shimmer` |
| `client/src/App.jsx` | Add `SyncStatusPanel` component; update `Dashboard` to remove backup banner and add `syncState` prop; update parent call site |

---

## Task 1: Export `classifyKetchError` and write failing tests

**Files:**
- Modify: `server/src/ketchSync.js` (add export stub)
- Modify: `server/tests/ketch-sync.test.js`

- [ ] **Step 1: Add a stub export for `classifyKetchError` in `ketchSync.js`**

Add this block immediately after the `slowCrawlPageMs` constant on line 31 (before the `syncLog` function):

```js
export function classifyKetchError(record) {
  // stub — will be implemented in Task 2
  void record;
  return { type: "error", detail: "" };
}
```

- [ ] **Step 2: Add failing tests to `server/tests/ketch-sync.test.js`**

Append these tests after the last existing `test(...)` block:

```js
import { classifyKetchError } from "../src/ketchSync.js";

test("classifyKetchError: statusCode 429 is throttle", () => {
  const { type, detail } = classifyKetchError({ statusCode: 429 });
  assert.equal(type, "throttle");
  assert.ok(detail.includes("429"));
});

test("classifyKetchError: error string '429 Too Many Requests' is throttle", () => {
  const { type } = classifyKetchError({ error: "429 Too Many Requests" });
  assert.equal(type, "throttle");
});

test("classifyKetchError: error string 'rate limit exceeded' is throttle", () => {
  const { type } = classifyKetchError({ error: "rate limit exceeded" });
  assert.equal(type, "throttle");
});

test("classifyKetchError: ECONNRESET is drop", () => {
  const { type } = classifyKetchError({ error: "ECONNRESET" });
  assert.equal(type, "drop");
});

test("classifyKetchError: 'connection timed out' is drop", () => {
  const { type } = classifyKetchError({ error: "connection timed out" });
  assert.equal(type, "drop");
});

test("classifyKetchError: 404 Not Found is error", () => {
  const { type } = classifyKetchError({ error: "404 Not Found" });
  assert.equal(type, "error");
});

test("classifyKetchError: boolean error true is error with detail 'true'", () => {
  const { type, detail } = classifyKetchError({ error: true });
  assert.equal(type, "error");
  assert.equal(detail, "true");
});
```

- [ ] **Step 3: Run the tests and confirm they fail**

```bash
npm run test --prefix server
```

Expected: 7 new tests fail — `type` will be `"error"` for all and `detail` will be `""`.

---

## Task 2: Implement `classifyKetchError`

**Files:**
- Modify: `server/src/ketchSync.js`

- [ ] **Step 1: Replace the stub with the real implementation**

Replace the stub added in Task 1 with:

```js
export function classifyKetchError(record) {
  const detail = record.error != null
    ? (typeof record.error === "string" ? record.error : JSON.stringify(record.error))
    : String(record.statusCode ?? "unknown error");
  if (record.statusCode === 429 || /429|rate.?limit|too many request/i.test(detail)) {
    return { type: "throttle", detail };
  }
  if (/ECONNRESET|ECONNREFUSED|connection reset|EOF|timed?\s*out|i\/o timeout/i.test(detail)) {
    return { type: "drop", detail };
  }
  return { type: "error", detail };
}
```

- [ ] **Step 2: Run the tests and confirm they all pass**

```bash
npm run test --prefix server
```

Expected: all existing tests pass, all 7 new tests pass.

- [ ] **Step 3: Commit**

```bash
git add server/src/ketchSync.js server/tests/ketch-sync.test.js
git commit -m "feat(sync): add classifyKetchError with throttle/drop detection"
```

---

## Task 3: Raise default concurrency to 48

**Files:**
- Modify: `server/src/ketchSync.js:30`

- [ ] **Step 1: Change the default**

On line 30 of `server/src/ketchSync.js`, change:

```js
const ketchConcurrency = Math.max(1, Number(process.env.SITENAVIGATOR_KETCH_CONCURRENCY || 8));
```

to:

```js
const ketchConcurrency = Math.max(1, Number(process.env.SITENAVIGATOR_KETCH_CONCURRENCY || 48));
```

- [ ] **Step 2: Run the tests to confirm nothing broke**

```bash
npm run test --prefix server
```

Expected: all tests pass.

- [ ] **Step 3: Commit**

```bash
git add server/src/ketchSync.js
git commit -m "feat(sync): raise default ketch concurrency from 8 to 48"
```

---

## Task 4: Add throttledCount/droppedCount to stats and syncProgress

**Files:**
- Modify: `server/src/ketchSync.js`

This task touches four locations in `runKetchIncrementalSync`. Each location is shown in full for clarity.

- [ ] **Step 1: Add counters to the `stats` initialization block**

Locate the `stats` object around line 486. It currently ends with `errorCount: 0`. Add two lines:

```js
  const stats = {
    scannedCount: 0,
    discoveredCount: 0,
    changedCount: 0,
    unchangedCount: 0,
    skippedNotModifiedCount: 0,
    errorCount: 0,
    throttledCount: 0,
    droppedCount: 0,
  };
```

- [ ] **Step 2: Add counters to the `addSyncRun` call**

Locate `addSyncRun(store, {` around line 495. Add `throttledCount: 0` and `droppedCount: 0` alongside the other zero-initialised counts:

```js
  addSyncRun(store, {
    id: runId,
    startedAt,
    finishedAt: null,
    status: "running",
    scannedCount: 0,
    discoveredCount: 0,
    changedCount: 0,
    unchangedCount: 0,
    skippedNotModifiedCount: 0,
    errorCount: 0,
    throttledCount: 0,
    droppedCount: 0,
    message: "Ketch sync started",
  });
```

- [ ] **Step 3: Add counters to the `Object.assign(syncProgress, ...)` reset block**

Locate `Object.assign(syncProgress, {` around line 509. Add `throttledCount: 0` and `droppedCount: 0`:

```js
  Object.assign(syncProgress, {
    inProgress: true,
    runId,
    startedAt,
    finishedAt: null,
    processed: 0,
    queued: KETCH_VENDOR_RUNS.length,
    completedVendors: 0,
    totalVendors: KETCH_VENDOR_RUNS.length,
    currentVendor: KETCH_VENDOR_RUNS[0]?.id || "",
    scannedCount: 0,
    discoveredCount: 0,
    changedCount: 0,
    unchangedCount: 0,
    skippedNotModifiedCount: 0,
    errorCount: 0,
    throttledCount: 0,
    droppedCount: 0,
    currentUrl: (Array.isArray(KETCH_VENDOR_RUNS[0]?.seeds) ? KETCH_VENDOR_RUNS[0].seeds[0] : KETCH_VENDOR_RUNS[0]?.seed) || null,
    currentDepth: 0,
    percent: 0,
  });
```

- [ ] **Step 4: Add counters to the `updateSyncRun` call at end of run**

Locate `updateSyncRun(store, runId, {` around line 555. Add both counts:

```js
  updateSyncRun(store, runId, {
    finishedAt: nowIso(),
    status: failed ? "error" : "success",
    scannedCount: stats.scannedCount,
    discoveredCount: stats.discoveredCount,
    changedCount: stats.changedCount,
    unchangedCount: stats.unchangedCount,
    skippedNotModifiedCount: stats.skippedNotModifiedCount,
    errorCount: stats.errorCount + (failed ? 1 : 0),
    throttledCount: stats.throttledCount,
    droppedCount: stats.droppedCount,
    message: failed ? failureMessage : "Ketch sync completed",
  });
```

- [ ] **Step 5: Run the tests**

```bash
npm run test --prefix server
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add server/src/ketchSync.js
git commit -m "feat(sync): add throttledCount/droppedCount to stats and syncProgress"
```

---

## Task 5: Update error branch in `runSeedCrawl` to use classifier

**Files:**
- Modify: `server/src/ketchSync.js:423`

- [ ] **Step 1: Replace the existing error block**

Locate the block starting with `if (record?.error) {` around line 423. It currently reads:

```js
    if (record?.error) {
      stats.errorCount += 1;
      syncProgress.errorCount = stats.errorCount;
      continue;
    }
```

Replace it with:

```js
    if (record?.error) {
      const { type, detail } = classifyKetchError(record);
      const errUrl = String(record?.page?.url || record?.url || "");
      if (type === "throttle") {
        stats.throttledCount += 1;
        syncProgress.throttledCount = stats.throttledCount;
        syncLog(`[${vendorRun.id}] throttled: ${errUrl} (${detail})`);
      } else if (type === "drop") {
        stats.droppedCount += 1;
        syncProgress.droppedCount = stats.droppedCount;
        syncLog(`[${vendorRun.id}] dropped: ${errUrl} (${detail})`);
      } else {
        syncLog(`[${vendorRun.id}] error: ${errUrl} (${detail})`);
      }
      stats.errorCount += 1;
      syncProgress.errorCount = stats.errorCount;
      continue;
    }
```

- [ ] **Step 2: Run the tests**

```bash
npm run test --prefix server
```

Expected: all tests pass.

- [ ] **Step 3: Commit**

```bash
git add server/src/ketchSync.js
git commit -m "feat(sync): classify and log throttled/dropped pages in error branch"
```

---

## Task 6: Update vendor-done and sync-done summary log lines

**Files:**
- Modify: `server/src/ketchSync.js`

- [ ] **Step 1: Update the vendor-done log line in `runVendorCrawl`**

Locate the log line around line 474–475:

```js
  syncLog(`[${vendorRun.id}] vendor done — ${seenUrls.size} total pages in ${(vendorMs / 1000).toFixed(1)}s`);
```

Replace with:

```js
  const vendorThrottleDrop = [
    stats.throttledCount ? `${stats.throttledCount} throttled` : "",
    stats.droppedCount ? `${stats.droppedCount} dropped` : "",
  ].filter(Boolean).join(", ");
  syncLog(`[${vendorRun.id}] vendor done — ${seenUrls.size} total pages${vendorThrottleDrop ? `, ${vendorThrottleDrop}` : ""} in ${(vendorMs / 1000).toFixed(1)}s`);
```

- [ ] **Step 2: Update the sync-done log line in `runKetchIncrementalSync`**

Locate the log line around line 582:

```js
  syncLog(`sync ${failed ? "failed" : "done"} — ${stats.scannedCount} pages scanned in ${(totalMs / 1000).toFixed(1)}s`);
```

Replace with:

```js
  const syncThrottleDrop = [
    stats.throttledCount ? `${stats.throttledCount} throttled` : "",
    stats.droppedCount ? `${stats.droppedCount} dropped` : "",
  ].filter(Boolean).join(", ");
  syncLog(`sync ${failed ? "failed" : "done"} — ${stats.scannedCount} pages scanned${syncThrottleDrop ? `, ${syncThrottleDrop}` : ""} in ${(totalMs / 1000).toFixed(1)}s`);
```

- [ ] **Step 3: Run the tests**

```bash
npm run test --prefix server
```

Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add server/src/ketchSync.js
git commit -m "feat(sync): include throttle/drop counts in vendor and sync summary logs"
```

---

## Task 7: Add shimmer keyframe CSS

**Files:**
- Modify: `client/src/index.css`

- [ ] **Step 1: Add the shimmer keyframe after the existing `.dark body` block**

Append to `client/src/index.css` after line 34 (after the `.dark body` closing brace):

```css
@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

@media (prefers-reduced-motion: reduce) {
  .sync-bar-shimmer {
    animation: none !important;
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add client/src/index.css
git commit -m "feat(ui): add shimmer keyframe for sync progress bar"
```

---

## Task 8: Add `SyncStatusPanel` component to `App.jsx`

**Files:**
- Modify: `client/src/App.jsx`

- [ ] **Step 1: Add the `SyncStatusPanel` component**

Add the following function immediately before the `Dashboard` function definition (around line 1415):

```jsx
function SyncStatusPanel({ syncState }) {
  const isActive = !!(syncState?.loading || syncState?.inProgress);
  const lastRun = syncState?.lastRun;
  const progress = syncState?.progress ?? {};
  const engine = syncState?.engine ?? "legacy";
  const engineLabel = formatSyncEngineLabel(engine);
  const lastSyncLabel = lastRun?.finishedAt || lastRun?.startedAt || null;
  const lastSyncDuration = formatDuration(lastRun?.durationMs);
  const currentVendorLabel = formatSyncVendorLabel(progress?.currentVendor);
  const percent = progress?.percent ?? (isActive ? 0 : 100);

  const throttledCount = isActive ? (progress?.throttledCount ?? 0) : (lastRun?.throttledCount ?? 0);
  const droppedCount = isActive ? (progress?.droppedCount ?? 0) : (lastRun?.droppedCount ?? 0);

  const throttleDropText = [
    throttledCount ? `${throttledCount} throttled` : "",
    droppedCount ? `${droppedCount} dropped` : "",
  ].filter(Boolean).join(" · ");

  return (
    <div style={{
      background: 'var(--glass-bg)',
      border: '1.5px solid var(--glass-border)',
      boxShadow: 'var(--glass-shadow)',
      backdropFilter: 'blur(var(--glass-blur))',
      borderRadius: 'var(--glass-radius)',
      padding: '1rem',
    }}>
      {/* Last run summary */}
      <div className="text-[11px] text-slate-500 dark:text-slate-400">
        {syncState?.error ? (
          <span className="text-rose-600 dark:text-rose-300">Sync error: {syncState.error}</span>
        ) : lastSyncLabel ? (
          <span>
            Engine {engineLabel} · Last sync: {lastSyncLabel} · duration {lastSyncDuration} ·
            scanned {lastRun?.scannedCount ?? 0} · new {lastRun?.discoveredCount ?? 0} · changed {lastRun?.changedCount ?? 0}
            {throttleDropText && !isActive ? ` · ${throttleDropText}` : ""}
          </span>
        ) : (
          <span className="text-slate-400 dark:text-slate-500">No sync run recorded yet.</span>
        )}
      </div>

      {/* Progress bar — always shown */}
      <div className="mt-2 h-2.5 rounded-full overflow-hidden bg-slate-800/60 ring-1 ring-slate-700/50">
        <div
          className="sync-bar-shimmer h-full rounded-full"
          style={{
            width: `${percent}%`,
            background: 'linear-gradient(to right, #3b82f6, #6366f1, #8b5cf6)',
            backgroundSize: '200% 100%',
            boxShadow: isActive ? '0 0 8px 1px rgba(99,102,241,0.5)' : 'none',
            opacity: isActive ? 1 : 0.4,
            transition: 'width 500ms ease-out',
            animation: isActive ? 'shimmer 2s linear infinite' : 'none',
          }}
        />
      </div>

      {/* Live stats — only when active */}
      {isActive && (
        <>
          <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
            {engineLabel}
            {engine === "ketch"
              ? ` · vendor ${progress?.completedVendors ?? 0}/${progress?.totalVendors ?? progress?.queued ?? 0}`
              : ` · ${percent}% · processed ${progress?.processed ?? 0}/${progress?.queued ?? 0}`}
            {engine === "ketch" ? ` · pages scanned ${progress?.scannedCount ?? 0}` : ""}
            {engine === "ketch" ? ` · new ${progress?.discoveredCount ?? 0}` : ""}
            {engine === "ketch" ? ` · changed ${progress?.changedCount ?? 0}` : ""}
            {currentVendorLabel ? ` · active vendor ${currentVendorLabel}` : ""}
            {throttleDropText ? ` · ${throttleDropText}` : ""}
          </div>
          {progress?.currentUrl && (
            <div className="mt-0.5 truncate text-[11px] text-slate-500 dark:text-slate-400">
              Current page: {progress.currentUrl}
            </div>
          )}
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify it compiles**

```bash
npm run build --prefix client 2>&1 | head -20
```

Expected: no errors (or only warnings unrelated to this change).

- [ ] **Step 3: Commit**

```bash
git add client/src/App.jsx
git commit -m "feat(ui): add SyncStatusPanel component with animated progress bar"
```

---

## Task 9: Update `Dashboard` — remove backup banner, add `syncState` prop

**Files:**
- Modify: `client/src/App.jsx`

- [ ] **Step 1: Update the `Dashboard` function signature**

Locate line ~1415:

```jsx
function Dashboard({ summary, backupStale, onQuickExport, onQuickFilterTag, onOpenExplorer, onHeatmapCellClick, customers, templates, heatmapCells, briefs }) {
```

Replace with:

```jsx
function Dashboard({ summary, syncState, onQuickFilterTag, onOpenExplorer, onHeatmapCellClick, customers, templates, heatmapCells, briefs }) {
```

- [ ] **Step 2: Remove the backup stale banner and replace with `SyncStatusPanel`**

Locate the JSX return block starting at line ~1432. Remove the `{backupStale && (...)}` block (lines ~1434–1451) and replace it with:

```jsx
      <SyncStatusPanel syncState={syncState} />
```

The return block should now start:

```jsx
  return (
    <div className="space-y-4">
      <SyncStatusPanel syncState={syncState} />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
```

- [ ] **Step 3: Verify it compiles**

```bash
npm run build --prefix client 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add client/src/App.jsx
git commit -m "feat(ui): replace backup banner with SyncStatusPanel in Dashboard"
```

---

## Task 10: Wire `syncState` from parent to `Dashboard`, remove stale `backupStale` usage

**Files:**
- Modify: `client/src/App.jsx`

- [ ] **Step 1: Update the `Dashboard` call site**

Locate the `<Dashboard` JSX around line 6459:

```jsx
            <Dashboard
              summary={dashboardSummary}
              backupStale={backupStale}
              onQuickExport={() => handleExport("full")}
              onQuickFilterTag={applyDashboardQuickTag}
              onOpenExplorer={() => setActive("explorer")}
              onHeatmapCellClick={applyHeatmapCellFilter}
              customers={customers}
              templates={templates}
              heatmapCells={heatmapCells}
              briefs={autoBriefs}
            />
```

Replace with:

```jsx
            <Dashboard
              summary={dashboardSummary}
              syncState={syncState}
              onQuickFilterTag={applyDashboardQuickTag}
              onOpenExplorer={() => setActive("explorer")}
              onHeatmapCellClick={applyHeatmapCellFilter}
              customers={customers}
              templates={templates}
              heatmapCells={heatmapCells}
              briefs={autoBriefs}
            />
```

- [ ] **Step 2: Remove the now-unused `backupStale` derived variable**

Locate line ~4647:

```js
  const backupStale = daysSince(lastBackupAt) > 14;
```

Delete that line. (`lastBackupAt` and `daysSince` are still used elsewhere — do not remove them.)

- [ ] **Step 3: Verify it compiles with no errors**

```bash
npm run build --prefix client 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 4: Run client unit tests**

```bash
npm run test:unit --prefix client
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add client/src/App.jsx
git commit -m "feat(ui): wire syncState to Dashboard, remove backupStale"
```

---

## Task 11: Manual verification

- [ ] **Step 1: Start the dev server**

```bash
npm run dev
```

- [ ] **Step 2: Open the dashboard and verify idle state**

- The backup stale banner is gone
- A glass card panel appears at the top of the dashboard
- If a previous sync run exists: last run summary text is visible
- Progress bar is at 100%, dimmed (opacity ~40%), no shimmer

- [ ] **Step 3: Trigger a sync and verify active state**

Click "SYNC: KETCH" in the header. On the dashboard:

- Progress bar animates with blue-indigo-violet shimmer sweep
- Glow effect visible on the bar fill
- Stats line updates live: vendor count, pages scanned, new, active vendor
- Current page URL truncates correctly
- Bar width advances smoothly (500ms ease-out transitions)

- [ ] **Step 4: Verify throttle/drop logging (if any occur)**

After sync completes, check server console for lines matching:
```
[sync ...] [vendor] throttled: https://... (...)
[sync ...] [vendor] dropped: https://... (...)
[sync ...] [vendor] vendor done — N total pages, X throttled, Y dropped in ...s
[sync ...] sync done — N pages scanned, X throttled, Y dropped in ...s
```
If none appear, that's expected — it means no throttling occurred at concurrency 48.

- [ ] **Step 5: Verify post-sync idle state**

After sync finishes: shimmer stops, bar dims to opacity-40, last run summary updates with new counts.
