# Impeccable Integration Design

**Date:** 2026-04-21
**Status:** Approved

## Overview

Integrate [pbakaus/impeccable](https://github.com/pbakaus/impeccable) into SiteNavigator as a Claude Code skill set, paired with an automated recommendation system that surfaces the right impeccable commands after every UI edit — without requiring the developer to remember all 18 commands.

A separate plan will cover the full UI overhaul to implement the SiteNavigator "Soft Intelligence" design schema. This plan covers only the tooling integration.

---

## Part 1: Installation

### What gets installed

Copy impeccable's Claude Code distribution from `dist/claude-code/.claude/` into the project's `.claude/` directory. This adds:

- `.claude/skills/impeccable/` — the core design skill (context gathering, design direction, craft/extract/teach flows)
- `.claude/skills/audit/`, `critique/`, `polish/`, `layout/`, `typeset/`, `colorize/`, `animate/`, `optimize/`, `harden/`, `clarify/`, `distill/`, `bolder/`, `quieter/`, `delight/`, `adapt/`, `overdrive/`, `shape/` — all 18 command skills

### Design context file

Create `.impeccable.md` at the project root. Impeccable reads this file before any design work to ground recommendations in SiteNavigator's actual design language rather than generic defaults.

**Contents:**

```markdown
# SiteNavigator Design Context

## Target Audience
Security engineers and IT administrators evaluating or deploying SSO/SAML solutions.
Power users comfortable with dense, technical information interfaces.

## Use Cases
- Cross-vendor documentation search and gap analysis (Duo vs. Okta, Entra, Ping Identity)
- SAML template generation and field mapping
- Competitive intelligence during procurement decisions

## Brand Personality / Tone
"Soft Intelligence" — sophisticated glassmorphic aesthetic that reduces cognitive load
during long research sessions. Technical authority without coldness.

## Visual Language
- Glassmorphism: multi-layer blur (12–24px), translucent surfaces (80–90% opacity)
- Obsidian base (#051424), panel layer (#0d1c2d), overlay layer (#1e293b)
- 16px radius on containers, 8px on interactive elements
- Inter for body/UI, JetBrains Mono for code and technical identifiers

## Color Architecture
- Accent: Indigo Soft (#818cf8) — CTAs, active states, focus indicators
- Success: #34d399 / Warning: #fbbf24 / Critical: #fb7185
- Text: Zinc 50 (primary), Zinc 400 (secondary), Zinc 500 (tertiary)

## Interaction Principles
- Transitions: 150–200ms ease-in-out
- Button press: 98% scale; focus: soft border-glow
- High density with generous internal padding (1.5rem+) inside cards

## Design System
uipro design system (glass-tokens.css, Tailwind CSS, React 19).
Fixed obsidian sidebar shell, slim semi-transparent top bar.
```

---

## Part 2: Automated Recommendation System

### Trigger

After **every edit** to any file in `client/src/`, Claude scans the change against the command-to-trigger mapping and appends an **"Impeccable Recommendations"** block to the response.

### On-demand

At any time the developer can ask "what should I run here?" and Claude analyzes the current state of the UI files and returns a prioritized recommendation list.

### Recommendation format

Each recommendation includes:
1. The slash command to run
2. What the command does
3. Which specific part of the change it targets
4. What outcome to expect

### Command-to-trigger mapping

| Change Signal | Commands |
|---|---|
| New component added | `/audit`, `/critique`, `/harden` |
| Layout / spacing / grid changes | `/layout`, `/audit` |
| Color additions or changes | `/colorize`, `/audit` |
| Typography / font / text sizing | `/typeset`, `/clarify` |
| Animation or transitions added | `/animate` |
| Form fields, inputs, validation UI | `/harden`, `/audit`, `/clarify` |
| Loading states, empty states, errors | `/harden`, `/delight` |
| Modal, drawer, overlay added | `/critique`, `/audit` |
| Design feels flat or generic | `/bolder`, `/colorize` |
| Design feels cluttered or heavy | `/quieter`, `/distill` |
| New page or major feature area | `/critique`, `/audit`, `/polish` |
| Pre-ship / final cleanup | `/polish`, `/audit` |
| Performance concern (large renders) | `/optimize` |
| Responsive/mobile considerations | `/adapt`, `/audit` |
| Extraordinary visual effect wanted | `/overdrive` |

### CLAUDE.md instruction block

A new `## Impeccable UI Recommendations` section is added to `CLAUDE.md` containing:
- The mapping table above
- The instruction: after every edit to `client/src/**`, identify all matching signals, append an "Impeccable Recommendations" block with full-context recommendations for each matched command
- The instruction: when asked "what should I run here?", read current `client/src/` state and return the same format

---

## Part 3: Out of Scope

- **UI overhaul** — implementing the DesignSchema.md visual language is a separate plan
- **Global install** — impeccable is installed project-local only (`.claude/skills/`), not to `~/.claude/`
- **Hooks** — no PostToolUse hooks; recommendations are inline in Claude's response, not automated shell triggers

---

## Implementation Steps

1. Download impeccable Claude Code distribution via `curl` from GitHub
2. Copy skills into `.claude/skills/`
3. Create `.impeccable.md` at project root
4. Add `## Impeccable UI Recommendations` section to `CLAUDE.md`
5. Commit all changes
