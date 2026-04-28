# Integration Audit & Phase 4 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix wrong CLAUDE.md/AGENTS.md content, plug two server code gaps (exec→execFile, missing search engine flag), update README, then implement Phase 4 graph-backed missing-field resolution for Clone Duo's SAML extraction pipeline.

**Architecture:** Tasks 1–5 are standalone documentation and configuration fixes with no cross-dependencies. Tasks 6–7 implement Phase 4 TDD-first in `cloneDuoSchemas.js` and `cloneDuoMapping.js`; Phase 3's `cloneDuoGraphResolver.js` is unchanged. All GitNexus paths degrade gracefully when `graphQueryClient.isAvailable()` returns false.

**Tech Stack:** Node.js 22 ESM, `node:test` runner, Express 4, `@modelcontextprotocol/sdk`, React 19 (no client changes in this plan)

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `CLAUDE.md` | Replace | Sitenavigator project context for agents (replaces agent-skills boilerplate) |
| `AGENTS.md` | Replace | Module map, integration topology, agent guidance (replaces agent-skills boilerplate) |
| `server/src/gitNexusIndexer.js` | Modify | Switch `exec()` + shell string → `execFile()` + args array |
| `server/src/syncEngine.js` | Modify | Add `shouldUseGitNexusSearch()` and `getSelectedSearchEngine()` exports |
| `server/src/server.js` | Modify | Gate `/api/compare/related` and `/api/gap/analyze` with `shouldUseGitNexusSearch()` |
| `server/tests/syncEngine.test.js` | Create | Tests for `shouldUseGitNexusSearch()` and `getSelectedSearchEngine()` |
| `README.md` | Modify | Add "GitNexus Integration" section and env var table |
| `server/src/cloneDuoSchemas.js` | Modify | Add `confidenceThreshold` (default 0.6) to `createRequiredField` return value |
| `server/src/cloneDuoMapping.js` | Modify | Export `resolveFieldWithGraph()`; call it in `resolveFieldState()` when candidates are empty |
| `server/tests/clone-duo-phase4.test.js` | Create | Tests for `resolveFieldWithGraph()` — available client resolves, unavailable degrades |

---

## Task 1: Replace CLAUDE.md

**Files:**
- Replace: `CLAUDE.md`

No tests — documentation only.

- [ ] **Step 1: Replace CLAUDE.md with sitenavigator-specific content**

Overwrite the entire file with:

```markdown
# SiteNavigator

Documentation intelligence platform for competitive gap analysis (Duo vs. Okta, Entra, Ping Identity). Indexes multi-vendor documentation, powers cross-vendor search, gap detection, and SAML template generation.

## Stack

- **Frontend** — React 19 + Vite + Tailwind CSS (`client/`)
- **Backend** — Express 4 + Node 22 LTS (`server/src/`)
- **Crawler** — Ketch (Go binary, bundled in `server/vendor/ketch/`)
- **Knowledge graph** — GitNexus (external binary, must be on PATH or `SITENAVIGATOR_GITNEXUS_BIN`)
- **Data** — Single JSON file (`server/data/index.json`)

## Three-Layer Integration

```
Ketch crawl → server/data/gitnexus-docs/<vendor>/ → gitnexus analyze → .gitnexus/ → MCP stdio → graphQueryClient → API endpoints → UI
```

1. `POST /api/sync` triggers Ketch crawl per vendor (duo, okta, entra, pingidentity)
2. Ketch writes per-page markdown to `gitnexus-docs/` via `--output-dir --vendor`
3. After crawl, `gitNexusIndexer.js` fires `gitnexus analyze` (fire-and-forget)
4. `graphQueryClient.js` connects to GitNexus MCP over stdio on server startup
5. Search, gap analysis, and Clone Duo disambiguation use `graphQueryClient.search()` / `graphQueryClient.cypher()`

## Key Server Modules

| Module | Responsibility |
|--------|---------------|
| `ketchSync.js` | Vendor crawl orchestration, Ketch binary management, writes to `gitnexus-docs/` |
| `gitNexusIndexer.js` | Post-crawl `gitnexus analyze` trigger (fire-and-forget), index progress tracking |
| `graphQueryClient.js` | GitNexus MCP stdio client — `search()`, `cypher()`, graceful degradation |
| `syncEngine.js` | Engine selector (`SITENAVIGATOR_SYNC_ENGINE`, `SITENAVIGATOR_SEARCH_ENGINE`) |
| `cloneDuoMapping.js` | SAML field extraction and resolution pipeline |
| `cloneDuoGraphResolver.js` | GitNexus-powered ambiguity resolution for conflicting SAML candidates |

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `SITENAVIGATOR_SYNC_ENGINE` | `auto` | `ketch`, `legacy`, or `auto` (ketch if binary present) |
| `SITENAVIGATOR_SEARCH_ENGINE` | `auto` | `gitnexus`, `legacy`, or `auto` (gitnexus-first with fallback) |
| `SITENAVIGATOR_KETCH_BIN` | (bundled) | Path to ketch binary; overrides bundled binary |
| `SITENAVIGATOR_KETCH_DEPTH` | `3` | BFS crawl depth per vendor |
| `SITENAVIGATOR_KETCH_CONCURRENCY` | `8` | Concurrent crawl workers |
| `SITENAVIGATOR_GITNEXUS_BIN` | `gitnexus` | Path to gitnexus binary (must be on PATH or set explicitly) |
| `SITENAVIGATOR_OPEN_BROWSER` | `true` | Set `false` to disable auto browser open on launch |
| `PORT` | `8787` | Server port |
| `SITENAVIGATOR_DATA_DIR` | `server/data` | Index storage directory |

## Coding Boundaries

**Always:**
- Use the **`uipro` design system** for all UI design work (new components, feature additions, layout changes)
- Degrade gracefully when `graphQueryClient.isAvailable() === false` — treat it as normal, not an error
- Keep `gitnexus analyze` fire-and-forget — never block the sync response on it

**Never:**
- Call the `gitnexus` CLI directly from request handlers — use `graphQueryClient` or `gitNexusIndexer`
- Add `exec()` with shell string construction — use `execFile()` with an args array
- Break the fallback path for any GitNexus-backed feature

## Commands

```bash
# Development
npm run dev                                  # Client + server concurrent dev
npm run test --prefix server                 # Node test runner
npm run test:unit --prefix client            # Vitest unit tests
npm run lint --prefix client                 # ESLint

