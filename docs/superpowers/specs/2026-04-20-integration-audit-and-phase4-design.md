# Integration Audit & Phase 4 Design

**Date:** 2026-04-20  
**Status:** Approved  
**Scope:** Ketch + GitNexus integration audit, documentation fixes, code gap fixes, Phase 4 Clone Duo NLP extraction  
**Author:** Jesse (via Claude Code)

---

## Context

Phases 1–3 of the Ketch/GitNexus integration have shipped (see `docs/superpowers/specs/2026-04-20-gitnexus-integration-design.md` in the Ketch repo for the original design). This document audits what was built, identifies documentation and code gaps, and specifies Phase 4.

---

## Audit: What Was Built

### Phase 1 — Crawl → Index Pipeline ✅
- Ketch: `--output-dir` and `--vendor` flags write per-vendor markdown files to `gitnexus-docs/`
- `gitNexusIndexer.js` triggers `gitnexus analyze` post-crawl, tracks progress
- `graphQueryClient.js` wraps GitNexus MCP over stdio with graceful fallback
- `server.js` starts MCP client at startup (non-blocking); adds `/api/graph/status`
- `/api/compare/related` endpoint backed by `graphQueryClient.search()` with legacy fallback
- Client: `compareMatching.js` calls server; `compareMatchingLegacy.js` kept as fallback

### Phase 2 — Gap Analysis ✅
- `/api/gap/analyze` endpoint backed by GitNexus with 503 fallback
- Client: `gapAnalysis.js` with `fetchGapItems()` (server-first + null fallback)
- Client: `App.jsx` gap step uses `fetchGapItems` instead of client-side token scoring

### Phase 3 — Clone Duo Graph Resolver ✅
- `cloneDuoGraphResolver.js` added: queries GitNexus per ambiguous field, picks top-scored candidate
- Wired into `resolveFieldState()` in `cloneDuoMapping.js` before returning `UNRESOLVED_AMBIGUOUS`
- Confidence threshold: 0.6, margin threshold: 0.15, timeout: 5s

### Phase 4 — Clone Duo Full NLP Extraction ❌ Not started
Specified below.

---

## Gaps Found

### Gap 1: CLAUDE.md contains wrong project content (Critical)
`CLAUDE.md` in `duo-sitenavigator/` contains the agent-skills boilerplate, not sitenavigator content. Any agent opening this repo gets incorrect project context.

**Fix:** Replace entirely with sitenavigator-specific CLAUDE.md (see Section 1 below).

### Gap 2: AGENTS.md contains wrong project content (Critical)
Same problem — agent-skills content, not sitenavigator content.

**Fix:** Replace entirely with sitenavigator-specific AGENTS.md.

### Gap 3: README missing GitNexus integration section (High)
README documents Ketch integration but has no section on GitNexus: no data flow description, no env vars for `SITENAVIGATOR_GITNEXUS_BIN`, no phase status, no Phase 4 roadmap note.

**Fix:** Add "GitNexus Integration" section to README.

### Gap 4: `gitNexusIndexer.js` uses `exec()` with shell string (Medium — security)
`analyzeAfterSync()` builds a shell command string and passes it to `exec()`. If `docsDir` or `gitnexusBin` contains shell metacharacters (spaces, `$`, backticks), behavior is undefined and potentially exploitable.

**Fix:** Switch to `execFile()` with args array. ~5-line change.

### Gap 5: `SITENAVIGATOR_SEARCH_ENGINE` flag never implemented (Medium — operational)
The original design spec defined `SITENAVIGATOR_SEARCH_ENGINE=gitnexus|legacy|auto` to let operators force legacy mode if GitNexus is degraded. It was never wired into the compare/gap handlers. Currently both endpoints silently fall back with no override mechanism.

**Fix:** Add `selectedSearchEngine()` helper in `syncEngine.js` (mirrors existing `selectedEngine()` pattern). Gate GitNexus path in `/api/compare/related` and `/api/gap/analyze` handlers. Default: `auto`.

---

## Section 1: Documentation Fixes

### CLAUDE.md (replace entirely)

Content to cover:
- Project purpose: documentation intelligence platform for competitive gap analysis (Duo vs. Okta, Entra, Ping)
- Three-layer stack: Ketch (crawler) → GitNexus (knowledge graph) → SiteNavigator (UI + API)
- Key server modules and their responsibilities:
  - `ketchSync.js` — vendor crawl orchestration, Ketch binary management, writes to `gitnexus-docs/`
  - `gitNexusIndexer.js` — post-crawl `gitnexus analyze` trigger, index progress tracking
  - `graphQueryClient.js` — GitNexus MCP stdio client, `search()` and `cypher()`, graceful fallback
  - `syncEngine.js` — engine selector: `ketch` (default when binary present) or `legacy`
  - `cloneDuoGraphResolver.js` — GitNexus-powered ambiguity resolution for SAML field extraction
