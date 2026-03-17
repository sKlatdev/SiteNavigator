---
description: 'Route requests to the right local skills/prompts with context-aware triggers and enforce a consistent architecture plan that maps every step to skills.'
applyTo: '**/*'
---

# Context-Aware Skill Orchestration

Use this instruction to consistently route user requests to the correct skills and prompt templates, then produce a skill-mapped architecture plan before implementation.

## Primary Goal
- Ensure every substantive request has an architecture-first plan.
- Require explicit skill selection for each plan step.
- Keep trigger decisions consistent across similar prompts.

## Prompt Routing Rules

### Direct Prompt Template Triggers
- If the user asks to audit accessibility behavior for an interaction snippet, use `audit-accessible-interactions.prompt.md` and `accessible-interaction-patterns`.
- If the user asks to optimize existing Tailwind class strings, use `optimize-tailwind-classes.prompt.md` and `tailwind-layout-composer`.

### Skill Trigger Matrix (Context-Aware)
- `component-architecture-designer`:
  - Trigger when the user asks for architecture, planning, component boundaries, data flow, or UI structure before coding.
  - Also trigger by default at the start of medium/large feature requests.
- `accessible-interaction-patterns`:
  - Trigger for dialogs, menus, tabs, disclosures, comboboxes, keyboard flow, focus behavior, ARIA, and validation announcements.
- `tailwind-layout-composer`:
  - Trigger for Tailwind layout generation, responsive spacing systems, card/form/modal layout, and class cleanup requests.
- `react-patterns-hooks-expert`:
  - Trigger for hook design, reducer choices, context boundaries, Suspense decisions, and error boundary strategy.
- `react-performance-audit`:
  - Trigger for slow render, rerender churn, profiling requests, list lag, input latency, or memoization concerns.
- `react-testing-patterns`:
  - Trigger for test strategy, RTL/Vitest patterns, async test reliability, reducer/hook tests, or error boundary tests.
- `refactoring-code-quality-agent`:
  - Trigger for safe incremental cleanup, naming improvements, extraction, duplication removal, and complexity reduction.
- `server-components-boundary-reviewer`:
  - Trigger for Next.js App Router client/server separation, `use client` placement, and bundle boundary concerns.

## Composition Rules
- Use one primary skill per step and optional supporting skills.
- Use multiple skills when a step spans concerns (for example: architecture + accessibility + testing).
- For server-capable contexts, run a boundary check before final implementation recommendations.
- For UI work, include accessibility and testing considerations before declaring the plan complete.

## Mandatory Output Schema
For architecture/planning responses, use this exact section order:

### Schema Version
- v1

### 1) Request Summary
- Goal:
- Scope:
- Constraints:

### 2) Context-Aware Trigger Decisions
- Triggered skills:
- Why each skill was triggered:
- Prompt templates used:

### 3) Skill-Mapped Architecture Plan
For each step, include:
- Step:
- Recommendation:
- Primary skill:
- Supporting skills:
- Inputs required:
- Output artifact:
- Definition of done:

### 4) Consistency Checks
- Terminology consistency:
- State/data contract consistency:
- Accessibility consistency:
- Styling/layout consistency:
- Testing consistency:

### 5) Risks and Mitigations
- Risk:
- Mitigation:
- Owner skill:

### 6) Next Action
- If architecture-only: ask for implementation confirmation.
- If implementation intent is clear: proceed with code in plan order.

## Consistency Guardrails
- Keep naming aligned across architecture, code, and tests.
- Keep state ownership decisions stable across all recommendations.
- Avoid contradictory guidance between skills; resolve conflicts explicitly.
- Reuse established schemas from the selected skills whenever possible.

## Conflict Resolution
- If two skills conflict, prioritize in this order:
  1. Correctness and accessibility
  2. Architecture clarity and boundary safety
  3. Performance evidence
  4. Styling/layout polish
- Record the conflict and final decision in the plan.

## Completion Requirements
- No final recommendation without at least one explicit skill mapping.
- No architecture output without the Skill-Mapped Architecture Plan section.
- No implementation recommendation without consistency checks and risks.