# Build
npm run build:ketch --prefix server          # Build bundled Ketch binary
npm run build:portable --prefix server       # Portable exe (Ketch + server)
npm run build:portable                       # Full portable build from root
```

## Phase Status

| Phase | Status | Description |
|-------|--------|-------------|
| 1 | ✅ Shipped | Ketch `--output-dir`, gitNexusIndexer, graphQueryClient, `/api/compare/related` |
| 2 | ✅ Shipped | `/api/gap/analyze` backed by GitNexus with fallback |
| 3 | ✅ Shipped | `cloneDuoGraphResolver` — ambiguity resolution for conflicting SAML candidates |
| 4 | 🔄 In progress | Graph-backed resolution for missing SAML fields |
| 5 | 📋 Planned | Replace DOM traversal in `cloneDuoExtraction.js` with graph extraction |
```

- [ ] **Step 2: Verify the file looks correct**

```bash
head -10 CLAUDE.md
```

Expected first line: `# SiteNavigator`

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "docs(claude-md): replace agent-skills boilerplate with sitenavigator project context"
```

---

## Task 2: Replace AGENTS.md

**Files:**
- Replace: `AGENTS.md`

No tests — documentation only.

- [ ] **Step 1: Replace AGENTS.md with sitenavigator-specific content**

Overwrite the entire file with:

```markdown
# AGENTS.md — SiteNavigator

Guidance for AI coding agents (Claude Code, Cursor, Copilot, etc.) working in this repository.

## What This Repo Does

SiteNavigator is a documentation intelligence platform. It crawls multi-vendor docs (Duo, Okta, Entra, Ping Identity), indexes them into a knowledge graph, and exposes search, gap analysis, and SAML template generation via a React UI backed by an Express API.

## Integration Topology

```
Ketch crawl → gitnexus-docs/<vendor>/ → gitnexus analyze → .gitnexus/ → MCP stdio → graphQueryClient → API endpoints → React UI
```

## Server Modules

| Module | File | What it does |
|--------|------|-------------|
| HTTP API | `server/src/server.js` | Express routes, sync control, content query, compare/gap/clone-duo endpoints |
| Sync engine selector | `server/src/syncEngine.js` | Reads `SITENAVIGATOR_SYNC_ENGINE` / `SITENAVIGATOR_SEARCH_ENGINE`; routes to Ketch or legacy |
| Ketch sync | `server/src/ketchSync.js` | Spawns `ketch crawl` per vendor, streams JSON lines, upserts to store, fires gitNexusIndexer |
| Legacy crawler | `server/src/crawler.js` | Cheerio-based fallback crawler used when Ketch binary is absent |
| GitNexus indexer | `server/src/gitNexusIndexer.js` | Fires `gitnexus analyze` after sync (fire-and-forget); tracks index progress |
| Graph query client | `server/src/graphQueryClient.js` | MCP stdio client — `.search()`, `.cypher()`, `.isAvailable()`; degrades silently |
| Store | `server/src/store.js` | Read/write `data/index.json` |
| Recency | `server/src/recency.js` | Computes recency signals (new_page, page_last_updated, changed_content) |
| Clone Duo extraction | `server/src/cloneDuoExtraction.js` | DOM traversal → evidence blocks |
| Clone Duo mapping | `server/src/cloneDuoMapping.js` | SAML field extraction from evidence; resolveFieldState pipeline |
| Clone Duo graph resolver | `server/src/cloneDuoGraphResolver.js` | GitNexus-powered disambiguation for ambiguous SAML candidates |
| Clone Duo schemas | `server/src/cloneDuoSchemas.js` | Field definitions, blueprint families, section definitions |
| Clone Duo generation | `server/src/cloneDuoGeneration.js` | Narrative generation for draft sections |