- Environment variables (full table — see env var reference below)
- Coding boundaries:
  - Always: use `uipro` design system for all UI design work
  - Always: GitNexus paths must degrade gracefully when `graphQueryClient.isAvailable() === false`
  - Never: call `gitnexus` CLI directly from request handlers — use `graphQueryClient` or `gitNexusIndexer`
  - Never: block the sync response on `gitnexus analyze` (must remain fire-and-forget)

### AGENTS.md (replace entirely)

Content to cover:
- Repo overview and purpose
- Module map (server modules + client features)
- Integration topology diagram (text):
  ```
  Ketch crawl → gitnexus-docs/ → gitnexus analyze → .gitnexus/ → MCP server → graphQueryClient → API endpoints → UI
  ```
- Agent-specific guidance:
  - `graphQueryClient.isAvailable() === false` is normal (GitNexus not installed / first run before index); handle it as degraded, not error
  - `SITENAVIGATOR_SYNC_ENGINE=auto` selects Ketch if binary present, legacy otherwise
  - `SITENAVIGATOR_SEARCH_ENGINE=auto` selects GitNexus-first if available, legacy otherwise
  - All UI design work uses the `uipro` design system
- Phase status table (1–4)

### README.md additions

Add "GitNexus Integration" section after the existing Ketch section:
- Three-layer data flow (one paragraph)
- What each phase delivered (bullet list)
- Phase 4 status: "planned — see `docs/superpowers/specs/`"
- Env var reference table (all GitNexus-related vars)

---

## Section 2: Code Fixes

### Fix 1: `gitNexusIndexer.js` — `exec()` → `execFile()`

**File:** `server/src/gitNexusIndexer.js`

Replace:
```js
import { exec } from "node:child_process";
// ...
const proc = exec(`"${gitnexusBin}" ${args.map((a) => `"${a}"`).join(" ")}`);
```

With:
```js
import { execFile } from "node:child_process";
// ...
const proc = execFile(gitnexusBin, args);
```

No other changes needed — `proc.on("error")` and `proc.on("exit")` work identically on `execFile` child processes.

### Fix 2: `syncEngine.js` — `SITENAVIGATOR_SEARCH_ENGINE` flag

**File:** `server/src/syncEngine.js`

Add alongside existing `selectedEngine()`:

```js
function selectedSearchEngine() {
  const requested = String(process.env.SITENAVIGATOR_SEARCH_ENGINE || "auto").trim().toLowerCase();
  if (requested === "legacy") return "legacy";
  if (requested === "gitnexus") return "gitnexus";
  return "auto"; // default: try GitNexus, fall back to legacy
}

export function getSelectedSearchEngine() {
  return selectedSearchEngine();
}

export function shouldUseGitNexusSearch() {
  const engine = selectedSearchEngine();
  if (engine === "legacy") return false;
  return true; // "gitnexus" or "auto" — caller checks graphQueryClient.isAvailable()
}
```

**File:** `server/src/server.js`

Import `shouldUseGitNexusSearch` from `syncEngine.js`. In the `/api/compare/related` handler, gate the GitNexus path:

```js
if (!shouldUseGitNexusSearch() || !graphQueryClient.isAvailable()) {
  // legacy path
}
```

Apply same gate to `/api/gap/analyze` handler.

---

## Section 3: Phase 4 — Clone Duo Full NLP Extraction

### Problem

`cloneDuoMapping.js` extracts 20+ SAML fields via alias arrays + regex over raw DOM text. This produces `UNRESOLVED_AMBIGUOUS` when multiple patterns match the same text, and `MISSING` when patterns don't fire at all. Phase 3 (`cloneDuoGraphResolver.js`) reduced ambiguity by querying GitNexus for the top-scored candidate — but the inputs to that query are still the same alias-matched candidates.

The root issue: the extractor doesn't know *where in the document* a value appeared. The graph does.

### Approach

Three-stage pipeline replacing `cloneDuoMapping.js`'s inner loop:

**Stage 1 — Graph Query per Field**

For each of the 20+ SAML field definitions, call `graphQueryClient.search(fieldLabel + " " + fieldAliases.join(" "), { limit: 3 })`. Returns ranked sections with:
- `score` — BM25 + semantic confidence
- `excerpt` — surrounding text (the value)
- `url` — source page
- Implicit heading context from GitNexus Section nodes (which H2/H3 the value lives under)

