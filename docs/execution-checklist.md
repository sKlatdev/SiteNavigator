# SiteNavigator Execution Checklist

Date: 2026-03-12

## Priority Track A: Runtime and Dependency Stability

- [x] 1. Define and publish runtime/dependency policy in root docs.
- [x] 2. Standardize Node support range to >=22 <25 in client and server manifests.
- [x] 3. Replace client beta tooling with stable versions and refresh lockfile.
- [x] 4. Add workspace Node version pinning for consistent local development.
- [x] 5. Add CI validation for Node 22 and Node 24 compatibility lanes.

## Priority Track B: Functional and Security Fixes

- [x] 6. Fix template export content reference mismatch (`catalog` vs `indexed`).
- [x] 7. Normalize crawler seed URLs before queueing to prevent duplicate records.
- [x] 8. Restrict `/api/index/import-from-path` to local/dev use and safe paths.
- [x] 9. Tighten CORS for non-local deployments.

## Priority Track C: Reliability and Maintainability

- [x] 10. Replace `useMemo` side-effect with `useEffect` for dark mode class toggling.
- [x] 11. Externalize API base URL via Vite env variable.
- [x] 12. Remove unused starter stylesheet and dead styles.
- [x] 13. Break `client/src/App.jsx` into feature modules.

## Priority Track D: UX, UI, and Performance Enhancements

- [x] 14. Add mobile-friendly collapsible navigation behavior.
- [x] 15. Add accessibility labels and keyboard focus improvements for icon controls.
- [x] 16. Implement real checklist view with actionable grouped status data.
- [x] 17. Memoize expensive filtering/grouping paths in catalog views.
- [x] 18. Debounce autosave/localStorage writes and reduce write frequency.
- [x] 19. Add fetch cancellation/backoff for sync polling and content refresh.

## React + Node Optimization Pass (Today)

- [x] 20. React: Use `useMemo` for catalog filtering/grouping and avoid redundant recomputation.
- [x] 21. React: Use debounced search input (150-250ms) to smooth typing on large datasets.
- [x] 22. React: Add `useDeferredValue` for query to keep UI responsive during expensive updates.
- [x] 23. React: Add stronger loading/error/retry UX states for sync and content fetch flows.
- [x] 24. React: Improve mobile navigation with collapsible sidebar + focus management.
- [x] 25. Node: Add server-side content filtering (`q`, `category`) to reduce client workload.
- [x] 26. Node: Add API pagination (`page`, `pageSize`) and return metadata for large indexes.
- [x] 27. Node: Add lightweight response caching headers for `/api/content` reads.
- [x] 28. Node: Add request timing logs and slow-route warning thresholds for observability.

## Prioritized Implementation Map

### P0: Foundation and Safety (Do First)

Goal: Prevent regressions while enabling aggressive UX changes.

- [x] A1. Fix template export reference mismatch.
- [x] A2. Normalize crawler start URLs.
- [x] A3. Harden import path endpoint and tighten CORS.
- [x] A4. Replace `useMemo` side-effect with `useEffect`.
- [x] A5. Externalize API base URL.

Exit Criteria:

- Exported templates contain correct referenced content.
- Crawl output no longer includes duplicate canonical URLs.
- Import endpoint rejects unsafe paths.
- Client and server run with env-configured API target.

### P1: High-Impact UX and Responsiveness (Quick Wins)

Goal: Improve perceived speed and day-to-day usability without major architectural risk.

- [x] B1. Debounced search (150-250ms).
- [x] B2. `useDeferredValue` for heavy query-driven views.
- [x] B3. Memoize catalog filtering/grouping.
- [x] B4. Add robust loading/error/retry states for sync/content.
- [x] B5. Remove unused starter CSS and dead styles.

Exit Criteria:

- Search remains smooth on larger content sets.
- Main views stay responsive during sync and filter operations.
- Error handling clearly explains next user action.

### P2: Information Architecture Upgrade (Medium Risk)

Goal: Move from page-style navigation to workflow-oriented platform behavior.

- [x] C1. Implement collapsible mobile sidebar with focus management.
- [x] C2. Build first-class Checklist Workspace screen.
- [x] C3. Add accessibility labels and keyboard-first interactions.
- [x] C4. Introduce unified Explorer filtering model across categories.