## Client Feature Modules (`client/src/features/sitenavigator/`)

| File | What it does |
|------|-------------|
| `compareMatching.js` | `fetchRelatedItems()` — calls `/api/compare/related`, falls back to legacy token matcher |
| `compareMatchingLegacy.js` | Legacy token overlap scorer (client-side fallback) |
| `gapAnalysis.js` | `fetchGapItems()` — calls `/api/gap/analyze`, returns null on 503 |
| `facets.js` | AND/OR/EXCLUDE tag-based filter system |
| `searchRanking.js` | Full-text ranking with quoted phrase support |
| `vendorSections.js` | Nav tree generation from URL prefixes |
| `constants.js` | Storage keys, status types, default templates |

## Agent-Specific Guidance

**GitNexus availability:**
`graphQueryClient.isAvailable() === false` is normal during first run (before `gitnexus analyze` completes) or when the `gitnexus` binary is not installed. Treat it as degraded mode, not an error. All GitNexus-backed features must have legacy fallbacks.

**Engine selection:**
- `SITENAVIGATOR_SYNC_ENGINE=auto` → uses Ketch if binary present, legacy otherwise
- `SITENAVIGATOR_SEARCH_ENGINE=auto` → uses GitNexus-first with silent fallback to legacy

**UI design:**
All UI work uses the **`uipro` design system**. No raw Tailwind design decisions — use `uipro` components and tokens.

**Never:**
- Call `gitnexus` CLI directly from a request handler — use `graphQueryClient` or `gitNexusIndexer`
- Block a sync response on `gitnexus analyze` — it must remain fire-and-forget
- Use `exec()` with a shell-constructed string — use `execFile()` with an args array

## Phase Status

| Phase | Status | Key files |
|-------|--------|-----------|
| 1 — Crawl→Index pipeline | ✅ | `ketchSync.js`, `gitNexusIndexer.js`, `graphQueryClient.js` |
| 2 — Gap analysis | ✅ | `gapAnalysis.js`, `/api/gap/analyze` |
| 3 — Clone Duo ambiguity resolver | ✅ | `cloneDuoGraphResolver.js` wired into `cloneDuoMapping.js` |
| 4 — Graph-backed missing field resolution | 🔄 | `cloneDuoMapping.js`, `cloneDuoSchemas.js` |
| 5 — Replace DOM traversal | 📋 | `cloneDuoExtraction.js` (planned) |

## Test Runner

```bash
npm run test --prefix server    # runs all server/tests/*.test.js
npm run test:unit --prefix client
```

Tests use Node's built-in `node:test` runner + `assert/strict`. No Jest, no Mocha.
```

- [ ] **Step 2: Verify the file looks correct**

```bash
head -5 AGENTS.md
```

Expected first line: `# AGENTS.md — SiteNavigator`

- [ ] **Step 3: Commit**

```bash
git add AGENTS.md
git commit -m "docs(agents-md): replace agent-skills boilerplate with sitenavigator module map and guidance"
```

---

## Task 3: Fix `gitNexusIndexer.js` — `exec()` → `execFile()`

**Files:**
- Modify: `server/src/gitNexusIndexer.js`
- Modify: `server/tests/gitNexusIndexer.test.js`

- [ ] **Step 1: Write a failing test for the execFile error path**

Open `server/tests/gitNexusIndexer.test.js` and add this test inside the existing `describe("gitNexusIndexer", ...)` block after the existing tests:

```js
it("analyzeAfterSync resolves { ok: false } when binary is not found", async () => {
  // Using a clearly non-existent binary path exercises the execFile error handler
  const { analyzeAfterSync: analyze } = await import("../src/gitNexusIndexer.js?t=" + Date.now());
  const orig = process.env.SITENAVIGATOR_GITNEXUS_BIN;
  process.env.SITENAVIGATOR_GITNEXUS_BIN = "/no/such/binary-" + Date.now();
  const result = await analyze(require("os").tmpdir());
  process.env.SITENAVIGATOR_GITNEXUS_BIN = orig ?? "";
  assert.equal(result.ok, false);
  assert.ok(typeof result.error === "string");
});
```

> Note: this test may pass even before the fix because `exec()` also fires an `error` event for missing binaries. The key value of the fix is in the security posture (no shell), not a behavioral change. Skip this test step if the dynamic import pattern is blocked by the test runner — proceed directly to Step 3.

- [ ] **Step 2: Run existing tests to confirm they pass before touching the code**

```bash
npm run test --prefix server 2>&1 | grep -E "pass|fail|gitNexus"
```

Expected: all gitNexusIndexer tests pass.

- [ ] **Step 3: Make the fix in `server/src/gitNexusIndexer.js`**

Change the import at the top of the file:

```js
// Before
import { exec } from "node:child_process";

// After
import { execFile } from "node:child_process";
```

Replace the `proc` line inside `analyzeAfterSync` (find the `exec(` call):

```js
// Before
const proc = exec(`"${gitnexusBin}" ${args.map((a) => `"${a}"`).join(" ")}`);

// After
const proc = execFile(gitnexusBin, args);
```

