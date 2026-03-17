---
name: component-architecture-designer
description: 'Design React/Next.js component architecture before coding. Use when planning new UI features, page layouts, Tailwind component systems, props/state contracts, data flow, interaction behavior, reusability strategy, and accessibility requirements. Outputs architecture first and only produces code when explicitly requested.'
argument-hint: 'Describe the feature/page, user goals, data sources, constraints, and whether you want architecture-only or architecture + code.'
user-invocable: true
---

# Component Architecture Designer

Create a structured component architecture plan before implementation. This skill is architecture-first by default.

## When to Use
- Planning a new React or Next.js page, feature, or flow
- Refactoring a complex UI into reusable components
- Defining component boundaries before coding
- Preparing implementation-ready specs for Tailwind-based UI work
- Reviewing architecture quality before a coding phase

## Required Inputs
Collect or confirm these inputs before producing the final plan:
- Product intent: user problem, success criteria, and primary user journeys
- Context: React app or Next.js app (App Router or Pages Router)
- Data: sources (API, server actions, local state, cache), update frequency, loading/error behavior
- Constraints: design system rules, performance targets, SEO/SSR needs, device support
- Accessibility: target WCAG level, keyboard/screen reader requirements, localization needs
- Deployment mode: client-only static app (default) or server-capable app

If inputs are incomplete, ask concise questions first.

## Output Contract
Always return architecture artifacts first in this exact order:
1. Component tree
2. Props and state definitions
3. Data flow
4. Interaction patterns
5. Reusability considerations
6. Accessibility notes

Do not output implementation code unless the user explicitly asks for code.

Use a strict schema with a version marker so output stays consistent and can evolve safely.

## Procedure
1. Clarify scope and constraints.
- Confirm route/screen boundaries, user goals, and technical constraints.
- Identify whether this is greenfield design, extension, or refactor.

2. Build the component tree.
- Start from page/section containers down to leaf UI components.
- Label server/client responsibility for Next.js where relevant.
- Mark ownership boundaries (layout, feature, shared UI primitives).

3. Define props and state.
- For each component, list input props with types, defaults, and validation assumptions.
- Define local UI state vs shared/global state.
- Note derived state and avoid redundant state where possible.

4. Map data flow.
- Describe data origin, transformation, and destination.
- Specify fetch location (server component, client hook, server action, API layer).
- Include loading, empty, error, and optimistic update paths.

5. Specify interaction patterns.
- Enumerate key interactions (click, keyboard, form submit, drag/drop, async states).
- Capture event ownership and callback contracts.
- Include validation, confirmation, and failure recovery behavior.

6. Evaluate reusability.
- Identify candidate shared components and composition patterns.
- Separate domain-specific logic from presentational components.
- Suggest API shapes that balance flexibility with simplicity.

7. Add accessibility notes.
- Document semantic structure, heading hierarchy, landmarks, and roles.
- Define focus order, focus traps, and keyboard interactions.
- Include ARIA guidance only when native semantics are insufficient.
- Call out color contrast, motion preferences, and screen reader announcements.

8. Run completion checks.
- Every major UI requirement is represented in the component tree.
- Each interactive component has clear state ownership.
- Data dependencies and error states are fully mapped.
- Reuse opportunities and boundaries are explicit.
- Accessibility concerns are actionable, not generic.

9. Offer optional code generation.
- If the user shows clear implementation intent (for example: "generate code", "implement this", "build this", "scaffold files"), proceed with code.
- If intent is ambiguous, ask one short confirmation question.
- When proceeding, generate code in this order:
  1. Type definitions/interfaces
  2. Component skeletons and file structure
  3. Tailwind styling primitives
  4. State/data wiring
  5. Accessibility attributes and keyboard handlers

## Response Schema (v1)
Use this exact markdown structure and section order.

### Schema Version
- v1

### 1) Component Tree
- Route/entry:
- Tree:
- Server/client boundary notes:

### 2) Props and State Definitions
- Component contracts:
- Local state ownership:
- Shared state/context:
- Derived state:

### 3) Data Flow
- Sources:
- Fetch/compute location:
- Transformations:
- Loading/empty/error paths:
- Mutation and optimistic behavior:

### 4) Interaction Patterns
- Primary interactions:
- Event ownership and callbacks:
- Validation rules:
- Failure and recovery behavior:

### 5) Reusability Considerations
- Shared primitives:
- Composition strategy:
- Extension points:
- Coupling risks:

### 6) Accessibility Notes
- Semantic structure:
- Keyboard and focus:
- ARIA usage:
- Motion/contrast/screen reader notes:

### 7) Completion Check
- [ ] Component tree covers all major requirements
- [ ] State ownership is explicit for interactive elements
- [ ] Data dependencies and error states are mapped
- [ ] Reuse boundaries are explicit
- [ ] Accessibility notes are actionable

### 8) Next Step
- If architecture-only: "Say 'implement this' when you want code."
- If implementation intent is already clear: proceed to code generation.

## Schema Evolution Policy
- Keep backward compatibility for one revision when possible.
- Mark changes as `v2`, `v3`, etc. in the first section.
- Include a short "Schema delta" note whenever the version changes.

## Optimization Notes (React, Next.js, Tailwind)
- Prefer composition over inheritance.
- Default to client-only architecture unless server capability is explicitly requested.
- If Next.js App Router is selected, treat server components, server actions, and route handlers as optional, not default.
- Minimize client state; promote state only when multiple siblings require it.
- Co-locate Tailwind utility patterns with components; extract repeated patterns into shared variants when stable.
- Guard against prop drilling with thoughtful context boundaries; avoid global state by default.
