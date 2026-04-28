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

<!-- gitnexus:start -->
# GitNexus — Code Intelligence

This project is indexed by GitNexus as **duo-sitenavigator** (3407 symbols, 4713 relationships, 110 execution flows). Use the GitNexus MCP tools to understand code, assess impact, and navigate safely.

> If any GitNexus tool warns the index is stale, run `npx gitnexus analyze` in terminal first.

## Always Do

- **MUST run impact analysis before editing any symbol.** Before modifying a function, class, or method, run `gitnexus_impact({target: "symbolName", direction: "upstream"})` and report the blast radius (direct callers, affected processes, risk level) to the user.
- **MUST run `gitnexus_detect_changes()` before committing** to verify your changes only affect expected symbols and execution flows.
- **MUST warn the user** if impact analysis returns HIGH or CRITICAL risk before proceeding with edits.
- When exploring unfamiliar code, use `gitnexus_query({query: "concept"})` to find execution flows instead of grepping. It returns process-grouped results ranked by relevance.
- When you need full context on a specific symbol — callers, callees, which execution flows it participates in — use `gitnexus_context({name: "symbolName"})`.

## Never Do

- NEVER edit a function, class, or method without first running `gitnexus_impact` on it.
- NEVER ignore HIGH or CRITICAL risk warnings from impact analysis.
- NEVER rename symbols with find-and-replace — use `gitnexus_rename` which understands the call graph.
- NEVER commit changes without running `gitnexus_detect_changes()` to check affected scope.

## Resources

| Resource | Use for |
|----------|---------|
| `gitnexus://repo/duo-sitenavigator/context` | Codebase overview, check index freshness |
| `gitnexus://repo/duo-sitenavigator/clusters` | All functional areas |
| `gitnexus://repo/duo-sitenavigator/processes` | All execution flows |
| `gitnexus://repo/duo-sitenavigator/process/{name}` | Step-by-step execution trace |

## CLI

| Task | Read this skill file |
|------|---------------------|
| Understand architecture / "How does X work?" | `.claude/skills/gitnexus/gitnexus-exploring/SKILL.md` |
| Blast radius / "What breaks if I change X?" | `.claude/skills/gitnexus/gitnexus-impact-analysis/SKILL.md` |
| Trace bugs / "Why is X failing?" | `.claude/skills/gitnexus/gitnexus-debugging/SKILL.md` |
| Rename / extract / split / refactor | `.claude/skills/gitnexus/gitnexus-refactoring/SKILL.md` |
| Tools, resources, schema reference | `.claude/skills/gitnexus/gitnexus-guide/SKILL.md` |
| Index, status, clean, wiki CLI commands | `.claude/skills/gitnexus/gitnexus-cli/SKILL.md` |

<!-- gitnexus:end -->