No other changes — `proc.on("error")` and `proc.on("exit")` work identically on `execFile` child processes.

- [ ] **Step 4: Run the full server test suite**

```bash
npm run test --prefix server
```

Expected: all tests pass. Zero failures.

- [ ] **Step 5: Commit**

```bash
git add server/src/gitNexusIndexer.js server/tests/gitNexusIndexer.test.js
git commit -m "fix(indexer): switch exec() shell string to execFile() args array to prevent shell injection"
```

---

## Task 4: Add `SITENAVIGATOR_SEARCH_ENGINE` flag

**Files:**
- Modify: `server/src/syncEngine.js`
- Modify: `server/src/server.js`
- Create: `server/tests/syncEngine.test.js`

- [ ] **Step 1: Write the failing tests**

Create `server/tests/syncEngine.test.js`:

```js
import assert from "node:assert/strict";
import { describe, it, afterEach } from "node:test";

// We import after setting env so the module reads the right value.
// Because Node ESM caches modules, we test the exported functions directly
// and control env before each call.

describe("syncEngine — shouldUseGitNexusSearch / getSelectedSearchEngine", () => {
  const origEngine = process.env.SITENAVIGATOR_SEARCH_ENGINE;

  afterEach(() => {
    if (origEngine === undefined) {
      delete process.env.SITENAVIGATOR_SEARCH_ENGINE;
    } else {
      process.env.SITENAVIGATOR_SEARCH_ENGINE = origEngine;
    }
  });

  it("defaults to auto when env var is unset", async () => {
    delete process.env.SITENAVIGATOR_SEARCH_ENGINE;
    const { getSelectedSearchEngine } = await import("../src/syncEngine.js");
    assert.equal(getSelectedSearchEngine(), "auto");
  });

  it("returns legacy when SITENAVIGATOR_SEARCH_ENGINE=legacy", async () => {
    process.env.SITENAVIGATOR_SEARCH_ENGINE = "legacy";
    const { getSelectedSearchEngine } = await import("../src/syncEngine.js");
    assert.equal(getSelectedSearchEngine(), "legacy");
  });

  it("returns gitnexus when SITENAVIGATOR_SEARCH_ENGINE=gitnexus", async () => {
    process.env.SITENAVIGATOR_SEARCH_ENGINE = "gitnexus";
    const { getSelectedSearchEngine } = await import("../src/syncEngine.js");
    assert.equal(getSelectedSearchEngine(), "gitnexus");
  });

  it("shouldUseGitNexusSearch returns false when engine is legacy", async () => {
    process.env.SITENAVIGATOR_SEARCH_ENGINE = "legacy";
    const { shouldUseGitNexusSearch } = await import("../src/syncEngine.js");
    assert.equal(shouldUseGitNexusSearch(), false);
  });

  it("shouldUseGitNexusSearch returns true when engine is gitnexus", async () => {
    process.env.SITENAVIGATOR_SEARCH_ENGINE = "gitnexus";
    const { shouldUseGitNexusSearch } = await import("../src/syncEngine.js");
    assert.equal(shouldUseGitNexusSearch(), true);
  });

  it("shouldUseGitNexusSearch returns true when engine is auto", async () => {
    delete process.env.SITENAVIGATOR_SEARCH_ENGINE;
    const { shouldUseGitNexusSearch } = await import("../src/syncEngine.js");
    assert.equal(shouldUseGitNexusSearch(), true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm run test --prefix server 2>&1 | grep -E "syncEngine|fail|pass"
```

Expected: FAIL — `getSelectedSearchEngine is not a function` (or similar, since not yet exported).

- [ ] **Step 3: Add the exports to `server/src/syncEngine.js`**

Append at the end of the existing file (after the last `export` line):

```js
function selectedSearchEngine() {
  const requested = String(process.env.SITENAVIGATOR_SEARCH_ENGINE || "auto").trim().toLowerCase();
  if (requested === "legacy") return "legacy";
  if (requested === "gitnexus") return "gitnexus";
  return "auto";
}

export function getSelectedSearchEngine() {
  return selectedSearchEngine();
}

export function shouldUseGitNexusSearch() {
  return selectedSearchEngine() !== "legacy";
}
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
npm run test --prefix server 2>&1 | grep -E "syncEngine|fail"
```

Expected: all syncEngine tests pass.

- [ ] **Step 5: Gate the two handlers in `server/src/server.js`**

At the top of `server/src/server.js`, add `shouldUseGitNexusSearch` to the existing import from `syncEngine.js`:

```js
// Before
import { runIncrementalSync, getSelectedSyncEngine, getSyncProgress } from "./syncEngine.js";

// After
import { runIncrementalSync, getSelectedSyncEngine, getSyncProgress, shouldUseGitNexusSearch } from "./syncEngine.js";
```

In the `POST /api/compare/related` handler, find this block (around line 309):

```js
  if (!graphQueryClient.isAvailable()) {
    return res.status(503).json({ ok: false, message: "search index unavailable", fallback: true });
  }
```

