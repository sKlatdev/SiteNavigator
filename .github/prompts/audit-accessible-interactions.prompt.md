---
name: audit-accessible-interactions
description: 'Audit an interactive UI snippet for accessibility behavior and return a checklist-based pass/fail report with fixes.'
argument-hint: 'Paste a component or HTML snippet and describe expected keyboard behavior and user flow.'
agent: agent
---

Related skill: `accessible-interaction-patterns`.

Audit interactive accessibility behavior for a pasted snippet and return actionable results.

## Inputs
- Component or HTML snippet
- Pattern intent (dialog, menu, tabs, disclosure, combobox, form)
- Expected keyboard behavior
- Any known constraints (framework, library, browser targets)

## Procedure
1. Identify the interaction pattern and expected semantics.
2. Check keyboard operability and focus flow.
3. Validate roles, labels, and ARIA/state synchronization.
4. Check announcements, validation messaging, and recovery paths.
5. Return pass/fail with concrete fixes and severity.

## Output Format
1. Pattern detected
2. Checklist results
3. Findings ordered by severity
4. Minimal fix plan
5. Re-test checklist

## Checklist Results Schema
For each check, return:
- Status: PASS | PARTIAL | FAIL
- Evidence: exact snippet reference
- Impact: user-facing accessibility impact
- Fix: smallest practical change

## Required Checks
- Semantic element choice and labeling
- Keyboard support (`Tab`, `Shift+Tab`, `Enter`, `Space`, `Escape`, arrows where relevant)
- Focus entry, containment (when modal), and focus return
- ARIA attributes matching visible state
- Error/validation association and announcement
- Disabled and edge-state behavior

## Constraints
- Do not rewrite entire components unless requested.
- Prefer native semantics over ARIA-heavy rewrites.
- Keep fixes targeted and implementation-ready.
