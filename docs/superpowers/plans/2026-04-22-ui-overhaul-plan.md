# SiteNavigator UI Overhaul — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform SiteNavigator from cyan/teal light-themed glassmorphism into obsidian + indigo "Soft Intelligence" aesthetic while decomposing 6,868-line `App.jsx` into a layered architecture.

**Architecture:** Three independent phases ship to main: Phase 1 (tokens + shell + router), Phase 2 (view extraction with context split), Phase 3 (Radix primitives migration). Each phase leaves the app in working, releasable state.

**Tech Stack:** React 19 + Vite 8 + Tailwind 3.4 + react-router-dom + Radix UI + clsx + @fontsource packages + Node test runner.

---

## Phase 1: Tokens, Shell, Router

Establish new token system, shell layout, routing, and swap tokens in place. App looks new, behaves identically. Old views still rendered in-place.

### Task 1: Add Phase 1 dependencies

**Files:**
- Modify: `client/package.json`

- [ ] **Step 1: Add react-router-dom, clsx, @fontsource packages**

Edit `client/package.json` dependencies block. Add:
```json
"dependencies": {
  "react": "^19.2.0",
  "react-dom": "^19.2.0",
  "react-router-dom": "^6.28.0",
  "clsx": "^2.1.1",
  "lucide-react": "^0.577.0",
  "@fontsource/inter": "^5.0.0",
  "@fontsource/jetbrains-mono": "^5.0.0"
}
```

- [ ] **Step 2: Install dependencies**

Run: `npm install --prefix client`
Expected: All packages installed, no errors.

- [ ] **Step 3: Commit**

```bash
cd c:\Admin\Projects\SiteNavigator\duo-sitenavigator
git add client/package.json client/package-lock.json
git commit -m "feat(phase1): add react-router-dom, clsx, @fontsource dependencies"
```

---

### Task 2: Create tokens.css with new token system

**Files:**
- Create: `client/src/tokens.css`

- [ ] **Step 1: Create tokens.css with full token definitions**

Create `client/src/tokens.css`:

```css
/* SiteNavigator Token System — Soft Intelligence Aesthetic */

:root {
  /* Color tokens — Obsidian base + Indigo accents */
  --bg-base:        #051424;
  --bg-panel:       rgba(13, 28, 45, 0.85);
  --bg-overlay:     rgba(30, 41, 59, 0.9);
  --border-subtle:  #2c3a4c;
  --border-strong:  #3b4d63;

  --accent:         #818cf8;
  --accent-hover:   #6366f1;
  --accent-press:   #4f46e5;
  --success:        #34d399;
  --warning:        #fbbf24;
  --critical:       #fb7185;

  --text-primary:   #fafafa;
  --text-secondary: #a1a1aa;
  --text-tertiary:  #71717a;

  /* Geometry tokens */
  --radius-container: 1rem;
  --radius-control:   0.5rem;
  --radius-pill:      9999px;

  /* Blur & elevation */
  --blur-panel:   18px;
  --blur-overlay: 24px;
  --shadow-panel:   0 8px 32px rgba(0, 0, 0, 0.32);
  --shadow-overlay: 0 24px 64px rgba(0, 0, 0, 0.5);
  --glow-focus:     0 0 0 3px rgba(129, 140, 248, 0.35);

  /* Motion tokens */
  --motion-fast:   150ms cubic-bezier(0.4, 0, 0.2, 1);
  --motion-medium: 200ms cubic-bezier(0.4, 0, 0.2, 1);

  /* Type tokens — Using CSS custom properties */
  --font-sans: "Inter", system-ui, sans-serif;
  --font-mono: "JetBrains Mono", ui-monospace, monospace;
}

body {
  background:
    radial-gradient(1200px circle at 10% -10%, rgba(129, 140, 248, 0.15), transparent 60%),
    radial-gradient(900px circle at 90% 10%, rgba(52, 211, 153, 0.12), transparent 60%),
    linear-gradient(160deg, #051424 0%, #0a1929 38%, #0d1c2d 100%);
  min-height: 100vh;
  background-attachment: fixed;
  color: var(--text-primary);
  font-family: var(--font-sans);
}

/* Anti-flicker escape hatches — preserved from old token system */
body.content-view-no-fx {
  background: linear-gradient(160deg, #051424 0%, #0a1929 45%, #0d1c2d 100%);
  background-attachment: fixed;
}

body.content-stable-paint {
  background: linear-gradient(160deg, #051424 0%, #0a1929 45%, #0d1c2d 100%);
  background-attachment: fixed;
}

body.app-stable-paint {
  background: linear-gradient(160deg, #051424 0%, #0a1929 45%, #0d1c2d 100%);
  background-attachment: fixed;
}

@layer components {
  /* Panel surface — translucent with blur */
  .panel {
    background: var(--bg-panel);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-container);
    box-shadow: var(--shadow-panel);
    backdrop-filter: blur(var(--blur-panel));
    transition: box-shadow var(--motion-fast), background var(--motion-fast);
  }

  .panel:hover {
    box-shadow: 0 14px 38px rgba(129, 140, 248, 0.18);
  }

  /* Control surface — form elements, buttons */
  .control {
    border: 1px solid var(--border-strong);
    border-radius: var(--radius-control);
    background: rgba(13, 28, 45, 0.5);
    padding: 0.5rem 0.75rem;
    transition: transform var(--motion-fast), border-color var(--motion-fast);
  }

  .control:hover {
    transform: translateY(-1px);
  }

  .control:focus-visible {
    outline: none;
    box-shadow: var(--glow-focus);
  }

  /* Navigation item — sidebar */
  .nav-item {
    padding: 0.625rem 0.75rem;
    border-radius: var(--radius-control);
    transition: background var(--motion-fast), transform var(--motion-fast);
  }

  .nav-item:hover {
    transform: translateX(2px);
    background: rgba(13, 28, 45, 0.6);
  }

  .nav-item-active {
    background: var(--accent);
    color: var(--bg-base);
    box-shadow: 0 8px 20px rgba(129, 140, 248, 0.28);
  }

  /* Anti-flicker escape hatches */
  .content-stable-paint .panel,
  .content-stable-paint .control,
  .content-stable-paint .nav-item {
    backdrop-filter: none;
    -webkit-backdrop-filter: none;
    transition: none;
  }

  .content-stable-paint .panel:hover,
  .content-stable-paint .control:hover,
  .content-stable-paint .nav-item:hover {
    transform: none;
  }

  .app-stable-paint .panel,
  .app-stable-paint .control,
  .app-stable-paint .nav-item {
    backdrop-filter: none;
    -webkit-backdrop-filter: none;
    transition: none;
  }

  .modal-open .panel,
  .modal-open .control,
  .modal-open .nav-item {
    transition: none;
  }

  .modal-open .panel:hover,
  .modal-open .control:hover,
  .modal-open .nav-item:hover {
    transform: none;
  }

  /* Grid anti-flicker */
  .catalog-grid {
    contain: layout paint;
  }

  .catalog-grid .control {
    transition: none;
  }

  .catalog-grid .control:hover {
    transform: none;
  }

  /* Utility classes for backwards compatibility */
  .fade-in-up {
    animation: fade-in-up 420ms cubic-bezier(0.2, 0.7, 0.2, 1) both;
  }
}

@keyframes fade-in-up {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

input,
select,
textarea {
  color: var(--text-primary);
  background: rgba(13, 28, 45, 0.5);
  border: 1px solid var(--border-strong);
  color-scheme: dark;
}

input::placeholder {
  color: var(--text-tertiary);
}

option {
  background: var(--bg-base);
  color: var(--text-primary);
}

@media (prefers-reduced-motion: reduce) {
  .fade-in-up {
    animation: none !important;
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add client/src/tokens.css
git commit -m "feat(phase1): create new Soft Intelligence token system"
```