Replace it with:

```js
  if (!shouldUseGitNexusSearch() || !graphQueryClient.isAvailable()) {
    return res.status(503).json({ ok: false, message: "search index unavailable", fallback: true });
  }
```

In `createGapAnalyzeHandler` (the function exported for testing), find (around line 347):

```js
    if (!client.isAvailable()) {
```

The `createGapAnalyzeHandler` accepts an injectable `client`, so it doesn't call `shouldUseGitNexusSearch()` directly — the caller (`app.post("/api/gap/analyze", createGapAnalyzeHandler(graphQueryClient))`) controls which client is passed. Instead, gate the registration in `server.js` where `createGapAnalyzeHandler` is wired. Find the line:

```js
app.post("/api/gap/analyze", createGapAnalyzeHandler(graphQueryClient));
```

Replace it with:

```js
app.post("/api/gap/analyze", (req, res, next) => {
  if (!shouldUseGitNexusSearch()) {
    return res.status(503).json({ ok: false, fallback: true, message: "GitNexus unavailable" });
  }
  return createGapAnalyzeHandler(graphQueryClient)(req, res, next);
});
```

- [ ] **Step 6: Run the full server test suite**

```bash
npm run test --prefix server
```

Expected: all tests pass. The existing `gapAnalyze.test.js` tests call `createGapAnalyzeHandler` directly with a mock client, so they are unaffected by the `shouldUseGitNexusSearch` gate in `server.js`.

- [ ] **Step 7: Commit**

```bash
git add server/src/syncEngine.js server/src/server.js server/tests/syncEngine.test.js
git commit -m "feat(sync-engine): add SITENAVIGATOR_SEARCH_ENGINE flag; gate compare/gap handlers"
```

---

## Task 5: Update README with GitNexus Integration section

**Files:**
- Modify: `README.md`

No tests — documentation only.

- [ ] **Step 1: Add the GitNexus Integration section to README.md**

In `README.md`, find the line that starts the "Development Workflow" heading (it reads `## Development Workflow`). Insert the following block **immediately before** that heading:

```markdown
---

## GitNexus Integration

SiteNavigator uses a three-layer architecture for intelligent search, gap analysis, and SAML field extraction:

```
Ketch (crawler) → gitnexus-docs/<vendor>/ → gitnexus analyze → .gitnexus/ → MCP stdio → graphQueryClient → API
```

**Ketch** crawls each vendor's documentation site and writes per-page YAML-frontmatter markdown to `server/data/gitnexus-docs/<vendor>/` via `--output-dir --vendor` flags. **GitNexus** ingests those files, builds a knowledge graph with BM25 + semantic embeddings, and exposes it via MCP. **SiteNavigator's server** queries GitNexus through `graphQueryClient.js` (an MCP stdio client) for all search, gap, and disambiguation operations. All GitNexus paths degrade gracefully to legacy behavior when the binary is unavailable.

### Phase Status

| Phase | Status | Description |
|-------|--------|-------------|
| 1 — Crawl → Index pipeline | ✅ Shipped | Ketch `--output-dir`, `gitNexusIndexer.js`, `graphQueryClient.js`, `/api/compare/related` |
| 2 — Gap analysis | ✅ Shipped | `/api/gap/analyze` backed by GitNexus BM25+semantic search |
| 3 — Clone Duo ambiguity resolver | ✅ Shipped | `cloneDuoGraphResolver.js` reduces `UNRESOLVED_AMBIGUOUS` field count |
| 4 — Graph-backed missing field resolution | 🔄 In progress | `cloneDuoMapping.js` queries graph for fields that alias matching misses |
| 5 — Replace DOM traversal | 📋 Planned | Full graph-extraction pipeline for `cloneDuoExtraction.js` |

### GitNexus Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `SITENAVIGATOR_GITNEXUS_BIN` | `gitnexus` | Path to `gitnexus` binary; must be on PATH or set explicitly |
| `SITENAVIGATOR_SEARCH_ENGINE` | `auto` | `gitnexus` (force graph search), `legacy` (force token matcher), `auto` (graph-first with fallback) |
| `SITENAVIGATOR_KETCH_BIN` | (bundled) | Override bundled Ketch binary path |
| `SITENAVIGATOR_KETCH_DEPTH` | `3` | BFS crawl depth per vendor |
| `SITENAVIGATOR_KETCH_CONCURRENCY` | `8` | Concurrent Ketch crawl workers |

### First-Run Setup

GitNexus must be installed and on PATH before graph features are active. SiteNavigator starts and serves the UI without it — graph features silently fall back to legacy behavior.

```bash
# Install GitNexus (see https://github.com/abhigyanpatwari/GitNexus)
npm install -g gitnexus

# Verify
gitnexus --version

# Run a sync — Ketch crawls, then gitNexusIndexer fires automatically
# POST /api/sync via the UI, or via curl:
curl -X POST http://localhost:8787/api/sync

# Check graph status
curl http://localhost:8787/api/graph/status
# → { "available": true, "indexed": true, "progress": { "phase": "done" } }
```

```

