# SiteNavigator UI Overhaul — Design Spec

**Date:** 2026-04-22
**Status:** Approved for planning
**Scope:** Reskin + full restructure of the SiteNavigator client UI to match the "Soft Intelligence" design schema.
**Source schema:** [docs/superpowers/Braindumps/DesignSchema.md](../Braindumps/DesignSchema.md)

## Goal

Transform the SiteNavigator client from its current cyan/teal light-themed glassmorphism into the obsidian + indigo "Soft Intelligence" aesthetic described in the design schema, while simultaneously decomposing the 6,868-line `client/src/App.jsx` into a layered architecture: tokens → shell → primitives → feature views.

The overhaul is structural as well as visual: feature views are extracted into their own files, navigation moves from internal state to real URLs via react-router, modals migrate from a hand-rolled `BaseModal` (with custom focus trap) to Radix UI primitives, and theming collapses to obsidian-only.

## Non-Goals

- Light theme — removed entirely (was: dual light/dark with light as default).
- Sidebar collapse/expand toggle — not in v1.
- A `/v2` parallel namespace or feature flag — rollout is in-place per phase.
- Redux/Zustand or any external state library — React context is sufficient.
- `tailwind-merge`, `class-variance-authority` — `clsx` is enough.
- Storybook / component playground — separate effort.
- Keyboard shortcut system beyond `⌘K` global search — separate effort.
- Animations beyond schema-prescribed 150–200ms transitions (no scroll-driven, no spring physics, no shaders).
- Restructuring `client/src/features/sitenavigator/` logic files (constants, utils, facets, ranking, gapAnalysis, vendorSections) — pure logic, no payoff in moving.
- Refactoring `CloneDuoWorkspace` — preserved as-is, inherits new tokens automatically via CSS variables.
- Test infrastructure changes — existing Vitest + Node test runner is reused.

## Architecture

Four layers, three phases.

```
┌─ Layer 4 — Feature views (Dashboard, Catalog, Compare, Gap, Watchlist,
│             Templates, Customers, Audit, Checklist, Sync/Settings)
├─ Layer 3 — Primitives (Button, Card, Input, Select, Tabs, Tooltip,
│             Dialog, DropdownMenu, Toast, Badge, EmptyState)
├─ Layer 2 — Shell (Sidebar, TopBar, AppLayout, Router outlet)
└─ Layer 1 — Tokens (CSS variables: color, type, radius, motion, elevation)
```

| Phase | Layers | Outcome |
|---|---|---|
| **1** | 1 + 2 | Tokens + shell + router skeleton. Old views still rendered, but reskinned in place by inheriting new tokens. App looks new, behaves identically. |
| **2** | 4 | Extract feature views one at a time into `client/src/features/<name>/`. Each extraction is its own PR with screenshot diff. App.jsx shrinks toward <300 lines. |
| **3** | 3 | Introduce Radix-backed primitives. Migrate modals/dropdowns/tabs/toasts to them. Retire the hand-rolled `BaseModal` focus trap. |

Phases ship independently to `main` — no parallel namespace. Each phase boundary leaves the app in a working, releasable state.

## Layer 1 — Token System

New file: `client/src/tokens.css` replaces both `glass-tokens.css` and the token portion of `index.css`.

### Color tokens

```css
:root {
  --bg-base:        #051424;                       /* Level 1 — obsidian base */
  --bg-panel:       rgba(13, 28, 45, 0.85);        /* Level 2 — translucent panel */
  --bg-overlay:     rgba(30, 41, 59, 0.9);         /* Level 3 — modal/popover */
  --border-subtle:  #2c3a4c;
  --border-strong:  #3b4d63;

  --accent:         #818cf8;                       /* Indigo Soft */
  --accent-hover:   #6366f1;
  --accent-press:   #4f46e5;
  --success:        #34d399;                       /* Emerald Soft */
  --warning:        #fbbf24;                       /* Amber Soft */
  --critical:       #fb7185;                       /* Rose Soft */

  --text-primary:   #fafafa;                       /* zinc-50, ~90% contrast */
  --text-secondary: #a1a1aa;                       /* zinc-400, ~60% contrast */
  --text-tertiary:  #71717a;                       /* zinc-500, ~45% contrast */
}
```

