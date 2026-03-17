---
name: server-components-boundary-reviewer
description: 'Review and enforce React Server Components boundaries in server-capable frameworks. Use for validating client/server separation, preventing accidental client bundle expansion, and fixing boundary violations in Next.js App Router code.'
argument-hint: 'Describe the route or feature, framework version, and whether you want an audit report or report + remediation plan.'
user-invocable: true
---

# Server Components Boundary Reviewer

Audit and enforce clean boundaries between server and client components, with emphasis on correctness and bundle discipline.

## When to Use
- Reviewing Next.js App Router features for client/server separation
- Preventing unnecessary use of use client at high-level components
- Fixing hydration mismatch and boundary misuse issues
- Reducing client bundle size caused by server-to-client leakage
- Hardening code review standards for RSC architecture

## Required Inputs
Collect or confirm before final output:
- Framework and version (for example Next.js App Router)
- Feature scope: route segment, layout, or shared component set
- Data sources: fetch, server actions, client APIs
- Interactive elements: forms, buttons, browser-only behavior
- Output mode: boundary audit only, or audit + remediation plan

If missing, ask concise clarifying questions first.

## Output Contract
Return output in this order:
1. Boundary map
2. Violations and risks
3. Remediation plan
4. Code examples
5. Completion checklist

Default posture:
- Server-first for data and non-interactive rendering
- Client islands for interactivity and browser APIs
- Keep client boundaries as small and local as possible

## Boundary Rules
### Server Component Allowed
- Async data fetching on server
- Access to server-side secrets and direct backend calls
- Rendering non-interactive markup and composed client leaves

### Server Component Disallowed
- useState, useEffect, useRef, useLayoutEffect
- Browser-only globals such as window, document, localStorage
- Direct event handlers in rendered JSX (onClick, onChange) without client leaf

### Client Component Required
- Interactive controls and event handlers
- Browser APIs and subscriptions
- Hooks requiring client runtime

### Client Component Risks
- Marking top-level layout/page as client without necessity
- Importing server-only modules or secret-bearing code
- Pulling large static content or fetch logic into client tree

## Procedure
1. Build boundary map.
- Identify server entry points: layout, page, async components.
- Identify client islands and their parent server components.
- Trace imports across boundaries.

2. Detect violations.
- Flag server files using client-only hooks/APIs.
- Flag client files importing server-only modules.
- Flag oversized client boundaries due to broad use client placement.

3. Assess bundle and behavior impact.
- Estimate client JS expansion caused by boundary mistakes.
- Note hydration or runtime mismatch risks.
- Prioritize fixes by user impact and complexity.

4. Propose remediation.
- Move use client downward to smallest interactive leaf.
- Split mixed-responsibility components into server shell + client action component.
- Rehome fetch and serialization logic to server component.

5. Validate architectural invariants.
- Data fetching remains on server by default.
- Interactivity remains in focused client islands.
- No illegal imports or hook usage across boundaries.

## Enforcement Heuristics
- If a component has no event handlers and no browser API usage, it should stay server-side.
- If only one child is interactive, isolate that child as client and keep parent server.
- Avoid passing non-serializable values from server to client.
- Prefer server actions and route handlers for mutations when supported.

## Example Refactor
### Before (boundary too high)
```tsx
// app/dashboard/page.tsx
'use client';

import { useEffect, useState } from 'react';

export default function DashboardPage() {
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    fetch('/api/stats').then((r) => r.json()).then(setStats);
  }, []);

  return <button onClick={() => alert('clicked')}>{stats?.total ?? '...'}</button>;
}
```

### After (server shell + client leaf)
```tsx
// app/dashboard/page.tsx (Server Component)
import RefreshButton from './RefreshButton';

async function getStats() {
  const res = await fetch('https://example.com/api/stats', { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to fetch stats');
  return res.json();
}

export default async function DashboardPage() {
  const stats = await getStats();

  return (
    <section>
      <h1>Dashboard</h1>
      <p>Total: {stats.total}</p>
      <RefreshButton />
    </section>
  );
}
```

```tsx
// app/dashboard/RefreshButton.tsx (Client Component)
'use client';

export default function RefreshButton() {
  return <button onClick={() => window.location.reload()}>Refresh</button>;
}
```

## Response Schema (v1)
### Schema Version
- v1

### 1) Boundary Map
- Server components:
- Client components:
- Cross-boundary props:

### 2) Violations and Risks
- Rule violations:
- Bundle/perf risks:
- Correctness risks:

### 3) Remediation Plan
- Priority fixes:
- Refactor steps:
- Expected impact:

### 4) Code Examples
- Before/after snippets:
- Boundary rationale:

### 5) Completion Checklist
- [ ] Server/client responsibilities are explicit
- [ ] use client appears only at necessary leaves
- [ ] No client-only hooks or browser APIs in server components
- [ ] No server-only imports in client components
- [ ] Client bundle scope is minimized

## Next Step Behavior
- If user asks for review: return findings ranked by severity with concrete file-level fixes.
- If user asks for implementation: produce boundary-safe refactor patches in small steps.
- If framework is not server-capable: explain boundary concepts and adapt to client-only best practices.
