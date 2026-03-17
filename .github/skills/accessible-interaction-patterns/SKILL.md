---
name: accessible-interaction-patterns
description: 'Design accessible interactive UI patterns with keyboard behavior, focus management, ARIA usage, and validation checks. Use for dialogs, menus, tabs, disclosures, comboboxes, and form interactions.'
argument-hint: 'Describe the interaction pattern, framework context, and whether you need architecture guidance or implementation-ready behavior rules.'
user-invocable: true
---

# Accessible Interaction Patterns

Create practical accessibility guidance for interactive UI components before or during implementation.

## When to Use
- Building keyboard-accessible interactive components
- Defining focus behavior for overlays and composite widgets
- Verifying ARIA usage and semantic fallback
- Reviewing interaction states and announcements for assistive tech

## Required Inputs
Collect or confirm before final output:
- Pattern type: dialog, menu, tabs, disclosure, combobox, tooltip, form flow
- Rendering context: React component, static HTML, or other UI framework
- Trigger and content structure
- Keyboard requirements and expected shortcuts
- Error and validation behavior (if forms are involved)
- Output mode: behavior spec only or behavior spec + implementation checklist

If inputs are incomplete, ask concise clarifying questions first.

## Output Contract
Return output in this order:
1. Pattern summary
2. Semantic and ARIA contract
3. Keyboard and focus behavior
4. State and announcement behavior
5. Validation and failure handling
6. Completion checklist

Default to native HTML semantics first, then add ARIA only where native semantics do not cover the interaction.

## Procedure
1. Determine pattern and interaction boundaries.
- Identify trigger, controlled content, and escape conditions.
- Confirm whether pattern is modal, non-modal, or inline.

2. Define semantic structure.
- Prefer native interactive elements (`button`, `input`, `select`, `details`, `dialog`) when suitable.
- Map required roles and properties only when native semantics are insufficient.

3. Specify keyboard behavior.
- Document tab sequence and roving focus where applicable.
- Define required keys (`Enter`, `Space`, arrow keys, `Escape`, `Home`, `End`).
- Ensure no keyboard traps except intentional modal traps with clear exit.

4. Specify focus management.
- Define initial focus target on open/mount.
- Define focus return target on close/unmount.
- Include behavior for dynamic content updates and disabled items.

5. Define state and announcements.
- Map visual state to accessible state (`aria-expanded`, `aria-selected`, `aria-checked`, `aria-invalid`).
- Identify live announcements for async updates and validation feedback.

6. Cover validation and error recovery.
- Link errors to fields and helper text.
- Define corrective path after failed actions.
- Preserve context so users do not lose task position.

7. Run completion checks.
- All actions are keyboard reachable and operable.
- Focus transitions are deterministic.
- ARIA attributes match actual UI state.
- Announcements are meaningful and non-duplicative.
- Error recovery is explicit and testable.

## Response Schema (v1)
Use this exact markdown structure.

### Schema Version
- v1

### 1) Pattern Summary
- Pattern type:
- Trigger/content model:
- Modal or non-modal behavior:

### 2) Semantic and ARIA Contract
- Native elements:
- Required roles/properties:
- Labeling strategy:

### 3) Keyboard and Focus Behavior
- Key map:
- Tab and focus order:
- Open/close focus transitions:

### 4) State and Announcement Behavior
- State attributes:
- Live region or status messaging:
- Screen reader notes:

### 5) Validation and Failure Handling
- Error association:
- Recovery path:
- Edge cases:

### 6) Completion Check
- [ ] Keyboard flow is complete and trap-free (except intentional modal trap)
- [ ] Focus entry and return behavior is defined
- [ ] ARIA usage matches visible state and semantics
- [ ] Validation feedback is linked and announced
- [ ] Failure recovery path is clear

## Decision Points
- If native element provides semantics: use native element first.
- If composite widget is required: define role model and keyboard map explicitly.
- If async updates occur: define status messaging and announcement timing.
- If modal interaction is used: require focus trap and explicit close path.

## Next Step Behavior
- If user requests implementation: convert behavior spec into component-level requirements.
- If user requests review: audit existing implementation against the completion checklist.
- If user requests test planning: produce keyboard and assistive-tech test cases.