### Type tokens

```
--font-sans: "Inter", system-ui, sans-serif
--font-mono: "JetBrains Mono", ui-monospace, monospace

--text-display: 1.875rem / 2.25rem  / 600 / -0.02em
--text-title:   1.25rem  / 1.75rem  / 600 / -0.01em
--text-card:    1rem     / 1.5rem   / 600
--text-body:    0.875rem / 1.375rem / 400
--text-micro:   0.75rem  / 1.125rem / 400
--text-label:   0.6875rem / 1rem    / 600 / 0.14em uppercase
```

### Geometry & motion tokens

```
--radius-container: 1rem      (16px)
--radius-control:   0.5rem    (8px)
--radius-pill:      9999px

--blur-panel:   18px
--blur-overlay: 24px

--motion-fast:   150ms cubic-bezier(0.4, 0, 0.2, 1)
--motion-medium: 200ms cubic-bezier(0.4, 0, 0.2, 1)

--shadow-panel:   0 8px 32px rgba(0, 0, 0, 0.32)
--shadow-overlay: 0 24px 64px rgba(0, 0, 0, 0.5)
--glow-focus:     0 0 0 3px rgba(129, 140, 248, 0.35)
```

### Structural changes to existing CSS

- `:root` is the only theme block. All `.dark { ... }` selectors removed.
- `body` background becomes a single radial-gradient over `--bg-base` with two indigo + emerald glow accents (replacing the cyan/teal current ones).
- The escape hatches **stay**, scoped to the new variables: `body.content-view-no-fx`, `.content-stable-paint`, `.app-stable-paint`, `.modal-open`, `.catalog-grid`. They suppress `backdrop-filter` and transitions on dense pages where blur stacks cause flicker on Windows/Chrome — this need does not go away.
- `glass-surface` → `panel` (16px radius, `--shadow-panel`, indigo border on hover).
- `glass-control` → `control` (8px radius, focus ring uses `--glow-focus`).
- `glass-nav-item-active` → flat `--accent` fill with soft indigo box-shadow (replaces cyan/teal gradient).
- Tailwind config gets matching theme extensions so utility classes (`bg-accent`, `text-text-secondary`, `rounded-container`) work alongside CSS variables.

### Font loading

Switch from Google Fonts CDN (current `@import url("...fonts.googleapis.com...")` in `index.css`) to npm packages:

```
@fontsource/inter
@fontsource/jetbrains-mono
```

Imported in `main.jsx`. This is a non-negotiable change because the portable Ketch build must launch without internet access.

## Layer 2 — The Obsidian Shell

New files:

- `client/src/shell/AppLayout.jsx` — fixed sidebar + top bar + `<Outlet/>`
- `client/src/shell/Sidebar.jsx`
- `client/src/shell/TopBar.jsx`
- `client/src/shell/router.jsx`
- `client/src/shell/navConfig.js`

### Sidebar (200px fixed, full-height, "Sidebar A")

- Brand block at top: 28px gradient mark + "SiteNavigator" wordmark in JetBrains Mono.
- Three groups, separated by `--text-label` headers:
  - **Workspace** — Dashboard, Catalog, Compare, Gap Finder, Watchlist, Templates, Customers
  - **Vendors** — Duo, Okta, Entra, Ping Identity (each links to a filtered catalog view at `/vendors/:vendor`)
  - **Settings** (pinned to bottom via `mt-auto`) — Audit, Checklist, Sync · Settings
- Active item: flat `--accent` fill, `text-bg-base`, soft indigo box-shadow.
- Hover: `translateX(2px)`, panel-tinted background (preserves current `glass-nav-item:hover`).
- Surface: `bg-panel` with `backdrop-filter: blur(--blur-panel)`, `border-right: 1px solid --border-subtle`. Flush against content (no rounded right edge).
- Width is fixed at 200px. No collapse toggle in v1.

### TopBar (56px tall, slim translucent)