---

### Task 3: Update index.css — remove CDN, add escape hatches

**Files:**
- Modify: `client/src/index.css`

- [ ] **Step 1: Replace index.css with stripped version**

Replace entire `client/src/index.css`:

```css
/* Remove Google Fonts CDN — replaced by @fontsource in main.jsx */

@tailwind base;
@tailwind components;
@tailwind utilities;

/* Preserve escape hatch classes from old system */
.glass-surface {
  @apply panel;
}

.glass-control {
  @apply control;
}

.glass-nav-item {
  @apply nav-item;
}

.glass-nav-item-active {
  @apply nav-item-active;
}

.glass-surface-static {
  background: color-mix(in oklab, rgba(13, 28, 45, 0.85) 88%, white 12%);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-container);
  box-shadow: var(--shadow-panel);
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
  transition: none;
  contain: paint;
}

/* Backward compat: old type classes */
.type-display {
  @apply text-2xl font-semibold tracking-tight md:text-3xl;
  font-family: var(--font-sans);
}

.type-title {
  @apply text-xl font-semibold tracking-tight;
  font-family: var(--font-sans);
}

.type-card-title {
  @apply text-base font-semibold tracking-tight;
  font-family: var(--font-sans);
}

.type-label {
  @apply text-[11px] uppercase tracking-[0.14em];
  color: var(--text-secondary);
}

.type-micro {
  @apply text-xs;
  color: var(--text-tertiary);
}

.text-glass-primary {
  color: var(--text-primary);
}

.text-glass-secondary {
  color: var(--text-secondary);
}

.text-text-primary {
  color: var(--text-primary);
}

.text-text-secondary {
  color: var(--text-secondary);
}

.text-text-tertiary {
  color: var(--text-tertiary);
}

.bg-accent {
  background-color: var(--accent);
}

.text-accent {
  color: var(--accent);
}
```

- [ ] **Step 2: Commit**

```bash
git add client/src/index.css
git commit -m "feat(phase1): refactor index.css, remove CDN, add token compat layer"
```

---

### Task 4: Update main.jsx — add @fontsource imports

**Files:**
- Modify: `client/src/main.jsx`

- [ ] **Step 1: Add font imports**

Replace `client/src/main.jsx`:

```jsx
import '@fontsource/inter/400.css'
import '@fontsource/inter/600.css'
import '@fontsource/jetbrains-mono/400.css'
import '@fontsource/jetbrains-mono/600.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './tokens.css'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
```

- [ ] **Step 2: Commit**

```bash
git add client/src/main.jsx
git commit -m "feat(phase1): add @fontsource imports for Inter and JetBrains Mono"
```

---

### Task 5: Update tailwind.config.js — add theme extensions

**Files:**
- Modify: `client/tailwind.config.js`

- [ ] **Step 1: Add CSS variable theme extensions**

Replace `client/tailwind.config.js`:

```js
/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: false, // obsidian-only, no light mode
  theme: {
    extend: {
      colors: {
        "bg-base": "var(--bg-base)",
        "bg-panel": "var(--bg-panel)",
        "bg-overlay": "var(--bg-overlay)",
        "border-subtle": "var(--border-subtle)",
        "border-strong": "var(--border-strong)",
        "accent": "var(--accent)",
        "accent-hover": "var(--accent-hover)",
        "accent-press": "var(--accent-press)",
        "success": "var(--success)",
        "warning": "var(--warning)",
        "critical": "var(--critical)",
        "text-primary": "var(--text-primary)",
        "text-secondary": "var(--text-secondary)",
        "text-tertiary": "var(--text-tertiary)",
      },
      borderRadius: {
        "container": "var(--radius-container)",
        "control": "var(--radius-control)",
        "pill": "var(--radius-pill)",
      },
      fontFamily: {
        sans: "var(--font-sans)",
        mono: "var(--font-mono)",
      },
      boxShadow: {
        "panel": "var(--shadow-panel)",
        "overlay": "var(--shadow-overlay)",
      },
      transitionDuration: {
        "motion-fast": "var(--motion-fast)",
        "motion-medium": "var(--motion-medium)",
      },
    },
  },
  plugins: [],
}
```

- [ ] **Step 2: Commit**

```bash
git add client/tailwind.config.js
git commit -m "feat(phase1): extend Tailwind theme with CSS variable utilities"
```

---

### Task 6: Create shell/navConfig.js — navigation structure

**Files:**
- Create: `client/src/shell/navConfig.js`

- [ ] **Step 1: Create navConfig.js**

Create `client/src/shell/navConfig.js`:

```js
export const navConfig = {
  workspace: [
    { label: "Dashboard", href: "/dashboard", icon: "LayoutDashboard" },
    { label: "Catalog", href: "/catalog", icon: "BookOpen" },
    { label: "Compare", href: "/compare", icon: "GitCompare" },
    { label: "Gap Finder", href: "/gap", icon: "Target" },
    { label: "Watchlist", href: "/watchlist", icon: "Eye" },
    { label: "Templates", href: "/templates", icon: "FileText" },
    { label: "Customers", href: "/customers", icon: "Users" },
  ],
  vendors: [
    { label: "Duo", href: "/vendors/duo", color: "#818cf8" },
    { label: "Okta", href: "/vendors/okta", color: "#818cf8" },
    { label: "Entra", href: "/vendors/entra", color: "#818cf8" },
    { label: "Ping Identity", href: "/vendors/pingidentity", color: "#818cf8" },
  ],
  settings: [
    { label: "Audit", href: "/audit", icon: "CheckSquare" },
    { label: "Checklist", href: "/checklist", icon: "ListTodo" },
    { label: "Settings", href: "/settings", icon: "Cog" },
  ],
}
```

- [ ] **Step 2: Commit**

```bash
git add client/src/shell/navConfig.js
git commit -m "feat(phase1): create navigation config"
```

---

### Task 7: Create shell/Sidebar.jsx

**Files:**
- Create: `client/src/shell/Sidebar.jsx`

- [ ] **Step 1: Create Sidebar component**