- [ ] **Step 2: Verify the section was inserted correctly**

```bash
grep -n "GitNexus Integration" README.md
```

Expected: one match at a line number before the "Development Workflow" heading.

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs(readme): add GitNexus integration section with phase status and env var reference"
```

---

## Task 6: Phase 4 — Graph-backed missing field resolution

**Files:**
- Modify: `server/src/cloneDuoSchemas.js`
- Modify: `server/src/cloneDuoMapping.js`
- Create: `server/tests/clone-duo-phase4.test.js`

- [ ] **Step 1: Write the failing tests**

Create `server/tests/clone-duo-phase4.test.js`:

```js
import assert from "node:assert/strict";
import { describe, it } from "node:test";

// resolveFieldWithGraph is tested in isolation via the injectable _client param
import { resolveFieldWithGraph } from "../src/cloneDuoMapping.js";

// A minimal field definition matching the schema shape after Task 6 adds confidenceThreshold
function makeField(overrides = {}) {
  return {
    id: "sp_entity_id",
    label: "Service Provider Entity ID",
    group: "service_provider",
    valueType: "string",
    cardinality: "single",
    targetSectionId: "update_application_in_duo",
    extractionAliases: ["service provider (sp) entity id", "sp entity id", "audience uri", "entityid", "entity id"],
    expectedFormatHint: "The service provider identifier or audience URI.",
    confidenceThreshold: 0.6,
    ...overrides,
  };
}

