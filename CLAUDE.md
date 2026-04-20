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