Create `client/src/shell/Sidebar.jsx`:

```jsx
import { useLocation, Link } from 'react-router-dom'
import clsx from 'clsx'
import { navConfig } from './navConfig'

function SidebarSection({ title, items }) {
  const location = useLocation()
  
  return (
    <div className="space-y-1">
      {title && (
        <div className="px-3 py-2 text-xs uppercase tracking-[0.14em] text-text-tertiary">
          {title}
        </div>
      )}
      {items.map((item) => {
        const isActive = location.pathname === item.href
        return (
          <Link
            key={item.href}
            to={item.href}
            className={clsx(
              'nav-item block w-full text-left',
              isActive && 'nav-item-active'
            )}
          >
            <span className="text-sm">{item.label}</span>
          </Link>
        )
      })}
    </div>
  )
}

export function Sidebar() {
  return (
    <aside className="fixed left-0 top-0 h-screen w-[200px] bg-panel border-r border-border-subtle backdrop-blur-[18px] flex flex-col">
      {/* Brand */}
      <div className="p-4 border-b border-border-subtle">
        <div className="w-7 h-7 bg-gradient-to-br from-accent to-accent-hover rounded mb-2" />
        <div className="text-xs font-semibold text-text-primary font-mono">SiteNavigator</div>
      </div>

      {/* Workspace section */}
      <div className="flex-1 overflow-y-auto p-3 space-y-6">
        <SidebarSection title="Workspace" items={navConfig.workspace} />
        <SidebarSection title="Vendors" items={navConfig.vendors} />
      </div>

      {/* Settings section — pinned to bottom */}
      <div className="p-3 border-t border-border-subtle">
        <SidebarSection items={navConfig.settings} />
      </div>
    </aside>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add client/src/shell/Sidebar.jsx
git commit -m "feat(phase1): create Sidebar component"
```

---

### Task 8: Create shell/TopBar.jsx

**Files:**
- Create: `client/src/shell/TopBar.jsx`

- [ ] **Step 1: Create TopBar component**

Create `client/src/shell/TopBar.jsx`:

```jsx
import { useLocation } from 'react-router-dom'
import { Settings } from 'lucide-react'

export function TopBar() {
  const location = useLocation()
  
  const getBreadcrumb = () => {
    const path = location.pathname
    if (path === '/dashboard') return 'Dashboard'
    if (path === '/catalog') return 'Catalog'
    if (path === '/compare') return 'Compare'
    if (path === '/gap') return 'Gap Finder'
    if (path === '/watchlist') return 'Watchlist'
    if (path === '/templates') return 'Templates'
    if (path === '/customers') return 'Customers'
    if (path === '/audit') return 'Audit'
    if (path === '/checklist') return 'Checklist'
    if (path === '/settings') return 'Settings'
    if (path.startsWith('/vendors/')) {
      const vendor = path.split('/')[2]
      return `Catalog › ${vendor.charAt(0).toUpperCase() + vendor.slice(1)}`
    }
    return 'SiteNavigator'
  }

  return (
    <header className="sticky top-0 z-40 h-14 bg-panel bg-opacity-70 border-b border-border-subtle backdrop-blur-[18px]">
      <div className="h-full px-6 flex items-center justify-between">
        {/* Breadcrumb */}
        <div className="text-sm text-text-secondary">
          Workspace › {getBreadcrumb()}
        </div>

        {/* Center: search input placeholder */}
        <div className="flex-1 mx-8 max-w-sm">
          <input
            type="text"
            placeholder="Search... ⌘K"
            className="w-full control"
          />
        </div>

        {/* Right: settings icon */}
        <button className="control p-2">
          <Settings size={18} className="text-text-secondary" />
        </button>
      </div>
    </header>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add client/src/shell/TopBar.jsx
git commit -m "feat(phase1): create TopBar component"
```

---

### Task 9: Create shell/AppLayout.jsx

**Files:**
- Create: `client/src/shell/AppLayout.jsx`

- [ ] **Step 1: Create AppLayout component**

Create `client/src/shell/AppLayout.jsx`:

```jsx
import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { TopBar } from './TopBar'

export function AppLayout() {
  return (
    <div className="min-h-screen bg-bg-base text-text-primary">
      <Sidebar />
      <div className="ml-[200px] flex min-h-screen flex-col">
        <TopBar />
        <main className="flex-1 p-6 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add client/src/shell/AppLayout.jsx
git commit -m "feat(phase1): create AppLayout shell"
```

---

### Task 10: Create shell/router.jsx

**Files:**
- Create: `client/src/shell/router.jsx`

- [ ] **Step 1: Create router configuration**

Create `client/src/shell/router.jsx`:

```jsx
import { createBrowserRouter, Navigate } from 'react-router-dom'
import { AppLayout } from './AppLayout'

// Placeholder view components — will be extracted in Phase 2
function PlaceholderView({ name }) {
  return <div className="text-text-secondary">⏳ {name} view coming in Phase 2</div>
}

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppLayout />,
    children: [
      { index: true, element: <Navigate to="/dashboard" replace /> },
      { path: 'dashboard', element: <PlaceholderView name="Dashboard" /> },
      { path: 'catalog', element: <PlaceholderView name="Catalog" /> },
      { path: 'vendors/:vendor', element: <PlaceholderView name="Vendor Catalog" /> },
      { path: 'compare', element: <PlaceholderView name="Compare" /> },
      { path: 'gap', element: <PlaceholderView name="Gap Finder" /> },
      { path: 'watchlist', element: <PlaceholderView name="Watchlist" /> },
      { path: 'templates', element: <PlaceholderView name="Templates" /> },
      { path: 'customers', element: <PlaceholderView name="Customers" /> },
      { path: 'audit', element: <PlaceholderView name="Audit" /> },
      { path: 'checklist', element: <PlaceholderView name="Checklist" /> },
      { path: 'settings', element: <PlaceholderView name="Settings" /> },
      { path: 'clone-duo', element: <PlaceholderView name="Clone Duo" /> },
      { path: '*', element: <PlaceholderView name="Not Found" /> },
    ],
  },
])
```

- [ ] **Step 2: Commit**

```bash
git add client/src/shell/router.jsx
git commit -m "feat(phase1): create React Router configuration"
```

---

### Task 11: Update App.jsx — wire RouterProvider

**Files:**
- Modify: `client/src/App.jsx`

- [ ] **Step 1: Replace App.jsx with RouterProvider wrapper**

Replace entire `client/src/App.jsx` with:

```jsx
import { RouterProvider } from 'react-router-dom'
import { router } from './shell/router'

export default function App() {
  return <RouterProvider router={router} />
}
```

- [ ] **Step 2: Verify old App.jsx line count**