Exit Criteria:

- Mobile navigation is task-usable end-to-end.
- Checklist workflow is executable without modal hopping.
- Core actions are keyboard and screen-reader friendly.

### P3: Data and API Throughput (Medium Risk)

Goal: Reduce client load and scale read performance as index size grows.

- [x] D1. Add server-side query/category filtering.
- [x] D2. Add pagination with metadata.
- [x] D3. Add cache headers for `/api/content`.
- [x] D4. Add request timing and slow-route warnings.

Exit Criteria:

- Payload size and client compute cost are reduced for large datasets.
- API latency and slow-route visibility are measurable.

### P4: Platform Experience Redesign (Higher Risk, Bigger Lift)

Goal: Deliver a bold command-center product experience.

- [x] E1. Command palette for global actions.
- [x] E2. Customer cockpit timeline and decision metrics dashboard.
- [x] E3. Composable template modules (core + add-ons).
- [x] E4. Personalization: saved views, pinned filters, custom cards.
- [x] E5. Collaboration primitives: ownership, watchers, comments.

### P5: Packaging and Release Hardening

Goal: Make portable delivery deterministic and safe for release.

- [x] F1. Ignore generated server build artifacts (`server/public`, `server/build`) to prevent accidental commits.
- [x] F2. Add portable executable smoke test automation and root npm wiring.
- [x] F3. Add root release gates for audit and packaged runtime verification.
- [x] F4. Build a single native Windows launcher executable so startup does not require a visible terminal window.

Exit Criteria:

- Portable smoke test passes via one command from repo root.
- Release gate command (`npm run release:check`) is available and documented.
- Portable distribution is a single executable (`dist/sitenavigator-win.exe`) that does not open a visible command prompt window.

Exit Criteria:

- Users can execute core flows from a unified command center.
- Dashboard indicates what to do next, not only counts.

### Dependency Order

- P0 -> P1 -> P2/P3 (parallel) -> P4

### Suggested Working Mode for Today

- [x] Wave 1: Complete P0 (safety + correctness).
- [x] Wave 2: Complete P1 (speed + UX quick wins).
- [x] Wave 3: Complete P3 (API throughput), then P2 navigation/checklist upgrades.
- [x] Wave 4: Start P4 with command palette and cockpit spike.

## Progress Notes

- Completed 1-5 as part of initial execution pass.
- Added a dedicated React + Node optimization pass to execute UX and performance work today.
- Completed Wave 1 (P0): safety and correctness fixes across export, crawler normalization, server path/CORS hardening, and client config/effect cleanup.
- Completed Wave 2 (P1): debounced and deferred search, memoized catalog derivations, stronger content loading/error/retry UX, and removal of unused starter stylesheet.
- Completed Wave 3 (P3): server-side filtering and pagination, cache headers/ETag support for content reads, and slow-route timing logs.
- Completed Wave 3.5 client integration: content view now consumes server query/category/page metadata, autosave is debounced, sync polling has backoff with cancellation, and P2 mobile nav/checklist workspace is now active.
- Completed P2 accessibility/explorer pass: icon/control labels and keyboard focus shortcuts added, plus unified Explorer filter workflow across categories.
- Completed Wave 4 P4 spike: command palette (Ctrl/Cmd+K) shipped with global actions, and Dashboard now includes customer cockpit decision metrics plus recent timeline.
- Completed P4 E3/E4 build-out: templates now support composable core/add-on modules, plus saved views and pinned filters are available in workspace chips and command palette actions.
- Added targeted keyboard walkthrough script (`npm run qa:keyboard`) and patched remaining focus edge cases for mobile nav and modal flows.
- Added inline rename/delete controls for individual saved views and pinned filters in workspace chips.
- Added Playwright keyboard automation (`npm run qa:keyboard:e2e`) for command palette, search focus, focus traps, saved/pinned controls, and collaboration flow.
- Completed maintainability refactor: extracted SiteNavigator constants and shared utilities from `App.jsx` into feature modules under `client/src/features/sitenavigator/`.
- Completed P5 implementation: artifact ignore policy, portable smoke automation, release gate scripts, and single-executable windowless startup packaging are now in place.