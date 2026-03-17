---
description: 'Enforce consistent Tailwind class ordering and utility hygiene in frontend source files. Use when generating or editing JSX/TSX className values.'
applyTo: 'client/src/**/*.{js,jsx,ts,tsx}'
---

# Tailwind Class Ordering

When editing Tailwind classes in matched files, keep className values readable, stable, and minimal.

## Ordering Groups
Order classes by these groups:
1. Layout and display: `container`, `block`, `flex`, `grid`, `hidden`, positioning, overflow, z-index
2. Sizing and spacing: width/height, min/max, margin/padding, gap
3. Typography: font family, size, weight, line-height, tracking, text alignment
4. Visuals: color, background, border, radius, shadow, opacity
5. Effects and transforms: filters, transitions, animations, transforms
6. Interaction and state: `hover:`, `focus:`, `active:`, `disabled:`, `aria-*`
7. Responsive and color-mode variants: `sm:`, `md:`, `lg:`, `xl:`, `2xl:`, `dark:`

## Utility Hygiene Rules
- Prefer `gap-*` for spacing between flex/grid children over repeated margin shims.
- Remove duplicates and utilities overridden later in the same class list.
- Keep breakpoint variants only when layout or readability changes meaningfully.
- Use semantic wrapper elements before adding complex utility chains.
- Avoid arbitrary values unless there is a clear, documented reason.

## Output Expectations
- Preserve existing behavior unless the task explicitly requests a design change.
- If a long class list is repeated, suggest extraction to a shared component or helper.
- Explain only non-obvious utility removals in one short note.