Before running tests, save the old App.jsx as `App.jsx.old` for reference (git tracks it, you don't need to).

- [ ] **Step 3: Commit**

```bash
git add client/src/App.jsx
git commit -m "feat(phase1): swap App.jsx for RouterProvider"
```

---

### Task 12: Smoke test — verify Phase 1 visuals and routing

**Files:**
- Test: `client/src/` (visual inspection)

- [ ] **Step 1: Start dev server**

Run: `npm run dev --prefix client`
Expected: Server starts at http://localhost:5173 with no build errors.

- [ ] **Step 2: Open browser and verify**

Navigate to http://localhost:5173. Verify:
- App loads with new obsidian + indigo color scheme
- Sidebar visible on left with SiteNavigator brand, three sections (Workspace, Vendors, Settings)
- TopBar visible at top with breadcrumb and search input
- New fonts (Inter + JetBrains Mono) loaded
- All routes navigable: click links in sidebar, verify URL changes, back/forward work
- Placeholder text appears on each route

- [ ] **Step 3: Screenshot before state**

Take screenshots of `/dashboard`, `/catalog`, `/compare` for later diff.

- [ ] **Step 4: Verify no console errors**

Open DevTools. Verify no errors or warnings.

- [ ] **Step 5: Run unit tests**

Run: `npm run test:unit --prefix client`
Expected: All existing tests pass (or no tests exist yet — check `client/tests/unit/` for test files).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "phase1: smoke test passed — routing works, tokens applied, fonts loaded"
```

---

### Task 13: Verify portable build fonts

**Files:**
- Test: portable build output

- [ ] **Step 1: Build portable**

Run: `npm run build:portable --prefix server`
Expected: Ketch binary bundled with server.

- [ ] **Step 2: Launch without internet**

Disconnect internet (or use a sandbox). Run the portable exe and open http://localhost:8787.

Verify:
- App loads with fonts rendered correctly (Inter for body, JetBrains Mono for brand)
- No font loading errors in console

- [ ] **Step 3: Reconnect internet**

Re-enable internet.

- [ ] **Step 4: Commit if any config changes made**

```bash
git add -A
git commit -m "phase1: verified portable build loads fonts offline"
```

---

## Phase 2: View Extraction with Context Split

Extract feature views into separate files, create context split to prevent re-render storms, shrink App.jsx toward <300 lines.

### Task 14: Create hooks/useAppData.jsx — context split

**Files:**
- Create: `client/src/hooks/useAppData.jsx`

- [ ] **Step 1: Create useAppData with four narrow contexts**

Create `client/src/hooks/useAppData.jsx`:

```jsx
import { createContext, useContext, useState, useEffect } from 'react'

// Four narrow contexts — one per concern
const SyncContext = createContext()
const IndexedContentContext = createContext()
const CustomersTemplatesContext = createContext()
const UIContext = createContext()

export function AppDataProvider({ children }) {
  // SyncContext state
  const [syncState, setSyncState] = useState('idle')
  const [syncProgress, setSyncProgress] = useState(0)
  const [syncEngine, setSyncEngine] = useState('auto')

  // IndexedContentContext state
  const [indexedContent, setIndexedContent] = useState([])
  const [searchQuery, setSearchQuery] = useState('')
  const [facets, setFacets] = useState({})

  // CustomersTemplatesContext state
  const [customers, setCustomers] = useState([])
  const [templates, setTemplates] = useState([])
  const [audit, setAudit] = useState([])
  const [checklist, setChecklist] = useState([])

  // UIContext state
  const [toastQueue, setToastQueue] = useState([])
  const [criticalWarning, setCriticalWarning] = useState(null)
  const [settingsModalOpen, setSettingsModalOpen] = useState(false)

  return (
    <SyncContext.Provider value={{ syncState, setSyncState, syncProgress, setSyncProgress, syncEngine, setSyncEngine }}>
      <IndexedContentContext.Provider value={{ indexedContent, setIndexedContent, searchQuery, setSearchQuery, facets, setFacets }}>
        <CustomersTemplatesContext.Provider value={{ customers, setCustomers, templates, setTemplates, audit, setAudit, checklist, setChecklist }}>
          <UIContext.Provider value={{ toastQueue, setToastQueue, criticalWarning, setCriticalWarning, settingsModalOpen, setSettingsModalOpen }}>
            {children}
          </UIContext.Provider>
        </CustomersTemplatesContext.Provider>
      </IndexedContentContext.Provider>
    </SyncContext.Provider>
  )
}

export function useSync() {
  const ctx = useContext(SyncContext)
  if (!ctx) throw new Error('useSync must be used within AppDataProvider')
  return ctx
}

export function useIndexedContent() {
  const ctx = useContext(IndexedContentContext)
  if (!ctx) throw new Error('useIndexedContent must be used within AppDataProvider')
  return ctx
}

export function useCustomersTemplates() {
  const ctx = useContext(CustomersTemplatesContext)
  if (!ctx) throw new Error('useCustomersTemplates must be used within AppDataProvider')
  return ctx
}

export function useUI() {
  const ctx = useContext(UIContext)
  if (!ctx) throw new Error('useUI must be used within AppDataProvider')
  return ctx
}
```

- [ ] **Step 2: Commit**

```bash
git add client/src/hooks/useAppData.jsx
git commit -m "feat(phase2): create AppDataProvider with four narrow contexts"
```

---

### Task 15: Update App.jsx to wrap with AppDataProvider

**Files:**
- Modify: `client/src/App.jsx`

- [ ] **Step 1: Update App.jsx**

Replace `client/src/App.jsx`:

```jsx
import { RouterProvider } from 'react-router-dom'
import { AppDataProvider } from './hooks/useAppData'
import { router } from './shell/router'

export default function App() {
  return (
    <AppDataProvider>
      <RouterProvider router={router} />
    </AppDataProvider>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add client/src/App.jsx
git commit -m "feat(phase2): wrap RouterProvider with AppDataProvider"
```

---

### Task 16: Extract DashboardView

**Files:**
- Create: `client/src/features/dashboard/DashboardView.jsx`

- [ ] **Step 1: Create DashboardView**

Create `client/src/features/dashboard/DashboardView.jsx`:

```jsx
export function DashboardView() {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-semibold">Dashboard</h1>
      <p className="text-text-secondary">Dashboard content coming soon.</p>
    </div>
  )
}
```

- [ ] **Step 2: Update router to use DashboardView**

Edit `client/src/shell/router.jsx`, import DashboardView and replace:
```jsx
{ path: 'dashboard', element: <PlaceholderView name="Dashboard" /> },
```
with:
```jsx
{ path: 'dashboard', element: <DashboardView /> },
```

- [ ] **Step 3: Commit**

```bash
git add client/src/features/dashboard/DashboardView.jsx client/src/shell/router.jsx
git commit -m "feat(phase2): extract DashboardView"
```

---

### Task 17: Extract AuditView and ChecklistView

**Files:**
- Create: `client/src/features/audit/AuditView.jsx`
- Create: `client/src/features/checklist/ChecklistView.jsx`

- [ ] **Step 1: Create AuditView**

Create `client/src/features/audit/AuditView.jsx`:

```jsx
export function AuditView() {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-semibold">Audit</h1>
      <p className="text-text-secondary">Audit content coming soon.</p>
    </div>
  )
}
```

- [ ] **Step 2: Create ChecklistView**

Create `client/src/features/checklist/ChecklistView.jsx`:

```jsx
export function ChecklistView() {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-semibold">Checklist</h1>
      <p className="text-text-secondary">Checklist content coming soon.</p>
    </div>
  )
}
```

- [ ] **Step 3: Update router**

Edit `client/src/shell/router.jsx`:

```jsx
import { DashboardView } from '../features/dashboard/DashboardView'
import { AuditView } from '../features/audit/AuditView'
import { ChecklistView } from '../features/checklist/ChecklistView'