- **Left:** breadcrumb (`Workspace › Dashboard`), derived from current route.
- **Center:** global search input — `<Input>` primitive with `⌘K` hint badge. Phase 1 routes to existing search wiring; Phase 3 becomes a Radix `Dialog`-backed command palette.
- **Right:** utility cluster — sync status pill (reuses `SyncStatusPanel` data), settings icon button.
- Surface: `bg-panel` at 70% opacity, `backdrop-filter: blur(--blur-panel)`, `border-bottom: 1px solid --border-subtle`. Sticky to viewport top.

### AppLayout

```jsx
<div className="min-h-screen bg-bg-base text-text-primary">
  <Sidebar />
  <div className="ml-[200px] flex min-h-screen flex-col">
    <TopBar />
    <main className="flex-1 p-6"><Outlet /></main>
  </div>
</div>
```

### Routing

`createBrowserRouter` from `react-router-dom`. One root route (`AppLayout`) and child routes per feature view:

- `/` → redirect to `/dashboard`
- `/dashboard`, `/catalog`, `/compare`, `/gap`, `/watchlist`, `/templates`, `/customers`, `/audit`, `/checklist`, `/settings`
- `/vendors/:vendor` → CatalogView with vendor filter prefilled
- `/clone-duo` → existing `CloneDuoWorkspace`
- `*` → `NotFoundView` (EmptyState + back-to-dashboard link)

**Server SPA fallback already exists** at `server/src/server.js:810` — `app.get(/^(?!\/api(?:\/|$)).*/, ...)` serves `index.html` for non-API paths. No server change needed.

### Migration of view state

- The current `view`/`setView` pattern in `App()` is replaced by `useLocation()`-derived state.
- All existing `STORAGE_KEYS` localStorage entries keep their semantics — no data migration.
- Modal open-state stays local to each feature view.

## Layer 3 — Primitives & Radix Migration (Phase 3)

### Dependencies added

```
@radix-ui/react-dialog
@radix-ui/react-dropdown-menu
@radix-ui/react-tabs
@radix-ui/react-tooltip
@radix-ui/react-select
@radix-ui/react-toast
@fontsource/inter
@fontsource/jetbrains-mono
react-router-dom
clsx
```

### Primitive inventory

| Primitive | Built on | Replaces |
|---|---|---|
| `Button` | native `<button>` | inline `className="px-3 py-2 rounded-lg ..."` patterns |
| `Card` | native `<div>` | `glass-surface` className usage |
| `Input` / `Textarea` | native | `glass-control` inputs |
| `Select` | `@radix-ui/react-select` | native `<select>` + `selectCls()` helper |
| `Dialog` | `@radix-ui/react-dialog` | hand-rolled `BaseModal` + `getFocusableElements` focus trap |
| `DropdownMenu` | `@radix-ui/react-dropdown-menu` | ad-hoc menus in TopBar / row actions |
| `Tabs` | `@radix-ui/react-tabs` | `CATALOG_TABS` switching pattern |
| `Tooltip` | `@radix-ui/react-tooltip` | `title` attributes and `PageInfoButton` popover |
| `Toast` | `@radix-ui/react-toast` | hand-rolled `Toast` component |
| `Badge` | native `<span>` | quality/search badge inline patterns |
| `EmptyState` | native | existing `EmptyState` component (lifted to primitive) |

### Modal migration tactic

- **Phase 3.1:** Replace `BaseModal` internals with Radix `<Dialog>` while keeping the same prop API (`open`, `title`, `onClose`, `widthClass`, `children`). All ~10 modal consumers keep working unchanged. Hand-rolled focus trap, escape handling, and `modal-open` body class management get deleted from `BaseModal`.
- **Phase 3.2:** Replace `ConfirmModal` with a `<ConfirmDialog>` wrapping the new `<Dialog>`.
- **Phase 3.3:** Migrate one feature's modals at a time to the primitive directly, dropping the legacy `BaseModal` shim only after the last consumer is gone.

### CSS escape hatch preservation

The `modal-open` body class trick that suppresses transitions on background `glass-surface` elements during modal opens stays. Radix sets `data-state="open"` on its dialog root; we attach the `modal-open` class via Radix's `onOpenChange` callback.

### Toast migration

