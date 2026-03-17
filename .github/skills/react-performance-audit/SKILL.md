---
name: react-performance-audit
description: 'Audit React performance using profiler-driven workflows and rerender diagnostics. Use for finding slow renders, unstable props, expensive computations, context over-rendering, and regression-safe optimization plans.'
argument-hint: 'Describe the slow screen, suspected bottleneck, framework context, and whether you want diagnosis only or diagnosis + patch plan.'
user-invocable: true
---

# React Performance Audit

Produce profiler-first diagnostics and targeted optimization plans for React applications.

## When to Use
- UI feels slow during typing, scrolling, navigation, or filtering
- Components rerender too often without visible state changes
- Expensive lists, tables, charts, or derived calculations cause frame drops
- Memoization was added but performance did not improve
- You need a safe optimization plan with measurable acceptance criteria

## Required Inputs
Collect or confirm before final output:
- Runtime: React SPA, Next.js App Router, or other
- Scenario: exact interaction that feels slow
- Scale: data size, item counts, frequency of updates
- Environment: local dev/prod-like build, target device/browser
- Constraints: acceptable latency and code complexity limits
- Output mode: diagnosis report only, or diagnosis + fix plan

If key data is missing, ask concise questions first.

## Output Contract
Return output in this order:
1. Performance hypothesis map
2. Profiling workflow
3. Rerender diagnostics
4. Optimization plan
5. Verification checklist

Never prescribe heavy memoization before evidence.

## Procedure
1. Reproduce and baseline.
- Define a repeatable interaction script.
- Capture baseline metrics: interaction latency, commit durations, frame drops.

2. Profile with React DevTools Profiler.
- Record the slow interaction.
- Identify high-cost commits and components with largest self/total render time.
- Note why each component rendered (props, state, context, parent render).

3. Diagnose rerender sources.
- Check unstable object/function props.
- Check context providers with large changing values.
- Check list key stability and row component churn.
- Check expensive synchronous compute in render.
- Check effect loops and derived-state duplication.

4. Select minimal viable optimizations.
- Structural first: move state down, split context, isolate expensive subtrees.
- Then targeted memoization: React.memo, useMemo, useCallback at measured hotspots.
- For large lists: virtualization and row simplification.
- For expensive compute: precompute, cache, or defer.

5. Define regression-safe patch plan.
- List expected wins per change.
- List risk and rollback path.
- Keep changes incremental and benchmark after each step.

6. Re-profile and compare.
- Re-run the same interaction script.
- Compare commit durations, render counts, and UX latency.
- Keep only changes with measurable benefit.

## Rerender Diagnostic Rules
- Parent rerendering alone is not a bug; optimize only when measured cost is high.
- Context values should be narrowly scoped and stable when possible.
- Inline objects/functions are acceptable unless they trigger expensive child rerenders.
- useMemo/useCallback are performance tools, not correctness tools.

## Optimization Decision Matrix
### useMemo
Use when:
- Computation cost is significant and dependencies change less frequently than rerenders.
Avoid when:
- Computation is cheap or dependency tracking adds complexity.

### useCallback
Use when:
- Callback identity drives expensive memoized child rerenders.
Avoid when:
- Child components are cheap and not memoized.

### React.memo
Use when:
- Component is expensive and often receives stable props.
Avoid when:
- Props always change or comparison overhead exceeds gains.

### Context Splitting
Use when:
- Large provider value changes force unrelated subtree rerenders.
Avoid when:
- Consumers are few and updates are infrequent.

### Virtualization
Use when:
- Rendering many rows/items causes commit and paint bottlenecks.
Avoid when:
- Lists are small and complexity is unnecessary.

## Example Audit Snippets
### A) Stable Derived Data
```tsx
import { useMemo } from 'react';

function SearchResults({ items, query }: { items: string[]; query: string }) {
  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return items.filter((item) => item.toLowerCase().includes(q));
  }, [items, query]);

  return <ul>{filtered.map((item) => <li key={item}>{item}</li>)}</ul>;
}
```

### B) Context Split Pattern
```tsx
import { createContext, useContext } from 'react';

const SessionContext = createContext<{ userId: string } | null>(null);
const ThemeContext = createContext<'light' | 'dark'>('light');

export function useSession() {
  const value = useContext(SessionContext);
  if (!value) throw new Error('useSession requires SessionContext provider');
  return value;
}

export function useThemeMode() {
  return useContext(ThemeContext);
}
```

## Response Schema (v1)
### Schema Version
- v1

### 1) Performance Hypothesis Map
- Slow interactions:
- Suspected hotspots:
- Likely rerender triggers:

### 2) Profiling Workflow
- Capture plan:
- Tooling and metrics:
- Baseline measurements:

### 3) Rerender Diagnostics
- Component-level findings:
- Root causes:
- Non-issues to ignore:

### 4) Optimization Plan
- Change sequence:
- Expected impact:
- Risk and rollback:

### 5) Verification Checklist
- [ ] Baseline and post-change profiles captured
- [ ] Render-count regressions measured and explained
- [ ] Optimizations are hotspot-driven, not blanket memoization
- [ ] User-visible latency improved
- [ ] Complexity increase is justified by measurable gains

## Next Step Behavior
- If user requests diagnosis only: provide findings and evidence, no code patch.
- If user requests implementation: provide minimal patch plan and code changes in ranked order.
- If no profiler data exists: output an immediate profiling checklist and stop short of optimization claims.