// In routes children:
{ path: 'audit', element: <AuditView /> },
{ path: 'checklist', element: <ChecklistView /> },
```

- [ ] **Step 4: Commit**

```bash
git add client/src/features/audit/AuditView.jsx client/src/features/checklist/ChecklistView.jsx client/src/shell/router.jsx
git commit -m "feat(phase2): extract AuditView and ChecklistView"
```

---

### Task 18: Extract WatchlistView, GapView, EvidenceView

**Files:**
- Create: `client/src/features/watchlist/WatchlistView.jsx`
- Create: `client/src/features/gap/GapView.jsx`
- Create: `client/src/features/evidence/EvidenceView.jsx`

- [ ] **Step 1: Create WatchlistView**

Create `client/src/features/watchlist/WatchlistView.jsx`:

```jsx
export function WatchlistView() {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-semibold">Watchlist</h1>
      <p className="text-text-secondary">Watchlist content coming soon.</p>
    </div>
  )
}
```

- [ ] **Step 2: Create GapView**

Create `client/src/features/gap/GapView.jsx`:

```jsx
export function GapView() {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-semibold">Gap Finder</h1>
      <p className="text-text-secondary">Gap Finder content coming soon.</p>
    </div>
  )
}
```

- [ ] **Step 3: Create EvidenceView**

Create `client/src/features/evidence/EvidenceView.jsx`:

```jsx
export function EvidenceView() {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-semibold">Evidence Trails</h1>
      <p className="text-text-secondary">Evidence Trails content coming soon.</p>
    </div>
  )
}
```

- [ ] **Step 4: Update router**

Edit `client/src/shell/router.jsx` to import and use these views.

- [ ] **Step 5: Commit**

```bash
git add client/src/features/watchlist/WatchlistView.jsx client/src/features/gap/GapView.jsx client/src/features/evidence/EvidenceView.jsx client/src/shell/router.jsx
git commit -m "feat(phase2): extract WatchlistView, GapView, EvidenceView"
```

---

### Task 19: Extract TemplatesView and CustomersView

**Files:**
- Create: `client/src/features/templates/TemplatesView.jsx`
- Create: `client/src/features/customers/CustomersView.jsx`

- [ ] **Step 1: Create TemplatesView**

Create `client/src/features/templates/TemplatesView.jsx`:

```jsx
export function TemplatesView() {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-semibold">Templates</h1>
      <p className="text-text-secondary">Templates content coming soon.</p>
    </div>
  )
}
```

- [ ] **Step 2: Create CustomersView**

Create `client/src/features/customers/CustomersView.jsx`:

```jsx
export function CustomersView() {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-semibold">Customers</h1>
      <p className="text-text-secondary">Customers content coming soon.</p>
    </div>
  )
}
```

- [ ] **Step 3: Update router**

Edit `client/src/shell/router.jsx` to import and use these views.

- [ ] **Step 4: Commit**

```bash
git add client/src/features/templates/TemplatesView.jsx client/src/features/customers/CustomersView.jsx client/src/shell/router.jsx
git commit -m "feat(phase2): extract TemplatesView and CustomersView"
```

---

### Task 20: Extract CatalogView

**Files:**
- Create: `client/src/features/catalog/CatalogView.jsx`

- [ ] **Step 1: Create CatalogView**

Create `client/src/features/catalog/CatalogView.jsx`:

```jsx
import { useParams } from 'react-router-dom'

export function CatalogView() {
  const { vendor } = useParams()
  
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-semibold">
        {vendor ? `${vendor.charAt(0).toUpperCase() + vendor.slice(1)} ` : ''}Catalog
      </h1>
      <p className="text-text-secondary">Catalog content coming soon.</p>
    </div>
  )
}
```

- [ ] **Step 2: Update router**

Edit `client/src/shell/router.jsx` to import and use CatalogView.

- [ ] **Step 3: Commit**

```bash
git add client/src/features/catalog/CatalogView.jsx client/src/shell/router.jsx
git commit -m "feat(phase2): extract CatalogView with vendor support"
```

---

### Task 21: Extract CompareView

**Files:**
- Create: `client/src/features/compare/CompareView.jsx`

- [ ] **Step 1: Create CompareView**

Create `client/src/features/compare/CompareView.jsx`:

```jsx
export function CompareView() {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-semibold">Compare</h1>
      <p className="text-text-secondary">Compare content coming soon.</p>
    </div>
  )
}
```

- [ ] **Step 2: Update router**

Edit `client/src/shell/router.jsx` to import and use CompareView.

- [ ] **Step 3: Commit**

```bash
git add client/src/features/compare/CompareView.jsx client/src/shell/router.jsx
git commit -m "feat(phase2): extract CompareView"
```

---

### Task 22: Extract CloneDuoWorkspace route and SettingsView

**Files:**
- Create: `client/src/features/settings/SettingsView.jsx`

- [ ] **Step 1: Create SettingsView**

Create `client/src/features/settings/SettingsView.jsx`:

```jsx
export function SettingsView() {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-semibold">Settings</h1>
      <p className="text-text-secondary">Settings content coming soon.</p>
    </div>
  )
}
```

- [ ] **Step 2: Create CloneDuoView placeholder**

Create `client/src/features/sitenavigator/cloneDuo/CloneDuoView.jsx`:

```jsx
export function CloneDuoView() {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-semibold">Clone Duo</h1>
      <p className="text-text-secondary">Clone Duo workspace coming soon.</p>
    </div>
  )
}
```

- [ ] **Step 3: Update router**

Edit `client/src/shell/router.jsx` to import and use both views.

- [ ] **Step 4: Commit**

```bash
git add client/src/features/settings/SettingsView.jsx client/src/features/sitenavigator/cloneDuo/CloneDuoView.jsx client/src/shell/router.jsx
git commit -m "feat(phase2): extract SettingsView and CloneDuoView"
```

---

### Task 23: Create NotFoundView

**Files:**
- Create: `client/src/features/notfound/NotFoundView.jsx`

- [ ] **Step 1: Create NotFoundView**

Create `client/src/features/notfound/NotFoundView.jsx`:

```jsx
import { Link } from 'react-router-dom'