The current `Toast` is a single global slot in App.jsx. Radix `<Toast.Provider>` lives in `AppLayout`; a `useToast()` hook exposes `show(message, options)`. Existing callers swap `setToast({...})` for `toast.show(...)`.

### Tooltip migration

Every `title="..."` attribute on icon buttons in the sidebar and top bar becomes a `<Tooltip>` wrapper. Largest find-replace, smallest behavioral change.

## Layer 4 — App.jsx Decomposition

### Target file layout

```
client/src/
├── App.jsx                              (<300 lines: <RouterProvider/> + global providers)
├── tokens.css                            (Layer 1)
├── main.jsx                              (unchanged except font imports)
├── shell/
│   ├── AppLayout.jsx
│   ├── Sidebar.jsx
│   ├── TopBar.jsx
│   ├── router.jsx
│   └── navConfig.js
├── primitives/                           (Layer 3 — Phase 3)
│   ├── Button.jsx, Card.jsx, Input.jsx
│   ├── Dialog.jsx, DropdownMenu.jsx, Tabs.jsx
│   ├── Tooltip.jsx, Select.jsx, Badge.jsx
│   ├── Toast.jsx, EmptyState.jsx
│   └── index.js                          (barrel export)
├── shared/
│   ├── BadgeRecentlyUpdated.jsx
│   ├── QualitySignals.jsx
│   ├── SearchBadgePopover.jsx
│   ├── StatusSelect.jsx
│   ├── PageInfoButton.jsx
│   ├── ToolComputeStatus.jsx
│   ├── ToolDetailsDisclosure.jsx
│   ├── CriticalWarningBanner.jsx
│   └── format.js                         (formatDuration, formatSyncEngineLabel, etc.)
├── features/
│   ├── dashboard/DashboardView.jsx
│   ├── catalog/
│   │   ├── CatalogView.jsx
│   │   ├── CatalogCard.jsx
│   │   ├── FacetedTagFilterPanel.jsx
│   │   └── catalogHelpers.js              (isOktaItem, isEntraItem, isPingItem, etc.)
│   ├── compare/
│   │   ├── CompareModeView.jsx
│   │   ├── CompareDiagnosticsPanel.jsx
│   │   ├── RelatedMatchesPanel.jsx
│   │   └── ChangeHeatmapPanel.jsx
│   ├── gap/
│   │   ├── SmartGapFinderView.jsx
│   │   └── AutoBriefsPanel.jsx
│   ├── watchlist/WatchlistView.jsx
│   ├── graph/RelationshipGraphView.jsx   (routed under Compare)
│   ├── evidence/EvidenceTrailsView.jsx   (routed under Audit)
│   ├── templates/
│   │   ├── TemplatesView.jsx
│   │   ├── TemplateDetailModal.jsx
│   │   ├── CreateTemplateModal.jsx
│   │   └── AssignToTemplateModal.jsx
│   ├── customers/
│   │   ├── CustomersView.jsx
│   │   ├── ManageCustomersView.jsx
│   │   ├── CustomerModal.jsx
│   │   ├── CreateCustomerModal.jsx
│   │   └── StatusCustomersModal.jsx
│   ├── audit/AuditView.jsx
│   ├── checklist/ChecklistView.jsx
│   ├── sync/
│   │   ├── SyncStatusPanel.jsx
│   │   ├── SettingsModal.jsx
│   │   ├── ImportModal.jsx
│   │   └── ExportModal.jsx
│   └── sitenavigator/                    (existing — unchanged)
│       ├── cloneDuo/                      (CloneDuoWorkspace, useCloneDuoDraft, etc.)
│       ├── constants.js, utils.js, facets.js
│       ├── searchRanking.js, compareMatching.js
│       ├── gapAnalysis.js, vendorSections.js
└── hooks/
    └── useAppData.jsx                    (top-level data state via context)
```

### `useAppData` context

The current `App()` function holds ~30 `useState`/`useEffect` blocks for shared state (customers, templates, audit, sync status, indexed content, watchlists, toasts, search). Phase 2 lifts this into context exposed through `<AppDataProvider>` so feature views consume only what they need without prop-drilling through the shell.

To avoid re-render storms across feature views, the context is **split into multiple narrow contexts** rather than one mega-context:

- `SyncContext` — sync state, progress, engine info
- `IndexedContentContext` — indexed catalog data, search, facets
- `CustomersTemplatesContext` — customers, templates, audit, checklist (interdependent)
- `UIContext` — toast queue, critical warning banner, settings modal open state

Each context exposes a hook (`useSync()`, `useIndexedContent()`, etc.). Feature views subscribe only to the contexts they need.

### Modal ownership

Modals stay co-located with the feature that owns them — no global modal registry. Each feature view manages its own open-state with `useState`. The Radix `<Dialog>` migration in Phase 3 is mechanical because Radix's portal handles the same job as the current `createPortal` calls.

### CloneDuoWorkspace preservation

`features/sitenavigator/cloneDuo/` is preserved unchanged. It picks up the new tokens automatically via CSS variables and routes at `/clone-duo`.

### Phase 2 extraction order

Smallest blast radius first to validate the pattern:

1. **Dashboard** — read-only, mostly presentational
2. **Audit, Checklist** — small, self-contained
3. **Watchlist, Gap, Evidence** — medium, isolated state
4. **Customers + Templates** — interdependent; extract together with shared modals
5. **Catalog** — largest, most cross-cutting (touches search, facets, ranking)
6. **Compare** — depends on Catalog primitives; after Catalog
7. **Sync/Settings** — last; touches the shell

## Risk & Rollback

| Risk | Mitigation |
|---|---|
| Backdrop-blur flicker on dense pages (catalog, explorer) on Windows/Chrome | Preserve `content-stable-paint`, `app-stable-paint`, `catalog-grid` escape hatches verbatim. Smoke-test catalog scroll perf at end of Phase 1. |
| Portable Ketch build breaks if fonts fetch from CDN | Switch to `@fontsource/*` packages. Verify portable build launches without internet at end of Phase 1. |
| Context split (`useAppData`) causes re-render storms | Split into four narrow contexts (Sync, IndexedContent, CustomersTemplates, UI). |
| Modal API change in Phase 3 silently breaks one of ~10 modals | Phase 3.1 keeps the `BaseModal` prop API as a shim — every modal works on Radix internals before any callsite changes. Phase 3.3 migrates callsites one feature at a time. |
| 6,868-line file means git blame / IDE search habits change for the team | Phase 2 extractions land as small PRs (one feature per PR) so blame lineage stays per-component. |
| Visual regressions during Phase 1 (tokens-only) reskin | Capture before/after screenshots of every route at end of Phase 1 as PR artifacts. |

### Rollback

- Each phase ships as one or more PRs to `main`. No `/v2` parallel namespace. Rollback = `git revert` of the most recent phase's PRs.
- Phase 1's `tokens.css` introduction is the only point where `glass-tokens.css` and `index.css` token sections are deleted. If the new tokens cause visual chaos, reverting that single PR restores the old look in minutes.
- Router introduction is reversible: Phase 1 route components are thin wrappers around the existing in-place views.

## Verifications Resolved

1. ✅ `server/src/server.js:810` already serves `index.html` for non-API routes via `app.get(/^(?!\/api(?:\/|$)).*/, ...)`. React Router needs no server change.
2. ⚠️ Fonts currently load from Google Fonts CDN (`client/src/index.css:1`). Switch to `@fontsource/inter` and `@fontsource/jetbrains-mono` is required for portable build. Confirmed in scope.

## Success Criteria

- App opens to `/dashboard`, all routes navigable via URL, browser back/forward works, deep links work.
- Visual schema match: obsidian base, indigo accents, Inter + JetBrains Mono, 16px container / 8px control radii, 150–200ms transitions.
- `App.jsx` < 300 lines after Phase 2.
- All ~10 modals open, focus-trap correctly, dismiss on Escape via Radix Dialog after Phase 3.
- Catalog scroll performance is at least as smooth as today on Windows/Chrome.
- Portable Ketch build launches and renders fonts correctly with no internet connection.
- Existing tests (server: `npm run test --prefix server`, client: `npm run test:unit --prefix client`) all pass at every phase boundary.
- Existing localStorage data continues to load without migration.
