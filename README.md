# SiteNavigator

A **documentation intelligence platform** for competitive gap analysis, content comparison, and vendor management. Index internal and competitor documentation (Okta, Entra, Ping Identity) to support gap analysis, change monitoring, smart template generation, and evidence tracking.

**Distributed as a portable Windows executable** — no installation, no external dependencies required. Self-contained .exe for Windows users; full source for developers.

The portable build now bundles a Ketch crawler binary inside the app package. End users still launch one SiteNavigator `.exe`; Ketch runs behind the server sync path and improves crawl performance, extraction quality, redirects, and quality signals without adding a second app to launch.

---

## Quick Start

### For End Users

1. Download the latest `sitenavigator-win.exe` from [GitHub Releases](https://github.com/sKlatdev/SiteNavigator/releases/latest)
2. Double-click to launch (no visible terminal, runs on port 8787 by default)
3. Browser opens automatically; if not, navigate to `http://localhost:8787`
4. Begin indexing by clicking **Resync** in the top menu

**Optional:** Set `SITENAVIGATOR_OPEN_BROWSER=false` environment variable before launch to disable auto-browser-open.

### For Developers

**Prerequisites:** Node.js >= 22 < 25 (download from [nodejs.org](https://nodejs.org))

```bash
# Clone repository
git clone https://github.com/sKlatdev/SiteNavigator.git
cd duo-sitenavigator

# Install all dependencies (root, client, server)
npm install
npm install --prefix client
npm install --prefix server

# Start local development (Vite client + Express server concurrently)
npm run dev

# Client runs on http://localhost:4173
# Server API on http://localhost:8787
# Keyboard walkthrough: npm run qa:keyboard --prefix client
```

Local development keeps a legacy crawler fallback if no Ketch binary has been built yet. To exercise the Ketch-backed sync path from source, build the bundled Ketch binary first:

```bash
npm run build:ketch --prefix server
```

---

## Project Architecture

### System Overview

**Three-tier stack:**
- **Frontend** ([client/](client/)) — React 19 + Vite + Tailwind CSS
- **Backend** ([server/](server/)) — Express 4 + Node 22 LTS, indexed search via Cheerio
- **Data** ([data/index.json](data/index.json)) — Single JSON file, portable between environments

**Workflow:**
1. User clicks **Resync** in UI
2. Server crawls seeded URLs (Duo docs, Okta docs, Entra, Ping docs) with depth-limited BFS
3. Extracts title, summary, last-updated date, category, vendor via Cheerio
4. Stores in `data/index.json` with metadata (firstSeenAt, updatedAt, contentHash)
5. Client fetches `/api/content` with filters (search, recency, category)
6. UI displays faceted explorer, compare mode, gap finder, watchlist, and template tools

### Client Application

**Key Features:**
- **Explorer** — Faceted search across all indexed content
  - Full-text search with ranking badges: exact phrase, exact token, full match, partial, includes
  - Recency filters: "recently updated", "newly discovered" (configurable 1–30 day window)
  - Category filters: docs, guides, blog, release notes, resources, help/KB, demos, competitor docs, other
  - Vendor classification: Duo, Okta, Entra, Ping Identity

- **Compare Mode** — Seed-based side-by-side search
  - Queue competitor pages, pull related matches
  - Save snapshots with custom ranking boost terms

- **Smart Gap Finder** — Automated gap analysis
  - Detects coverage gaps between Duo and competitors
  - Dismiss or confirm findings; builds feedback loop

- **Manage Customers** — Multi-customer rollout templates
  - Assign templates (core + add-on modules) to customers
  - Track implementation status (Not Interested → Discussed → Interested → In Progress → Implemented)
  - Export/import for backup and data portability

- **Watchlist** — Change monitoring
  - Define rules for content recency/updates
  - Trigger alerts when matching pages are discovered/updated

- **Evidence Trails** — Audit change history
  - Timeline of documentation updates per vendor

#### Client State Management
File: [client/src/App.jsx](client/src/App.jsx)

**Core state tree (25+ variables):**
- Content indexing: `indexedContent`, `contentState`, `contentMeta`
- Templates & customers: `templates`, `customers`, modal states
- Search & filtering: `query`, `activeFacetTags`, `selectedModes`, `recentDaysWindow` (1–30)
- Sync progress: `syncState` (loading/inProgress), `progress` (URL, depth %, count)
- UI: `dark` mode, `active` view, `mobileOpen` drawer
- Compare/Gap/Watchlist: `compareSeeds`, `gapResults`, `watchlists`, `alerts`

**Persistence:** All state persisted to localStorage (keys defined in [client/src/features/sitenavigator/constants.js](client/src/features/sitenavigator/constants.js))

#### Client Features Modules
File: [client/src/features/sitenavigator/](client/src/features/sitenavigator/)

- **constants.js** — Status types (Not Interested, Discussed, Interested, In Progress, Implemented), storage keys, default templates
- **utils.js** — localStorage access, template factories, focus management for keyboard nav
- **facets.js** — Tag-based filtering system; AND/OR/EXCLUDE combinators
- **searchRanking.js** — Full-text ranking with quoted phrase support; badge tiers (exact_phrase → partial → includes)
- **vendorSections.js** — Dynamic navigation tree generation from URL prefixes; vendor-specific section ordering

#### Client Accessibility & Keyboard
- **Focus management:** Modal and drawer focus traps; Escape closes, Tab wraps
- **Keyboard shortcuts:** `/` focuses search input
- **ARIA:** Complete semantic structure; screen reader annotations on interactive elements
- **Test coverage:** [client/tests/keyboard-walkthrough.spec.js](client/tests/keyboard-walkthrough.spec.js) validates Tab focus loops, Escape close behavior

**Run keyboard tests:**
```powershell
npm run qa:keyboard:e2e --prefix client
```

### Server Application

File: [server/src/](server/src/)

**Core modules:**

#### 1. **server.js** — HTTP API & content query
- **Health:** `GET /api/health` → `{ ok: true, service: "sitenavigator-server-node25" }`
- **Sync control:** `POST /api/sync` triggers crawl; `GET /api/sync/status` and `/api/sync/progress` poll progress
- **Content query:** `GET /api/content`
  - **Params:** `q` (search), `category`, `recentDays` (1–30), `page`, `pageSize`
  - **Returns:** Paginated items with recency signals, category/vendor derivation, facet counts
  - **Caching:** ETags + Cache-Control (15s default)

- **Import/Export:**
  - `GET /api/index/export` — Full index JSON
  - `POST /api/index/import` — Merge or replace mode
  - `POST /api/index/import-from-path` — Load from disk (path I/O gated in prod)
  - `POST /api/index/save-to-path`, `GET /api/index/path-info` — Persist/validate on disk

- **CORS:** Configurable allowlist (dev: localhost:5173 + env var; prod: explicit only)
- **Port retry:** Automatic fallback if port busy (configurable retry count)
- **Client serving:** Fallback SPA routing on non-API paths

**Environment variables:**
- `PORT` — Server port (default 8787)
- `PORT_RETRY_COUNT` — Retries on EADDRINUSE (default 5)
- `SITENAVIGATOR_DATA_DIR` — Index storage directory (default: `server/data`)
- `ENABLE_PATH_IMPORT` — Allow `/api/index/import-from-path` (false in prod)
- `ENABLE_INDEX_PATH_IO` — Allow path-info, save/load endpoints
- `SITENAVIGATOR_OPEN_BROWSER` — Auto-open browser (true for packaged build, false otherwise)
- `ALLOWED_ORIGINS` — CORS origins (comma-separated)
- `CONTENT_CACHE_MAX_AGE` — HTTP cache TTL in seconds (default 15)
- `SLOW_ROUTE_MS` — Slow route logging threshold (default 700ms)

#### 2. **crawler.js** — Document discovery & indexing

**Seeded URLs:** Duo docs, guides, resources, help, demo, blog + Okta, Entra, Ping Identity docs

**Crawling strategy:**
- Depth-limited BFS (3–4 levels per host)
- Concurrency: 8 workers
- Conditional GET with ETag/Last-Modified caching (304 → skip parsing)
- URL normalization: strip fragments, utm_* params, enforce trailing slash
- Host allowlist: duo.com, guide.duo.com, resources.duo.com, help.duo.com, demo.duo.com, help.okta.com, docs.pingidentity.com, learn.microsoft.com

**Metadata extraction:**
- **Category rules:** Host-based (resources.duo.com → resources) + path patterns (docs → release_notes if `-notes` in path)
- **Vendor derivation:** Hostname mapping (help.okta.com → Okta, learn.microsoft.com + Entra path → Entra, etc.)
- **Update date priority:**
  1. `meta[property="article:modified_time"]`
  2. `meta[name="last-modified"]`
  3. `meta[property="og:updated_time"]`
  4. `<time[datetime]>` first element
  5. Text pattern: "last updated on DATE" (ISO, M/D/Y, "MMM D, YYYY")
- **Summary:** First `<p>` in `<main>|<article>|<body>` (max 260 chars)
- **Content hash:** SHA256 of concatenated metadata (detects meaningful changes)

**Sitemap discovery:**
- Okta: Fetches XML sitemaps recursively
- Entra: JSON TOC parsing with recursive child extraction
- Other hosts: Standard link-following crawl

**Sync run tracking:** Records stats (scanned, discovered, changed, unchanged, skipped, errors)

#### 3. **store.js** — Single JSON persistence

File: [server/data/index.json](server/data/index.json)

Schema v2:
```json
{
  "meta": {
    "createdAt": "ISO_TIMESTAMP",
    "updatedAt": "ISO_TIMESTAMP",
    "schemaVersion": 2
  },
  "content": [
    {
      "id": "ci_<md5_of_url>",
      "url": "https://...",
      "title": "...",
      "category": "docs|blog|release_notes|...",
      "vendor": "Duo|Okta|Ping Identity|Entra",
      "tags": [..., "vendor_name"],
      "pathSummary": "hostname/path/to/page",
      "summary": "...",
      "pageLastUpdated": "YYYY-MM-DD",
      "contentHash": "sha256_hex",
      "firstSeenAt": "ISO_TIMESTAMP",
      "lastSeenAt": "ISO_TIMESTAMP",
      "updatedAt": "ISO_TIMESTAMP",
      "active": true|false
    }
  ],
  "syncRuns": [{ "id", "startedAt", "finishedAt", "status": "success|error", "stats" }],
  "fetchCache": { "https://...": { "etag", "lastModified", "lastSeenAt", "lastStatus" } }
}
```

**Atomicity:** Per-store writes; in-memory cache during sync; no transaction log.

**Data resolution priority:**
1. `process.env.SITENAVIGATOR_DATA_DIR`
2. Packaged exe: `<exe_dir>/data` (process.pkg detected)
3. Default: `server/data` (relative to __dirname)

#### 4. **recency.js** — Recency signal computation

**Signal priority:**
1. **new_page** — `firstSeenAt` within `recentDays`
2. **page_last_updated** — `pageLastUpdated` within `recentDays`
3. **changed_content** — `updatedAt` within `recentDays`
4. **none** — no recent signal

First matching signal is returned; client uses this to filter "recently updated" content on `/api/content` queries.

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

---

## Development Workflow

### Building & Testing

**Client:**
```bash
npm run lint --prefix client          # ESLint
npm run test:unit --prefix client     # Unit tests
npm run test:coverage:check --prefix client  # Coverage: 80% lines/functions, 70% branches
npm run build --prefix client         # Production build → client/dist
```

**Server:**
```bash
npm run test --prefix server          # Node test runner
npm run test:coverage:check --prefix server  # Coverage: 90% lines/functions, 85% branches
npm run build --prefix server         # Prepare client + bundle server → server/build/server.cjs
npm run build:ketch --prefix server   # Build bundled Ketch binary → server/vendor/ketch/
npm run build:portable --prefix server # Build bundled Ketch + portable core exe
```

**Portable build from repo root:**
```bash
npm run build:portable
```

This now compiles the Ketch binary, packages it into the server assets, builds `dist/sitenavigator-core.exe`, and then wraps that into the final `dist/sitenavigator-win.exe` launcher.

**Full project:**
```bash
npm run audit:all                      # Security audits (high severity)
npm run audit:portable:deps            # Dependency viability for portable runtime
npm run build:portable:verify          # Build + smoke test
npm run release:check                  # Pre-release gate (audits + build + smoke)
```

### Portable Packaging

**Build chain:**
1. `npm run build` — Client (Vite) + Server (esbuild)
2. `npm run package:portable:core --prefix server` — @yao-pkg/pkg bundles → `dist/sitenavigator-core.exe`
3. `powershell build-single-exe-launcher.ps1` — C# wrapper → `dist/sitenavigator-win.exe`

**Single executable features:**
- **Windowless startup** — No visible terminal window
- **Self-contained** — No Node.js, npm, or build tools required
- **Runtime extraction** — Core exe extracted to `%LOCALAPPDATA%/SiteNavigator/runtime/<hash>/` on first run
- **Environment pass-through** — All `SITENAVIGATOR_*` env vars forwarded to embedded server
- **Port fallback** — Retries on EADDRINUSE with automatic port increment
- **Data directory** — Defaults to `<exe_dir>/data`; can be overridden via `SITENAVIGATOR_DATA_DIR`

**Final artifacts:**
- `dist/sitenavigator-win.exe` — Portable Windows executable (~100 MB)
- `dist/data/index.json` — Base index created during smoke test
- `dist/sitenavigator-dist.zip` — Published on GitHub: contains `sitenavigator-win.exe` + `data/` folder

**Release destination:** [GitHub Releases](https://github.com/sKlatdev/SiteNavigator/releases)

---

## Branching & Release Policy

### Branch Strategy

- **`Dev`** — Working branch for all development
  - All new features, bug fixes, documentation go here
  - Routine commits and pushes target `Dev`
  - Can be merged into `main` for production release

- **`main`** — Production branch, reserved for releases only
  - Protected from direct feature commits
  - Merges from `Dev` trigger automatic release workflow
  - Every push publishes updated GitHub Latest Release

### Release Process

**Before production promotion:**
```bash
npm run release:check
```
This validates:
1. Security audits pass (all packages, high severity)
2. Dependencies safe for portable runtime
3. Portable executable builds without errors
4. Smoke tests pass (app launches, endpoints respond, data persists)

If all checks pass, proceed:
```bash
git checkout Dev
# ... make your changes, commit ...
git push origin Dev

# Merge Dev into main to trigger release
git checkout main
git merge --no-ff Dev -m "chore(release): promote <feature> from Dev"
git push origin main
# → Production Release workflow auto-runs, publishes GitHub Latest Release
```

**Release artifacts published:**
- Latest release tag: `production`
- Assets: `sitenavigator-win.exe`, `sitenavigator-dist.zip`
- Release notes: Auto-generated from commit history

### Phase Checkpoint Commits

For significant milestones, create phase commits:
```bash
pwsh ./scripts/commit-phase.ps1 -Phase "P2 complete"
```

Format: `chore(phase): <phase> checkpoint (<n> todos complete)`

See [docs/phase-commit-workflow.md](docs/phase-commit-workflow.md) for details.

---

## Architecture Decisions

### Why Single JSON File?
- Portable: Fits in release zip; easy to share/backup
- Stateless: Server reloads on each sync; no database needed
- Auditable: Full history in version control if desired
- Limitation: Not suitable for 100K+ pages; consider database if growing beyond 50K items

### Why Cheerio for Parsing?
- No browser overhead; pure Node.js parsing
- Sufficient for metadata extraction (title, summary, date)
- Handles malformed HTML gracefully
- Fast enough for 8 concurrent workers

### Why React Client?
- Rich interactive features (faceted search, drag-reorder, modals, compare mode)
- Tailwind for rapid UI iteration
- localStorage for offline state persistence
- Keyboard accessibility via focus management

### Why Portable Windows Exe?
- End users click once; no installation, no command line
- Local-first by default; all data stays on user's machine
- Embedded server + client = zero external dependencies

---

## Configuration & Environment

### Runtime and Dependency Policy

- Primary runtime: **Node 22 LTS**
- Secondary compatibility runtime: **Node 24 LTS**
- Supported range in package manifests: **>=22 <25**
- Stable dependencies only; no beta prereleases on `main`

See [docs/execution-checklist.md](docs/execution-checklist.md) for implementation roadmap.

### Common Environment Variables

**User-facing (launcher & server):**
- `PORT` — Server port (default 8787)
- `SITENAVIGATOR_DATA_DIR` — Where to store `index.json` (default: `<exe_dir>/data` or `server/data`)
- `SITENAVIGATOR_OPEN_BROWSER` — Auto-open browser on startup (true for packaged build)

**Development & testing:**
- `NODE_ENV` — "production" disables path I/O and local-only restrictions
- `ENABLE_PATH_IMPORT` — Allow import from arbitrary disk paths (false in prod)
- `ENABLE_INDEX_PATH_IO` — Allow save/load to disk
- `ALLOWED_ORIGINS` — CORS whitelist (comma-separated)
- `CONTENT_CACHE_MAX_AGE` — HTTP cache TTL in seconds (default 15)
- `SLOW_ROUTE_MS` — Log threshold for slow routes (default 700ms)

---

## Resources

- **Implementation Checklist:** [docs/execution-checklist.md](docs/execution-checklist.md)
- **Phase Commit Workflow:** [docs/phase-commit-workflow.md](docs/phase-commit-workflow.md)
- **Client App:** [client/](client/)
- **Server App:** [server/](server/)
- **Build Scripts:** [scripts/](scripts/), [server/scripts/](server/scripts/)
- **GitHub Repository:** https://github.com/sKlatdev/SiteNavigator
- **Latest Release:** https://github.com/sKlatdev/SiteNavigator/releases/latest
