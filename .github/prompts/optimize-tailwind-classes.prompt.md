---
name: optimize-tailwind-classes
description: 'Optimize existing Tailwind class strings by removing redundant utilities, improving readability, and preserving behavior.'
argument-hint: 'Paste the class string or JSX snippet and describe any behavior that must not change.'
agent: agent
---

Related skill: `tailwind-layout-composer`.

Optimize existing Tailwind class lists in one pass.

## Inputs
- Existing class string, component snippet, or section snippet
- Required behavior to preserve
- Responsive and dark mode expectations

## Procedure
1. Read the existing classes and preserve intended behavior.
2. Remove contradictory and redundant utilities.
3. Normalize spacing, layout, typography, and state ordering.
4. Minimize responsive and dark variants while preserving layout intent.
5. Return the optimized classes and a short change log.

## Output Format
1. Optimized classes
2. Behavior parity notes
3. Removed utilities (with reason)
4. Optional extracted shared recipe (if repetition is obvious)

## Constraints
- Do not change semantics unless requested.
- Do not introduce arbitrary values unless required.
- Keep output compact and copy-ready.
