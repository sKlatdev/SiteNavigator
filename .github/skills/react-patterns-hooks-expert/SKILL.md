---
name: react-patterns-hooks-expert
description: 'Provide idiomatic React patterns for custom hooks, reducer architecture, context boundaries, memoization, Suspense and async components, and error boundaries. Use when designing or refactoring modern React code and deciding when to use client vs server components.'
argument-hint: 'Describe your feature, framework context (React app or Next.js App Router), data sources, and whether you want guidance, examples, or full implementation.'
user-invocable: true
---

# React Patterns & Hooks Expert

Deliver modern, idiomatic React architecture and implementation guidance with explicit pattern selection rules.

## When to Use
- Designing new React features with clear state and data boundaries
- Refactoring tangled state, effects, and prop drilling
- Deciding between custom hooks, reducers, context, and memoization
- Planning Suspense and async rendering behavior
- Adding robust error boundaries and fallback UX
- Choosing server components vs client components where supported

## Required Inputs
Collect or confirm these before final output:
- Runtime context: plain React SPA, Next.js App Router, Remix, or other
- Rendering model: client-only or server-capable
- Feature intent: user workflow and success criteria
- State profile: local UI state, shared app state, async remote state
- Performance constraints: list size, expensive computations, render hotspots
- Failure model: expected network/API errors, recoverability, fallback requirements
- Output mode: pattern guidance only, examples, or full implementation

If any of these are missing, ask concise clarifying questions first.

## Output Contract
Return output in this exact order:
1. Architecture summary
2. Pattern decisions by concern
3. Code examples
4. Trade-offs and anti-patterns
5. Completion checklist

Default to modern React practices:
- Prefer function components and hooks
- Prefer server components for non-interactive data rendering when available
- Keep client components focused on interactivity and browser APIs
- Minimize effects and derived state

## Decision Matrix

### 1) Custom Hooks
Use when:
- Logic is reused across components
- Logic bundles state + effects + event handlers
- You need one public abstraction over multiple React primitives

Avoid when:
- Logic is used once and would reduce readability if extracted
- Hook API would be too generic or leaky

Rule:
- Extract a hook after the second clear reuse or when a component exceeds one concern.

### 2) Reducer Patterns
Use when:
- State transitions are multi-step, event-driven, or interdependent
- You need predictable transitions with action semantics
- Multiple update paths target the same state graph

Avoid when:
- State is tiny and single-field updates with useState stay clear

Rule:
- If you find more than 3 related state fields with transition coupling, prefer useReducer.

### 3) Context Usage
Use when:
- Several distant descendants need the same stable value or dispatcher
- You need to eliminate prop threading for cross-cutting concerns

Avoid when:
- Data is needed by only one or two levels
- Context value changes at high frequency and would trigger broad rerenders

Rule:
- Keep context narrow by concern, and split read-heavy from write-heavy contexts.

### 4) Memoization
Use when:
- You measured a real rerender or computation bottleneck
- Child rerenders are expensive and props can be made referentially stable

Avoid when:
- Added complexity outweighs measurable gain
- Memoization is used as a default habit without profiling

Rule:
- Apply memoization only after identifying a hotspot in React DevTools profiler.

### 5) Suspense and Async Components
Use when:
- Async data loading should be declaratively coordinated with fallbacks
- Streaming and progressive reveal improve perceived performance
- In server-capable frameworks, route segments can stream independently

Avoid when:
- Error and loading states are simple enough for direct conditional rendering

Rule:
- Pair every Suspense boundary with an adjacent error boundary strategy.

### 6) Error Boundaries
Use when:
- UI subtree failures should not crash the full screen
- You need user-safe recovery and observability hooks

Avoid when:
- Expecting boundaries to catch async event handler errors (they do not)

Rule:
- Place boundaries around route shells and risky integration zones, not every small widget.

## Procedure
1. Classify rendering capability.
- If server-capable (for example Next.js App Router), default to server components for data-fetching and static/mostly-static UI.
- Use client components only where interactivity, subscriptions, or browser APIs are required.

2. Map state concerns.
- Local ephemeral UI state -> useState.
- Coupled transition state -> useReducer.
- Cross-tree stable dependencies -> context.
- Remote async state -> framework loader/server component data fetching, with Suspense where appropriate.

3. Define hook boundaries.
- Extract custom hooks for reusable domain behavior.
- Keep hooks focused: one primary responsibility per hook.
- Return a stable, minimal API surface.

4. Establish performance strategy.
- Profile first.
- Use React.memo, useMemo, and useCallback only where measured bottlenecks exist.
- Prefer structural fixes (state locality, boundary splits) before memoization.

5. Add resilience.
- Add error boundaries at feature or route boundaries.
- Define fallback UIs, retry actions, and logging integration.

6. Validate async UX.
- Place Suspense boundaries at meaningful loading partitions.
- Ensure loading and error fallbacks match scope and user expectations.

7. Final quality checks.
- Pattern choice has clear rationale.
- No unnecessary effects or derived state duplication.
- Server/client split is explicit where supported.
- Recovery paths are present for async and runtime failures.