describe("resolveFieldWithGraph", () => {
  it("is exported as a function", () => {
    assert.equal(typeof resolveFieldWithGraph, "function");
  });

  it("returns null when graphQueryClient is unavailable", async () => {
    const unavailableClient = { isAvailable: () => false, search: async () => [] };
    const result = await resolveFieldWithGraph(makeField(), [], unavailableClient);
    assert.equal(result, null);
  });

  it("returns null when no search hits meet confidence threshold", async () => {
    const lowScoreClient = {
      isAvailable: () => true,
      search: async () => [{ score: 0.3, excerpt: "SP Entity ID: zoom.us", url: "https://okta.com/zoom" }],
    };
    const result = await resolveFieldWithGraph(makeField(), [], lowScoreClient);
    assert.equal(result, null);
  });

  it("returns null when high-confidence hit excerpt yields no extractable value", async () => {
    const noValueClient = {
      isAvailable: () => true,
      search: async () => [{ score: 0.85, excerpt: "Configure your SAML integration.", url: "https://okta.com/zoom" }],
    };
    const result = await resolveFieldWithGraph(makeField(), [], noValueClient);
    assert.equal(result, null);
  });

  it("resolves a value when high-confidence hit excerpt contains an alias match", async () => {
    // The excerpt contains "Service Provider (SP) Entity ID | zoom.us" — matches extractionAliases
    const goodClient = {
      isAvailable: () => true,
      search: async () => [{
        score: 0.9,
        excerpt: "Service Provider (SP) Entity ID | zoom.us\nACS URL | https://zoom.us/saml",
        url: "https://okta.com/zoom",
      }],
    };
    const result = await resolveFieldWithGraph(makeField(), [], goodClient);
    assert.ok(result !== null, "expected a non-null result");
    assert.equal(result.value, "zoom.us");
    assert.ok(result.confidence >= 0.6, `confidence too low: ${result.confidence}`);
    assert.deepEqual(result.evidenceUrls, ["https://okta.com/zoom"]);
  });

  it("uses the first hit that meets threshold and yields a value", async () => {
    let callCount = 0;
    const multiHitClient = {
      isAvailable: () => true,
      search: async () => {
        callCount++;
        return [
          { score: 0.4, excerpt: "no useful content", url: "https://okta.com/a" },
          { score: 0.95, excerpt: "SP Entity ID | myapp.example.com", url: "https://okta.com/b" },
        ];
      },
    };
    const result = await resolveFieldWithGraph(makeField(), [], multiHitClient);
    assert.equal(callCount, 1, "search called once");
    assert.ok(result !== null);
    assert.equal(result.value, "myapp.example.com");
    assert.deepEqual(result.evidenceUrls, ["https://okta.com/b"]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm run test --prefix server 2>&1 | grep -E "clone-duo-phase4|resolveFieldWithGraph|fail|pass"
```

Expected: FAIL — `resolveFieldWithGraph is not a function` (not yet exported).

- [ ] **Step 3: Add `confidenceThreshold` to `createRequiredField` in `cloneDuoSchemas.js`**

In `server/src/cloneDuoSchemas.js`, find the `createRequiredField` function (line 403) and update it:

```js
// Before
export function createRequiredField(config) {
  return {
    requiredForBlueprintFamilies: [BLUEPRINT_FAMILIES.GENERIC_SAML, BLUEPRINT_FAMILIES.INTEGRATION_RUNBOOK_SAML],
    requiredForSourceProtocols: ["saml"],
    ...config,
  };
}

// After
export function createRequiredField(config) {
  return {
    requiredForBlueprintFamilies: [BLUEPRINT_FAMILIES.GENERIC_SAML, BLUEPRINT_FAMILIES.INTEGRATION_RUNBOOK_SAML],
    requiredForSourceProtocols: ["saml"],
    confidenceThreshold: 0.6,
    ...config,
  };
}
```

This adds `confidenceThreshold: 0.6` as the default for every field. Individual field definitions can override it by including `confidenceThreshold` in their config object.

- [ ] **Step 4: Add `resolveFieldWithGraph` to `cloneDuoMapping.js`**

In `server/src/cloneDuoMapping.js`, add the following import at the top of the file alongside the existing imports:

```js
import { graphQueryClient } from "./graphQueryClient.js";
```

> If `graphQueryClient` is already imported, skip this step.

Then add the following exported function and private helper **after the last `function` declaration** in the file (after `formatFieldValue`):

```js
const GRAPH_SEARCH_TIMEOUT_MS = 5_000;

async function graphSearchWithTimeout(query, opts, client) {
  return Promise.race([
    client.search(query, opts),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error("graph search timeout")), GRAPH_SEARCH_TIMEOUT_MS)
    ),
  ]).catch(() => []);
}

export async function resolveFieldWithGraph(field, evidence, _client) {
  const client = _client ?? graphQueryClient;
  if (!client.isAvailable()) return null;

  const query = [field.label, ...(field.extractionAliases || [])].join(" ");
  try {
    const hits = await graphSearchWithTimeout(query, { limit: 3 }, client);
    const threshold = Number(field.confidenceThreshold ?? 0.6);

    for (const hit of hits) {
      if (Number(hit.score || 0) < threshold) continue;
      const excerpt = String(hit.excerpt || "");
      if (!excerpt) continue;

      // Treat the excerpt as a synthetic evidence block and re-use existing extraction
      const syntheticBlock = {
        id: `gn_${String(hit.url || "").slice(-20)}`,
        type: "paragraph_block",
        headingPath: [],
        ordinal: 0,
        text: excerpt,
        extractedFields: [],
      };
      const candidates = collectCandidates(field, [syntheticBlock]);
      if (!candidates.length) continue;

      const values = uniqueCandidateValues(candidates);
      return {
        value: field.cardinality === "multiple" ? values : values[0],
        confidence: Number(hit.score),
        evidenceUrls: [hit.url || ""].filter(Boolean),
      };
    }
  } catch {
    return null;
  }
  return null;
}
```

- [ ] **Step 5: Wire `resolveFieldWithGraph` into `resolveFieldState`**

In `cloneDuoMapping.js`, find the `resolveFieldState` function. Find this block (the path that calls `applyUnresolvedState` when no candidates are found):

```js
  if (!candidates.length) {
    return applyUnresolvedState(state, field, evidence);
  }
```

Replace it with:

```js
  if (!candidates.length) {
    const graphResult = await resolveFieldWithGraph(field, evidence);
    if (graphResult) {
      state.status = FIELD_STATUS.RESOLVED;
      state.value = graphResult.value;
      state.resolvedBy = "graph_search";
      state.graphConfidence = graphResult.confidence;
      state.graphEvidenceUrls = graphResult.evidenceUrls;
      return state;
    }
    return applyUnresolvedState(state, field, evidence);
  }
```

- [ ] **Step 6: Run tests to verify Phase 4 tests now pass**

```bash
npm run test --prefix server 2>&1 | grep -E "clone-duo-phase4|resolveFieldWithGraph|fail"
```

Expected: all `resolveFieldWithGraph` tests pass.

- [ ] **Step 7: Run the full server test suite**

```bash
npm run test --prefix server
```

Expected: all tests pass. The existing `clone-duo-mapping.test.js` tests must still pass — they don't trigger the graph path because `graphQueryClient.isAvailable()` returns false in tests (no real MCP server running).

- [ ] **Step 8: Commit**

```bash
git add server/src/cloneDuoSchemas.js server/src/cloneDuoMapping.js server/tests/clone-duo-phase4.test.js
git commit -m "feat(clone-duo): Phase 4 — graph-backed resolution for missing SAML fields via resolveFieldWithGraph"
```

---

## Task 7: Validate Phase 4 against test fixtures

**Files:**
- Modify: `server/tests/clone-duo-phase4.test.js` (add fixture-level test)

This task adds an integration-style test using an existing fixture page to confirm the full pipeline behavior (including the new graph path) produces no regressions.

- [ ] **Step 1: Add a regression test to `clone-duo-phase4.test.js`**

Append this test to the existing `clone-duo-phase4.test.js` file:

```js
import { buildCloneDuoDraft } from "../src/cloneDuoMapping.js";

describe("Phase 4 regression — existing fixtures must still resolve", () => {
  // This uses the same fixture as clone-duo-mapping.test.js.
  // GraphQueryClient is unavailable in test (no MCP server), so graph path is skipped.
  // All fields that resolved before Phase 4 must still resolve.
  function makeSourceBundle() {
    return {
      schemaVersion: 1,
      createdAt: "2026-03-26T00:00:00.000Z",
      sourcePages: [{
        id: "source_page_1",
        title: "How to Configure SAML 2.0 for Zoom",
        url: "https://saml-doc.okta.com/SAML_Docs/How-to-Configure-SAML-2.0-for-Zoom.us.html",
        vendor: "Okta",
        category: "competitor_docs",
        summary: "Zoom SAML configuration steps.",
      }],
      evidence: [
        {
          id: "ev_2_table",
          sourcePageId: "source_page_1",
          type: "table_block",
          headingPath: ["Configuration Steps"],
          ordinal: 2,
          text: "Sign-in Page URL | https://example.okta.com/app/sso/saml\nService Provider (SP) Entity ID | zoom.us\nSignature Hash Algorithm | SHA-256",
          extractedFields: [
            { label: "Sign-in Page URL", value: "https://example.okta.com/app/sso/saml" },
            { label: "Service Provider (SP) Entity ID", value: "zoom.us" },
            { label: "Signature Hash Algorithm", value: "SHA-256" },
          ],
          sourceUrl: "https://example.test/zoom",
          citationLabel: "Configuration Steps · block 2",
        },
        {
          id: "ev_3_steps",
          sourcePageId: "source_page_1",
          type: "ordered_step_block",
          headingPath: ["Configuration Steps"],
          ordinal: 3,
          text: "SP-initiated SSO\nIdP-initiated SSO\nJIT (Just In Time) Provisioning",
          extractedFields: [],
          sourceUrl: "https://example.test/zoom",
          citationLabel: "Configuration Steps · block 3",
        },
      ],
    };
  }

  it("fields resolved before Phase 4 are still resolved after Phase 4 (fallback path)", async () => {
    const draft = await buildCloneDuoDraft({
      sourceItems: [{ title: "How to Configure SAML 2.0 for Zoom" }],
      sourceBundle: makeSourceBundle(),
    });

    const ssoUrl = draft.fields.find((f) => f.fieldId === "idp_sso_url");
    const spEntityId = draft.fields.find((f) => f.fieldId === "sp_entity_id");
    const sigAlg = draft.fields.find((f) => f.fieldId === "signature_algorithm");

    assert.equal(ssoUrl.status, "resolved", "idp_sso_url must still resolve");
    assert.equal(ssoUrl.value, "https://example.okta.com/app/sso/saml");
    assert.equal(spEntityId.status, "resolved", "sp_entity_id must still resolve");
    assert.equal(spEntityId.value, "zoom.us");
    assert.equal(sigAlg.status, "resolved", "signature_algorithm must still resolve");
    assert.equal(sigAlg.value, "SHA-256");
  });

  it("fields with no evidence fall through to UNRESOLVED (graph unavailable in test)", async () => {
    // Empty evidence — all fields should be unresolved, not throw
    const draft = await buildCloneDuoDraft({
      sourceItems: [{ title: "How to Configure SAML 2.0 for Zoom" }],
      sourceBundle: { ...makeSourceBundle(), evidence: [] },
    });

    const allStatuses = draft.fields.map((f) => f.status);
    // No field should be resolved when there's no evidence and graph is unavailable
    assert.ok(
      allStatuses.every((s) => s !== "resolved"),
      `Expected all unresolved, got: ${allStatuses.join(", ")}`
    );
    // No throws — all fields should have a status
    assert.ok(draft.fields.length > 0);
  });
});
```

- [ ] **Step 2: Run the full server test suite**

```bash
npm run test --prefix server
```

Expected: all tests pass including new regression tests.

- [ ] **Step 3: Confirm UNRESOLVED_AMBIGUOUS reduction (manual verification)**

This step is a sanity check, not automated. Verify that `cloneDuoGraphResolver.js` (Phase 3) is still being called for ambiguous fields by checking that the `resolvedBy` field is set correctly in the draft when a mock graph resolves it.

If you have access to a running GitNexus + indexed docs, run the Clone Duo flow against a real Okta SAML page and compare the field `status` counts before/after. The spec's acceptance criteria: `UNRESOLVED_AMBIGUOUS` count must decrease; `MISSING` count must not increase.

- [ ] **Step 4: Commit**

```bash
git add server/tests/clone-duo-phase4.test.js
git commit -m "test(clone-duo): add Phase 4 regression tests — field resolution and empty-evidence fallback"
```

---

## Final Verification

- [ ] Run full test suite one last time

```bash
npm run test --prefix server && npm run test:unit --prefix client
```

Expected: zero failures across both suites.

- [ ] Verify git log shows 7 commits from this plan

```bash
git log --oneline -8
```

Expected commits (newest first):
1. `test(clone-duo): add Phase 4 regression tests...`
2. `feat(clone-duo): Phase 4 — graph-backed resolution for missing SAML fields...`
3. `docs(readme): add GitNexus integration section...`
4. `feat(sync-engine): add SITENAVIGATOR_SEARCH_ENGINE flag...`
5. `fix(indexer): switch exec() shell string to execFile()...`
6. `docs(agents-md): replace agent-skills boilerplate...`
7. `docs(claude-md): replace agent-skills boilerplate...`
