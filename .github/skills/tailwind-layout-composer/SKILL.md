---
name: tailwind-layout-composer
description: 'Generate clean, minimal Tailwind class structures for responsive UI layouts. Use for flexbox and grid composition, cards/forms/modals, typography scaling, and dark mode variants while avoiding utility bloat and inconsistent spacing.'
argument-hint: 'Describe the UI section, content hierarchy, breakpoints, and whether you want classes only or classes + brief rationale.'
user-invocable: true
---

# Tailwind Layout Composer

Generate semantic, maintainable Tailwind layout class strings with consistent spacing and responsive behavior.

## When to Use
- Building or refactoring page/section layout with Tailwind
- Creating reusable layout recipes for teams
- Standardizing spacing and breakpoint usage
- Designing cards, forms, and modal shells quickly
- Applying dark mode classes without duplicating utilities

## Required Inputs
Collect or confirm these before returning final output:
- UI scope: page shell, section, component, or full flow
- Structure: elements and semantic roles (header, nav, main, aside, form, dialog)
- Content density: compact, balanced, or spacious
- Breakpoints: target behavior for mobile, tablet, and desktop
- Theme behavior: light-only or light + dark mode
- Output style: classes only or classes with brief rationale

If key inputs are missing, ask concise clarifying questions first.

## Output Contract
Return output in this exact order:
1. Layout strategy summary
2. Class recipes by pattern
3. Responsive and dark-mode notes
4. Utility-pruning check
5. Completion check

Default to semantic wrappers and minimal utility count. Prefer reusable patterns over one-off class noise.

## Procedure
1. Confirm scope and constraints.
- Determine whether the request is a page layout, section layout, or component shell.
- Confirm spacing rhythm and breakpoint strategy.

2. Choose the layout primitive.
- Use flexbox for 1-dimensional flow, alignment, and distribution.
- Use grid for 2-dimensional arrangements and repeated content blocks.
- If both are needed, set grid for macro layout and flex for internal alignment.

3. Establish spacing and sizing tokens.
- Select a small spacing set and reuse it consistently.
- Prefer gap and padding utilities over frequent margin hacks.
- Avoid arbitrary values unless a clear requirement demands them.

4. Compose pattern recipes.
- Flexbox layouts: stacks, inline groups, split rows, sticky footer scaffolds.
- Grid layouts: auto-fit cards, fixed + fluid columns, dashboard sections.
- Cards: container, media slot, body, actions, state variants.
- Forms: grouped fields, label-input rhythm, helper/error text spacing.
- Modals: overlay, centered panel, scroll-safe body, action row.
- Typography scales: heading/body/caption hierarchy with line-height discipline.
- Dark mode: apply paired light/dark utilities at meaningful boundaries.

5. Add responsive behavior.
- Start mobile-first.
- Introduce breakpoint variants only when layout meaningfully changes.
- Keep variant count low and predictable.

6. Prune utility bloat.
- Remove redundant or overridden classes.
- Collapse repeated patterns into shared recipe suggestions.
- Replace noisy combinations with simpler semantic wrappers.

7. Run completion checks.
- Classes are minimal and non-contradictory.
- Spacing scale is consistent across related elements.
- Breakpoint usage is purposeful, not decorative.
- Dark mode variants preserve contrast and readability.
- Pattern output is reusable across similar components.

## Response Schema (v1)
Use this exact markdown structure.

### Schema Version
- v1

### 1) Layout Strategy Summary
- Layout primitive choice:
- Semantic structure:
- Spacing rhythm:

### 2) Class Recipes By Pattern
- Flexbox:
- Grid:
- Cards:
- Forms:
- Modals:
- Typography:

### 3) Responsive and Dark-Mode Notes
- Breakpoint plan:
- Dark mode plan:

### 4) Utility-Pruning Check
- Redundant utilities removed:
- Opportunities to extract shared wrappers:

### 5) Completion Check
- [ ] Uses semantic layout wrappers
- [ ] Uses consistent spacing scale
- [ ] Uses minimal responsive variants
- [ ] Includes dark mode pairs where needed
- [ ] Avoids unnecessary utilities and contradictions

## Quality Rules
- Prefer semantic containers (`section`, `article`, `form`, `dialog`) in recommendations.
- Favor `gap-*` for inter-item spacing in flex/grid over ad hoc margins.
- Prefer stable scales (`text-sm`, `text-base`, `text-lg`, `text-xl`, etc.) instead of arbitrary typography values.
- Keep class lists readable by grouping layout, spacing, typography, color, and state.
- Use dark mode variants only where visual contrast changes, not globally by default.

## Decision Points
- If layout has one primary axis: choose flex.
- If layout needs row and column control: choose grid.
- If both apply: use grid for outer skeleton, flex inside cells/components.
- If utility lists become long or repeated: recommend extracting shared component wrappers.

## Next Step Behavior
- If user asks for implementation: provide concrete class strings per requested component.
- If user asks for refinement: optimize existing class strings and explain removals.
- If user asks for systemization: output reusable layout recipes and naming guidance.