## Modern React Rules
- Prefer data fetching in server components when server rendering is available.
- Mark interactive components explicitly as client components where required.
- Avoid converting whole trees to client components when only a leaf is interactive.
- Prefer declarative async boundaries (Suspense + boundary fallbacks) over ad hoc loading plumbing.
- Use useEffect for synchronization with external systems, not for pure data derivation.
- Keep reducers pure and action names domain-specific.

## Examples

### A) Custom Hook for Async Resource
```tsx
import { useEffect, useState } from 'react';

export function useProject(projectId: string) {
  const [state, setState] = useState<{ data: any; error: Error | null; loading: boolean }>({
    data: null,
    error: null,
    loading: true,
  });

  useEffect(() => {
    let active = true;
    setState({ data: null, error: null, loading: true });

    fetch(`/api/projects/${projectId}`)
      .then((r) => {
        if (!r.ok) throw new Error('Failed to load project');
        return r.json();
      })
      .then((data) => {
        if (active) setState({ data, error: null, loading: false });
      })
      .catch((error) => {
        if (active) setState({ data: null, error, loading: false });
      });

    return () => {
      active = false;
    };
  }, [projectId]);

  return state;
}
```

### B) Reducer Pattern for Complex Form Flow
```tsx
import { useReducer } from 'react';

type State = {
  step: number;
  values: Record<string, string>;
  submitting: boolean;
};

type Action =
  | { type: 'FIELD_CHANGED'; key: string; value: string }
  | { type: 'NEXT_STEP' }
  | { type: 'PREV_STEP' }
  | { type: 'SUBMIT_START' }
  | { type: 'SUBMIT_END' };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'FIELD_CHANGED':
      return {
        ...state,
        values: { ...state.values, [action.key]: action.value },
      };
    case 'NEXT_STEP':
      return { ...state, step: state.step + 1 };
    case 'PREV_STEP':
      return { ...state, step: Math.max(0, state.step - 1) };
    case 'SUBMIT_START':
      return { ...state, submitting: true };
    case 'SUBMIT_END':
      return { ...state, submitting: false };
    default:
      return state;
  }
}

export function useWizardForm() {
  return useReducer(reducer, { step: 0, values: {}, submitting: false });
}
```

### C) Context with Narrow Surface
```tsx
import { createContext, useContext, useMemo, useState } from 'react';

type Theme = 'light' | 'dark';

type ThemeContextValue = {
  theme: Theme;
  setTheme: (t: Theme) => void;
};

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>('light');
  const value = useMemo(() => ({ theme, setTheme }), [theme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const value = useContext(ThemeContext);
  if (!value) throw new Error('useTheme must be used within ThemeProvider');
  return value;
}
```

### D) Server Component with Client Leaf (Next.js App Router)
```tsx
// app/projects/[id]/page.tsx (Server Component)
import ProjectActions from './ProjectActions';

async function getProject(id: string) {
  const res = await fetch(`https://example.com/api/projects/${id}`, {
    cache: 'no-store',
  });
  if (!res.ok) throw new Error('Failed to load project');
  return res.json();
}

export default async function ProjectPage({ params }: { params: { id: string } }) {
  const project = await getProject(params.id);

  return (
    <main>
      <h1>{project.name}</h1>
      <p>{project.description}</p>
      <ProjectActions projectId={project.id} />
    </main>
  );
}
```

```tsx
// app/projects/[id]/ProjectActions.tsx (Client Component)
'use client';

import { useTransition } from 'react';

export default function ProjectActions({ projectId }: { projectId: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      disabled={pending}
      onClick={() => {
        startTransition(async () => {
          await fetch(`/api/projects/${projectId}/star`, { method: 'POST' });
        });
      }}
    >
      {pending ? 'Saving...' : 'Star project'}
    </button>
  );
}
```

### E) Error Boundary
```tsx
import { Component, ReactNode } from 'react';

type Props = { fallback: ReactNode; children: ReactNode };
type State = { hasError: boolean };

export class FeatureErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    console.error('Feature crash', error);
  }

  render() {
    if (this.state.hasError) return this.props.fallback;
    return this.props.children;
  }
}
```

## Trade-offs and Anti-patterns
- Avoid global context for frequently changing state that only one feature needs.
- Avoid useMemo and useCallback wrappers around every inline function.
- Avoid reducers with generic action names like SET_DATA when domain actions are clearer.
- Avoid massive client components when most content can render on the server.
- Avoid Suspense without a matching error strategy.

## Response Schema (v1)
Use this exact markdown structure.

### Schema Version
- v1

### 1) Architecture Summary
- Runtime context:
- Rendering strategy:
- Primary concerns:

### 2) Pattern Decisions By Concern
- Custom hooks:
- Reducer patterns:
- Context usage:
- Memoization strategy:
- Suspense/async plan:
- Error boundary placement:

### 3) Code Examples
- Example set:
- Key implementation notes:

### 4) Trade-offs and Anti-patterns
- Risks:
- Alternatives considered:

### 5) Completion Check
- [ ] Pattern choices mapped to concrete concerns
- [ ] Server vs client split is explicit when available
- [ ] Async loading and failure paths are both covered
- [ ] Performance guidance is profiler-driven
- [ ] Examples are modern React and production-safe

## Next Step Behavior
- If user asks for guidance only: return architecture and decision rules without full code.
- If user asks for implementation: generate production-ready code with tests where appropriate.
- If context is ambiguous: ask one concise disambiguation question, then proceed.