This replaces the alias-array scan over raw text with a ranked semantic search over full content.

**Stage 2 — Revised `resolveFieldState()`**

Current signature: `resolveFieldState(field, evidence)` where `evidence` is alias-match results.

New: `evidence` is augmented with graph hits from Stage 1. Each hit includes a `documentPosition` score (earlier in document = higher weight for required fields like entity ID). Field resolution becomes:

1. If one graph hit scores above `field.confidenceThreshold` (per-field, stored in field definition) → resolved
2. If multiple hits, pick highest `score × positionWeight`
3. If no hits above threshold → pass candidates to `cloneDuoGraphResolver.js` (Phase 3 logic, unchanged)
4. If still unresolved → `UNRESOLVED_AMBIGUOUS` (same as today)

Per-field `confidenceThreshold` defaults to `0.6` (current global constant) but can be tuned per field.

`positionWeight` is derived from the GitNexus hit's section line number relative to total document lines: `positionWeight = 1 - (sectionStartLine / totalDocLines)`. Sections near the top of the document score higher. If GitNexus does not return line numbers, `positionWeight` defaults to `0.5` (neutral).

**Stage 3 — Fallback Parity**

When `graphQueryClient.isAvailable() === false`, skip Stage 1 entirely. Existing alias-array extraction runs as today. No regression.

### Files Changed

| File | Change |
|------|--------|
| `server/src/cloneDuoMapping.js` | Add Stage 1 graph query; augment evidence before `resolveFieldState()` |
| `server/src/cloneDuoSchemas.js` | Add optional `confidenceThreshold` per field definition (default 0.6) |
| `server/src/cloneDuoGraphResolver.js` | No change — still used for residual ambiguity |

### What Doesn't Change

- Review UI
- Draft schema and export format
- `cloneDuoExtraction.js` DOM traversal (Stage 1 supplements it, not replaces)
- `cloneDuoGeneration.js`
- All fallback behavior when GitNexus is unavailable

### Success Criteria

Run extraction on the competitor SAML pages already used as fixtures in `server/tests/clone-duo-mapping.test.js` (Okta `saml-doc.okta.com/SAML_Docs/` URLs). Add at least one Entra and one Ping page as new fixtures before the Phase 4 implementation begins. Compare field coverage:
- `UNRESOLVED_AMBIGUOUS` count must decrease vs. current baseline
- `MISSING` count must not increase
- No new `UNRESOLVED_AMBIGUOUS` fields that were previously `RESOLVED`

---

## Environment Variable Reference

| Variable | Default | Description |
|----------|---------|-------------|
| `SITENAVIGATOR_SYNC_ENGINE` | `auto` | `ketch`, `legacy`, or `auto` (ketch if binary present) |
| `SITENAVIGATOR_SEARCH_ENGINE` | `auto` | `gitnexus`, `legacy`, or `auto` (gitnexus-first with fallback) |
| `SITENAVIGATOR_KETCH_BIN` | (bundled) | Path to ketch binary; overrides bundled binary |
| `SITENAVIGATOR_KETCH_DEPTH` | `3` | BFS crawl depth per vendor |
| `SITENAVIGATOR_KETCH_CONCURRENCY` | `8` | Concurrent crawl workers per vendor |
| `SITENAVIGATOR_GITNEXUS_BIN` | `gitnexus` | Path to gitnexus binary; must be on PATH or set explicitly |
| `SITENAVIGATOR_OPEN_BROWSER` | `true` | Set `false` to disable auto browser open on launch |

---

## UI Design System

All UI design work in this repository — new components, feature additions, layout changes — must use the **`uipro` design system**. This applies to Claude Code, Cursor, Copilot, and any other agent working in this repo.

---

## Implementation Order

1. Fix CLAUDE.md (unblocks all agents immediately)
2. Fix AGENTS.md (unblocks all agents immediately)
3. Fix `gitNexusIndexer.js` exec → execFile (small, standalone, no deps)
4. Fix `syncEngine.js` + `server.js` search engine flag (small, standalone)
5. Update README (documents the above)
6. Implement Phase 4 Stage 1 + Stage 2 in `cloneDuoMapping.js`
7. Add per-field `confidenceThreshold` to `cloneDuoSchemas.js`
8. Validate Phase 4 against 5 test SAML pages

---

## Non-Goals

- Replacing `cloneDuoExtraction.js` DOM traversal (Phase 5)
- Real-time incremental GitNexus indexing
- UI changes beyond what Phase 4 field confidence scores require
- Modifying GitNexus internals
- crawler4ai (not applicable)