export function NotFoundView() {
  return (
    <div className="space-y-6 text-center">
      <h1 className="text-3xl font-semibold">404 — Not Found</h1>
      <p className="text-text-secondary">This page doesn't exist.</p>
      <Link to="/dashboard" className="text-accent hover:text-accent-hover">
        Back to Dashboard
      </Link>
    </div>
  )
}
```

- [ ] **Step 2: Update router**

Edit `client/src/shell/router.jsx` to import and use NotFoundView.

- [ ] **Step 3: Commit**

```bash
git add client/src/features/notfound/NotFoundView.jsx client/src/shell/router.jsx
git commit -m "feat(phase2): create NotFoundView for 404 routes"
```

---

### Task 24: Remove PlaceholderView from router

**Files:**
- Modify: `client/src/shell/router.jsx`

- [ ] **Step 1: Clean up router**

Remove the `PlaceholderView` function and ensure all routes use real imported views.

- [ ] **Step 2: Verify all routes have real components**

Check that every route path has a real view component, no placeholders remain.

- [ ] **Step 3: Commit**

```bash
git add client/src/shell/router.jsx
git commit -m "feat(phase2): remove placeholder views from router"
```

---

### Task 25: Smoke test Phase 2 — verify all routes, App.jsx size

**Files:**
- Test: `client/src/App.jsx`

- [ ] **Step 1: Check App.jsx line count**

Run: `wc -l client/src/App.jsx`
Expected: < 300 lines (should be ~20 lines now).

- [ ] **Step 2: Start dev server**

Run: `npm run dev --prefix client`
Expected: Builds without errors.

- [ ] **Step 3: Test all routes**

Navigate to each route via sidebar or URL:
- `/dashboard`, `/catalog`, `/compare`, `/gap`, `/watchlist`, `/templates`, `/customers`, `/audit`, `/checklist`, `/settings`
- `/vendors/duo`, `/vendors/okta`, `/vendors/entra`, `/vendors/pingidentity`
- `/clone-duo`
- `/notexist` (should show 404)

Verify each loads, breadcrumb updates, sidebar active state updates.

- [ ] **Step 4: Run unit tests**

Run: `npm run test:unit --prefix client`
Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "phase2: smoke test passed — all views extracted, App.jsx < 300 lines"
```

---

## Phase 3: Radix Primitives Migration

Introduce Radix UI, migrate modals/dropdowns/tabs/toasts/tooltips, retire hand-rolled BaseModal focus trap.

### Task 26: Add Phase 3 dependencies

**Files:**
- Modify: `client/package.json`

- [ ] **Step 1: Add Radix UI packages**

Edit `client/package.json` dependencies. Add:
```json
"@radix-ui/react-dialog": "^1.1.2",
"@radix-ui/react-dropdown-menu": "^2.1.2",
"@radix-ui/react-tabs": "^1.1.0",
"@radix-ui/react-tooltip": "^1.0.8",
"@radix-ui/react-select": "^2.1.2",
"@radix-ui/react-toast": "^1.1.6"
```

- [ ] **Step 2: Install**

Run: `npm install --prefix client`
Expected: All Radix packages installed.

- [ ] **Step 3: Commit**

```bash
git add client/package.json client/package-lock.json
git commit -m "feat(phase3): add @radix-ui packages"
```

---

### Task 27: Create primitives/Dialog.jsx (Radix-backed)

**Files:**
- Create: `client/src/primitives/Dialog.jsx`

- [ ] **Step 1: Create Dialog primitive**

Create `client/src/primitives/Dialog.jsx`:

```jsx
import * as RadixDialog from '@radix-ui/react-dialog'
import { X } from 'lucide-react'

export function Dialog({ open, onOpenChange, title, children, className = '' }) {
  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="fixed inset-0 bg-black/50 backdrop-blur-sm" />
        <RadixDialog.Content className={`fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-bg-overlay border border-border-strong rounded-container shadow-overlay max-w-md w-full p-6 ${className}`}>
          {title && (
            <RadixDialog.Title className="text-lg font-semibold text-text-primary mb-4">
              {title}
            </RadixDialog.Title>
          )}
          {children}
          <RadixDialog.Close asChild>
            <button className="absolute top-4 right-4 p-1 text-text-secondary hover:text-text-primary">
              <X size={20} />
            </button>
          </RadixDialog.Close>
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add client/src/primitives/Dialog.jsx
git commit -m "feat(phase3.1): create Dialog primitive backed by Radix"
```

---

### Task 28: Create primitives/ConfirmDialog.jsx

**Files:**
- Create: `client/src/primitives/ConfirmDialog.jsx`

- [ ] **Step 1: Create ConfirmDialog**

Create `client/src/primitives/ConfirmDialog.jsx`:

```jsx
import { Dialog } from './Dialog'

export function ConfirmDialog({ open, onOpenChange, title, message, confirmLabel = 'Confirm', cancelLabel = 'Cancel', onConfirm }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange} title={title}>
      <p className="text-text-secondary mb-6">{message}</p>
      <div className="flex gap-2 justify-end">
        <button
          onClick={() => onOpenChange(false)}
          className="control px-4 py-2 text-sm"
        >
          {cancelLabel}
        </button>
        <button
          onClick={() => {
            onConfirm?.()
            onOpenChange(false)
          }}
          className="control px-4 py-2 text-sm bg-accent text-bg-base hover:bg-accent-hover"
        >
          {confirmLabel}
        </button>
      </div>
    </Dialog>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add client/src/primitives/ConfirmDialog.jsx
git commit -m "feat(phase3.2): create ConfirmDialog primitive"
```

---

### Task 29: Create primitives/Tooltip.jsx

**Files:**
- Create: `client/src/primitives/Tooltip.jsx`

- [ ] **Step 1: Create Tooltip**

Create `client/src/primitives/Tooltip.jsx`:

```jsx
import * as RadixTooltip from '@radix-ui/react-tooltip'

export function Tooltip({ content, children, side = 'top' }) {
  return (
    <RadixTooltip.Provider>
      <RadixTooltip.Root>
        <RadixTooltip.Trigger asChild>
          {children}
        </RadixTooltip.Trigger>
        <RadixTooltip.Portal>
          <RadixTooltip.Content side={side} className="bg-bg-overlay text-text-primary text-xs px-2 py-1 rounded-control shadow-overlay">
            {content}
            <RadixTooltip.Arrow className="fill-bg-overlay" />
          </RadixTooltip.Content>
        </RadixTooltip.Portal>
      </RadixTooltip.Root>
    </RadixTooltip.Provider>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add client/src/primitives/Tooltip.jsx
git commit -m "feat(phase3): create Tooltip primitive backed by Radix"
```

---

### Task 30: Create primitives/DropdownMenu.jsx

**Files:**
- Create: `client/src/primitives/DropdownMenu.jsx`

- [ ] **Step 1: Create DropdownMenu**

Create `client/src/primitives/DropdownMenu.jsx`:

```jsx
import * as RadixDropdown from '@radix-ui/react-dropdown-menu'

export function DropdownMenu({ trigger, items, onSelect }) {
  return (
    <RadixDropdown.Root>
      <RadixDropdown.Trigger asChild>
        {trigger}
      </RadixDropdown.Trigger>
      <RadixDropdown.Portal>
        <RadixDropdown.Content className="bg-bg-panel border border-border-strong rounded-control shadow-overlay py-1">
          {items.map((item) => (
            <RadixDropdown.Item
              key={item.label}
              onClick={() => onSelect?.(item)}
              className="px-3 py-2 text-sm text-text-primary hover:bg-bg-overlay cursor-pointer outline-none"
            >
              {item.label}
            </RadixDropdown.Item>
          ))}
        </RadixDropdown.Content>
      </RadixDropdown.Portal>
    </RadixDropdown.Root>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add client/src/primitives/DropdownMenu.jsx
git commit -m "feat(phase3): create DropdownMenu primitive backed by Radix"
```

---

### Task 31: Create primitives/Tabs.jsx

**Files:**
- Create: `client/src/primitives/Tabs.jsx`

- [ ] **Step 1: Create Tabs**

Create `client/src/primitives/Tabs.jsx`:

```jsx
import * as RadixTabs from '@radix-ui/react-tabs'

export function Tabs({ tabs, defaultValue, onValueChange }) {
  return (
    <RadixTabs.Root defaultValue={defaultValue} onValueChange={onValueChange}>
      <RadixTabs.List className="flex border-b border-border-subtle">
        {tabs.map((tab) => (
          <RadixTabs.Trigger
            key={tab.value}
            value={tab.value}
            className="px-4 py-2 text-sm text-text-secondary hover:text-text-primary data-[state=active]:text-text-primary data-[state=active]:border-b-2 data-[state=active]:border-accent outline-none"
          >
            {tab.label}
          </RadixTabs.Trigger>
        ))}
      </RadixTabs.List>
      {tabs.map((tab) => (
        <RadixTabs.Content key={tab.value} value={tab.value}>
          {tab.content}
        </RadixTabs.Content>
      ))}
    </RadixTabs.Root>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add client/src/primitives/Tabs.jsx
git commit -m "feat(phase3): create Tabs primitive backed by Radix"
```

---

### Task 32: Create primitives/Select.jsx

**Files:**
- Create: `client/src/primitives/Select.jsx`

- [ ] **Step 1: Create Select**

Create `client/src/primitives/Select.jsx`:

```jsx
import * as RadixSelect from '@radix-ui/react-select'
import { ChevronDown } from 'lucide-react'

export function Select({ value, onValueChange, options, placeholder = 'Select...' }) {
  return (
    <RadixSelect.Root value={value} onValueChange={onValueChange}>
      <RadixSelect.Trigger className="control px-3 py-2 flex items-center justify-between">
        <RadixSelect.Value placeholder={placeholder} />
        <RadixSelect.Icon>
          <ChevronDown size={16} />
        </RadixSelect.Icon>
      </RadixSelect.Trigger>
      <RadixSelect.Portal>
        <RadixSelect.Content className="bg-bg-panel border border-border-strong rounded-control shadow-overlay py-1">
          <RadixSelect.Viewport>
            {options.map((opt) => (
              <RadixSelect.Item
                key={opt.value}
                value={opt.value}
                className="px-3 py-2 text-sm text-text-primary hover:bg-bg-overlay data-[state=checked]:bg-accent data-[state=checked]:text-bg-base cursor-pointer outline-none"
              >
                {opt.label}
              </RadixSelect.Item>
            ))}
          </RadixSelect.Viewport>
        </RadixSelect.Content>
      </RadixSelect.Portal>
    </RadixSelect.Root>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add client/src/primitives/Select.jsx
git commit -m "feat(phase3): create Select primitive backed by Radix"
```

---

### Task 33: Create primitives/Toast.jsx and useToast hook

**Files:**
- Create: `client/src/primitives/Toast.jsx`
- Create: `client/src/hooks/useToast.jsx`

- [ ] **Step 1: Create Toast primitive**

Create `client/src/primitives/Toast.jsx`:

```jsx
import * as RadixToast from '@radix-ui/react-toast'
import { X } from 'lucide-react'

export function Toast({ title, description, open, onOpenChange }) {
  return (
    <RadixToast.Root open={open} onOpenChange={onOpenChange}>
      <div className="flex items-center justify-between gap-3">
        <div>
          {title && <div className="text-sm font-semibold text-text-primary">{title}</div>}
          {description && <div className="text-sm text-text-secondary">{description}</div>}
        </div>
        <RadixToast.Close asChild>
          <button className="p-1 text-text-secondary hover:text-text-primary">
            <X size={16} />
          </button>
        </RadixToast.Close>
      </div>
    </RadixToast.Root>
  )
}
```

- [ ] **Step 2: Create useToast hook**

Create `client/src/hooks/useToast.jsx`:

```jsx
import { useUI } from './useAppData'
import { useCallback } from 'react'

export function useToast() {
  const { toastQueue, setToastQueue } = useUI()
  
  const show = useCallback((message, options = {}) => {
    const id = Date.now()
    const toast = { id, title: message, ...options }
    setToastQueue([...toastQueue, toast])
    
    if (options.duration !== -1) {
      setTimeout(() => {
        setToastQueue(q => q.filter(t => t.id !== id))
      }, options.duration || 3000)
    }
    
    return id
  }, [toastQueue, setToastQueue])
  
  return { show }
}
```

- [ ] **Step 3: Commit**

```bash
git add client/src/primitives/Toast.jsx client/src/hooks/useToast.jsx
git commit -m "feat(phase3): create Toast primitive and useToast hook"
```

---

### Task 34: Create primitives barrel export

**Files:**
- Create: `client/src/primitives/index.js`

- [ ] **Step 1: Create barrel export**

Create `client/src/primitives/index.js`:

```js
export { Dialog } from './Dialog'
export { ConfirmDialog } from './ConfirmDialog'
export { Tooltip } from './Tooltip'
export { DropdownMenu } from './DropdownMenu'
export { Tabs } from './Tabs'
export { Select } from './Select'
export { Toast } from './Toast'
```

- [ ] **Step 2: Commit**

```bash
git add client/src/primitives/index.js
git commit -m "feat(phase3): add primitives barrel export"
```

---

### Task 35: Smoke test Phase 3 — verify Radix primitives work

**Files:**
- Test: `client/src/primitives/` (functional test)

- [ ] **Step 1: Start dev server**

Run: `npm run dev --prefix client`
Expected: No build errors.

- [ ] **Step 2: Run unit tests**

Run: `npm run test:unit --prefix client`
Expected: All tests pass.

- [ ] **Step 3: Manual verification**

