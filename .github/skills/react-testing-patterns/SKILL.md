---
name: react-testing-patterns
description: 'Design practical React testing patterns for custom hooks, async UI, error boundaries, and reducer-driven components. Use for creating reliable tests with React Testing Library, deterministic async handling, and behavior-first assertions.'
argument-hint: 'Describe the component or hook, test framework, and whether you need a test plan, example tests, or full test scaffolding.'
user-invocable: true
---

# React Testing Patterns

Create behavior-focused, maintainable React test strategies with robust async and state-transition coverage.

## When to Use
- Writing or refactoring tests for hooks and component interactions
- Validating reducer transitions and event-driven UI state
- Testing async loading, success, and failure flows
- Verifying error boundary fallback and recovery behavior
- Improving confidence while avoiding brittle implementation-detail tests

## Required Inputs
Collect or confirm before final output:
- Test stack: Vitest/Jest, React Testing Library, user-event
- Runtime: client-only React or server-capable framework
- Unit under test: hook, component, route segment, or feature slice
- Critical user behaviors and edge cases
- Network strategy: mocked fetch, MSW, or integration environment
- Output mode: test plan only, examples, or full test files

If inputs are incomplete, ask concise clarifying questions first.

## Output Contract
Return output in this order:
1. Test strategy overview
2. Coverage matrix
3. Example tests
4. Reliability safeguards
5. Completion checklist

Default testing posture:
- Prefer behavior-first assertions over implementation internals
- Prefer user-visible outcomes and accessible queries
- Keep tests deterministic and isolated

## Procedure
1. Define observable behaviors.
- Translate feature requirements into user-visible outcomes.
- Separate happy path, edge path, and failure path.

2. Map test scope by level.
- Hook logic and reducer transitions: focused unit tests.
- UI interactions and async states: component tests with user-event.
- Cross-boundary integration: feature-level tests where valuable.

3. Model async behavior.
- Use explicit loading -> success/error assertions.
- Use waitFor/findBy* for eventual UI states.
- Control network behavior with deterministic mocks.

4. Validate reducer logic.
- Test transition table: action, prior state, expected next state.
- Cover invalid or unexpected actions where relevant.

5. Test error boundaries.
- Simulate child throw and assert fallback rendering.
- Verify retry/recovery actions if provided.

6. Strengthen reliability.
- Avoid timing flakiness and arbitrary sleeps.
- Reset mocks and test state between runs.
- Keep assertions specific but not implementation-coupled.

## Pattern Rules
### Custom Hooks
- Use renderHook for isolated hook behavior.
- Wrap with providers only when required by hook dependencies.
- Assert returned API contract and state transitions.

### Async UI
- Assert progressive states (loading, loaded, failed).
- Prefer screen.findByRole/findByText for eventual rendering.
- Use MSW or stable fetch mocks for realistic network behavior.

### Error Boundaries
- Assert fallback UI and logging side effects where needed.
- Test that unaffected siblings continue rendering.

### Reducers
- Prefer table-driven tests for transition clarity.
- Keep actions domain-specific in test names.

## Example Tests
### A) Reducer Transition Table
```ts
import { describe, expect, it } from 'vitest';

type State = { count: number };
type Action = { type: 'INC' } | { type: 'DEC' };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'INC':
      return { count: state.count + 1 };
    case 'DEC':
      return { count: state.count - 1 };
    default:
      return state;
  }
}

describe('counter reducer', () => {
  it.each([
    [{ count: 0 }, { type: 'INC' }, { count: 1 }],
    [{ count: 1 }, { type: 'DEC' }, { count: 0 }],
  ])('transitions %o with %o to %o', (prev, action, next) => {
    expect(reducer(prev as State, action as Action)).toEqual(next);
  });
});
```

### B) Async Component Behavior
```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';

function SaveButton({ onSave }: { onSave: () => Promise<void> }) {
  const [pending, setPending] = React.useState(false);

  return (
    <button
      onClick={async () => {
        setPending(true);
        try {
          await onSave();
        } finally {
          setPending(false);
        }
      }}
    >
      {pending ? 'Saving...' : 'Save'}
    </button>
  );
}

it('shows pending state during save', async () => {
  const onSave = vi.fn(async () => {
    await Promise.resolve();
  });

  render(<SaveButton onSave={onSave} />);

  await userEvent.click(screen.getByRole('button', { name: 'Save' }));
  expect(screen.getByRole('button', { name: 'Saving...' })).toBeInTheDocument();
  expect(await screen.findByRole('button', { name: 'Save' })).toBeInTheDocument();
});
```

### C) Error Boundary Fallback
```tsx
import { Component, ReactNode } from 'react';
import { render, screen } from '@testing-library/react';

class TestBoundary extends Component<{ children: ReactNode }, { crashed: boolean }> {
  state = { crashed: false };

  static getDerivedStateFromError() {
    return { crashed: true };
  }

  render() {
    if (this.state.crashed) return <p role='status'>Something went wrong</p>;
    return this.props.children;
  }
}

function Broken() {
  throw new Error('boom');
}

it('renders fallback when child crashes', () => {
  render(
    <TestBoundary>
      <Broken />
    </TestBoundary>
  );

  expect(screen.getByRole('status', { name: 'Something went wrong' })).toBeInTheDocument();
});
```

## Reliability Safeguards
- Prefer role-based queries before text-only queries.
- Keep mock setup local to each test when possible.
- Reset mock handlers and spies after each test.
- Avoid snapshot-heavy suites for dynamic interactive UIs.
- Test behavior contracts, not hook internals or private state shape.

## Response Schema (v1)
### Schema Version
- v1

### 1) Test Strategy Overview
- Unit under test:
- Test levels:
- Tooling assumptions:

### 2) Coverage Matrix
- Happy paths:
- Edge cases:
- Failure and recovery:

### 3) Example Tests
- Hooks:
- Async UI:
- Error boundaries:
- Reducers:

### 4) Reliability Safeguards
- Determinism controls:
- Flake prevention:
- Assertion quality checks:

### 5) Completion Checklist
- [ ] Critical behaviors mapped to tests
- [ ] Async success and failure paths covered
- [ ] Reducer transitions validated with clear action semantics
- [ ] Error boundary fallback and recovery verified
- [ ] Tests avoid implementation-detail coupling

## Next Step Behavior
- If user asks for strategy: provide test matrix and priorities only.
- If user asks for implementation: generate concrete test files aligned to current stack.
- If stack is unknown: ask one concise question, then proceed with sensible defaults.
