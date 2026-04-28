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
| `SITENAVIGATOR_KETCH_CONCURRENCY` | `48` | Concurrent crawl workers |
| `SITENAVIGATOR_GITNEXUS_BIN` | `gitnexus` | Path to gitnexus binary (must be on PATH or set explicitly) |
| `SITENAVIGATOR_OPEN_BROWSER` | `true` | Set `false` to disable auto browser open on launch |
| `PORT` | `8787` | Server port |
| `SITENAVIGATOR_DATA_DIR` | `server/data` | Index storage directory |
| `SITENAVIGATOR_GRAPH_SEARCH_TIMEOUT_MS` | `5000` | Timeout in ms for `searchWithTimeout` calls to GitNexus graph search |
| `SITENAVIGATOR_SLOW_CRAWL_PAGE_MS` | `5000` | Log crawled pages where the gap between records exceeds N ms; set 0 to disable |

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

## Impeccable UI Recommendations

After **every edit** to any file in `client/src/`, scan the change against the table below. For each matching signal, append an **"Impeccable Recommendations"** block to your response containing:

1. The slash command to run (e.g. `/audit`)
2. What the command does
3. Which specific part of the change it targets
4. What outcome to expect

When asked "what should I run here?" or similar, read the current state of `client/src/` files and return the same format for the most relevant signals.

### Command-to-Trigger Mapping

| Change Signal | Commands to Recommend |
|---|---|
| New component added | `/audit`, `/critique`, `/harden` |
| Layout / spacing / grid changes | `/layout`, `/audit` |
| Color additions or changes | `/colorize`, `/audit` |
| Typography / font / text sizing | `/typeset`, `/clarify` |
| Animation or transitions added | `/animate` |
| Form fields, inputs, validation UI | `/harden`, `/audit`, `/clarify` |
| Loading states, empty states, errors | `/harden`, `/delight` |
| Modal, drawer, overlay added | `/critique`, `/audit` |
| Design feels flat or generic | `/bolder`, `/colorize` |
| Design feels cluttered or heavy | `/quieter`, `/distill` |
| New page or major feature area | `/critique`, `/audit`, `/polish` |
| Pre-ship / final cleanup | `/polish`, `/audit` |
| Performance concern (large renders) | `/optimize` |
| Responsive/mobile considerations | `/adapt`, `/audit` |
| Extraordinary visual effect wanted | `/overdrive` |

### Recommendation Format Example

> **Impeccable Recommendations**
>
> **/audit** — Runs technical quality checks (accessibility, performance, responsive). Targets the new modal you just added: it will check focus trapping, ARIA roles, and keyboard dismissal. Expected outcome: a report of issues with specific fixes.
>
> **/critique** — UX design review of hierarchy, clarity, and emotional resonance. Targets the modal layout: it will assess whether the information hierarchy guides the user correctly. Expected outcome: design feedback with suggested improvements.

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