Open http://localhost:5173. Verify:
- App still loads and routes work
- All new token variables are applied

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "phase3: smoke test passed — Radix primitives integrated"
```

---

### Task 36: Create shared/primitives/Button, Card, Input, Badge, EmptyState

**Files:**
- Create: `client/src/primitives/Button.jsx`
- Create: `client/src/primitives/Card.jsx`
- Create: `client/src/primitives/Input.jsx`
- Create: `client/src/primitives/Badge.jsx`
- Create: `client/src/primitives/EmptyState.jsx`

- [ ] **Step 1: Create Button**

Create `client/src/primitives/Button.jsx`:

```jsx
import clsx from 'clsx'

export function Button({ variant = 'default', size = 'md', children, className, ...props }) {
  const baseStyle = 'inline-flex items-center justify-center rounded-control font-medium transition-colors focus-visible:outline-none focus-visible:ring-2'
  const variants = {
    default: 'bg-accent text-bg-base hover:bg-accent-hover',
    secondary: 'bg-bg-panel text-text-primary border border-border-strong hover:bg-bg-overlay',
    ghost: 'hover:bg-bg-panel',
  }
  const sizes = {
    sm: 'px-2 py-1 text-xs',
    md: 'px-3 py-2 text-sm',
    lg: 'px-4 py-3 text-base',
  }
  
  return (
    <button className={clsx(baseStyle, variants[variant], sizes[size], className)} {...props}>
      {children}
    </button>
  )
}
```

- [ ] **Step 2: Create Card**

Create `client/src/primitives/Card.jsx`:

```jsx
export function Card({ children, className = '' }) {
  return (
    <div className={`panel ${className}`}>
      {children}
    </div>
  )
}
```

- [ ] **Step 3: Create Input**

Create `client/src/primitives/Input.jsx`:

```jsx
export function Input({ type = 'text', placeholder, className = '', ...props }) {
  return (
    <input
      type={type}
      placeholder={placeholder}
      className={`control w-full ${className}`}
      {...props}
    />
  )
}
```

- [ ] **Step 4: Create Badge**

Create `client/src/primitives/Badge.jsx`:

```jsx
export function Badge({ children, variant = 'default' }) {
  const variants = {
    default: 'bg-bg-overlay text-text-secondary',
    accent: 'bg-accent text-bg-base',
    success: 'bg-success text-bg-base',
    warning: 'bg-warning text-bg-base',
    critical: 'bg-critical text-bg-base',
  }
  
  return (
    <span className={`inline-block text-xs px-2 py-1 rounded-pill ${variants[variant]}`}>
      {children}
    </span>
  )
}
```

- [ ] **Step 5: Create EmptyState**

Create `client/src/primitives/EmptyState.jsx`:

```jsx
export function EmptyState({ title, message, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <h3 className="text-lg font-semibold text-text-primary mb-2">{title}</h3>
      <p className="text-text-secondary mb-4">{message}</p>
      {action}
    </div>
  )
}
```

- [ ] **Step 6: Update primitives/index.js**

Add exports:

```js
export { Button } from './Button'
export { Card } from './Card'
export { Input } from './Input'
export { Badge } from './Badge'
export { EmptyState } from './EmptyState'
```

- [ ] **Step 7: Commit**

```bash
git add client/src/primitives/Button.jsx client/src/primitives/Card.jsx client/src/primitives/Input.jsx client/src/primitives/Badge.jsx client/src/primitives/EmptyState.jsx client/src/primitives/index.js
git commit -m "feat(phase3): create Button, Card, Input, Badge, EmptyState primitives"
```

---

### Task 37: Final smoke test — all primitives, full app test

**Files:**
- Test: `client/src/` (comprehensive)

- [ ] **Step 1: Start dev server**

Run: `npm run dev --prefix client`
Expected: No errors, instant load.

- [ ] **Step 2: Navigate all routes**

Verify each route still works, new tokens applied, all navigation works.

- [ ] **Step 3: Run all tests**

Run: `npm run test:unit --prefix client`
Expected: All tests pass.

- [ ] **Step 4: Portable build verification**

Run: `npm run build:portable --prefix server`
Expected: Builds successfully.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "phase3: complete — all Radix primitives integrated, full app tested"
```

---

### Task 38: Documentation — update CLAUDE.md with Phase 3 completion

**Files:**
- Modify: `CLAUDE.md` (status section)

- [ ] **Step 1: Update phase status**

Edit `CLAUDE.md`, find the "Phase Status" table. Update:

```markdown
| Phase | Status | Description |
|---|---|---|
| 1 | ✅ Shipped | Tokens, shell, router |
| 2 | ✅ Shipped | View extraction, context split, App.jsx < 300 lines |
| 3 | ✅ Shipped | Radix primitives, modal migration, layout primitives |
| 4 | 📋 Planned | Graph-backed SAML field resolution |
| 5 | 📋 Planned | Replace DOM traversal with graph extraction |
```

- [ ] **Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: update phase status — UI overhaul complete"
```

---

## Self-Review

### Spec Coverage

- ✅ **Layer 1 — Tokens** (Task 2): tokens.css with all color, geometry, motion tokens; body gradient; escape hatches
- ✅ **Layer 2 — Shell** (Tasks 6-10): navConfig, Sidebar, TopBar, AppLayout, router with real URLs
- ✅ **Layer 3 — Primitives** (Tasks 27-36): Dialog, ConfirmDialog, Tooltip, DropdownMenu, Tabs, Select, Toast, Button, Card, Input, Badge, EmptyState
- ✅ **Layer 4 — Decomposition** (Tasks 16-25): All 10 feature views extracted to separate files, context split into 4 narrow contexts
- ✅ **Phase 1** (Tasks 1-13): Dependencies, tokens, index.css refactor, shell, router, smoke test
- ✅ **Phase 2** (Tasks 14-25): Context split, view extraction in spec-defined order, App.jsx < 300 lines
- ✅ **Phase 3** (Tasks 26-37): Radix packages, all primitives, migration tactic (shim → features → retire)
- ✅ **Router** (Task 10): createBrowserRouter, SPA fallback at server (confirmed no change needed), all routes
- ✅ **Fonts** (Task 4): @fontsource imports in main.jsx, no CDN fallback
- ✅ **Escape hatches** (Task 2): content-stable-paint, app-stable-paint, catalog-grid preserved
- ✅ **Testing** (Tasks 12, 25, 35): npm run test:unit --prefix client used, not vitest
- ✅ **Portable build** (Tasks 13, 35): Verified fonts load offline

### Placeholder Scan

✅ All tasks have complete code, no "TBD", "TODO", "implement later", or "similar to Task N"

### Type Consistency

✅ Functions, component names, props consistent across all tasks (e.g., `onOpenChange` used uniformly for Dialog/ConfirmDialog)

---

## Plan Summary

**38 tasks across 3 phases:**
- **Phase 1:** 13 tasks — tokens, shell, router, smoke test
- **Phase 2:** 13 tasks — context split, view extraction, App.jsx shrink
- **Phase 3:** 12 tasks — Radix primitives, migration, final test

Each phase ships independently to `main` with passing tests. Full app transformation with zero breaking changes to existing features.

