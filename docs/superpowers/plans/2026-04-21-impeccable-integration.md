# Impeccable Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Install impeccable's 18 design command skills into the project and wire up an automated recommendation system in CLAUDE.md that surfaces the right commands after every UI edit.

**Architecture:** Impeccable skills are copied from the GitHub repo directly into `.claude/skills/` via curl. A `.impeccable.md` design context file is created at the project root. A new `## Impeccable UI Recommendations` section is added to `CLAUDE.md` with a command-to-trigger mapping and the instruction to surface recommendations after every `client/src/` edit.

**Tech Stack:** curl, bash, Claude Code skills (Markdown), CLAUDE.md

---

## File Map

| Action | Path |
|--------|------|
| Create | `.claude/skills/impeccable/SKILL.md` |
| Create | `.claude/skills/impeccable/reference/color-and-contrast.md` |
| Create | `.claude/skills/impeccable/reference/craft.md` |
| Create | `.claude/skills/impeccable/reference/extract.md` |
| Create | `.claude/skills/impeccable/reference/interaction-design.md` |
| Create | `.claude/skills/impeccable/reference/motion-design.md` |
| Create | `.claude/skills/impeccable/reference/responsive-design.md` |
| Create | `.claude/skills/impeccable/reference/spatial-design.md` |
| Create | `.claude/skills/impeccable/reference/typography.md` |
| Create | `.claude/skills/impeccable/reference/ux-writing.md` |
| Create | `.claude/skills/impeccable/scripts/cleanup-deprecated.mjs` |
| Create | `.claude/skills/adapt/SKILL.md` |
| Create | `.claude/skills/animate/SKILL.md` |
| Create | `.claude/skills/audit/SKILL.md` |
| Create | `.claude/skills/bolder/SKILL.md` |
| Create | `.claude/skills/clarify/SKILL.md` |
| Create | `.claude/skills/colorize/SKILL.md` |
| Create | `.claude/skills/critique/SKILL.md` |
| Create | `.claude/skills/delight/SKILL.md` |
| Create | `.claude/skills/distill/SKILL.md` |
| Create | `.claude/skills/harden/SKILL.md` |
| Create | `.claude/skills/layout/SKILL.md` |
| Create | `.claude/skills/optimize/SKILL.md` |
| Create | `.claude/skills/overdrive/SKILL.md` |
| Create | `.claude/skills/polish/SKILL.md` |
| Create | `.claude/skills/quieter/SKILL.md` |
| Create | `.claude/skills/shape/SKILL.md` |
| Create | `.claude/skills/typeset/SKILL.md` |
| Create | `.impeccable.md` |
| Modify | `CLAUDE.md` |

---

## Task 1: Create skill directories

**Files:**
- Create: `.claude/skills/impeccable/reference/` (directory)
- Create: `.claude/skills/impeccable/scripts/` (directory)
- Create: `.claude/skills/adapt/`, `animate/`, `audit/`, `bolder/`, `clarify/`, `colorize/`, `critique/`, `delight/`, `distill/`, `harden/`, `layout/`, `optimize/`, `overdrive/`, `polish/`, `quieter/`, `shape/`, `typeset/` (directories)

- [ ] **Step 1: Create all skill directories**

```bash
mkdir -p .claude/skills/impeccable/reference
mkdir -p .claude/skills/impeccable/scripts
for skill in adapt animate audit bolder clarify colorize critique delight distill harden layout optimize overdrive polish quieter shape typeset; do
  mkdir -p ".claude/skills/$skill"
done
```

Expected: no output, no errors.

- [ ] **Step 2: Verify directories exist**

```bash
ls .claude/skills/
```

Expected output includes: `adapt  animate  audit  bolder  clarify  colorize  critique  delight  distill  harden  impeccable  layout  optimize  overdrive  polish  quieter  shape  typeset`

---

## Task 2: Download the impeccable core skill

**Files:**
- Create: `.claude/skills/impeccable/SKILL.md`
- Create: `.claude/skills/impeccable/scripts/cleanup-deprecated.mjs`

- [ ] **Step 1: Download core SKILL.md**

```bash
curl -s "https://raw.githubusercontent.com/pbakaus/impeccable/main/.claude/skills/impeccable/SKILL.md" -o ".claude/skills/impeccable/SKILL.md"
```

Expected: no output. File created.

- [ ] **Step 2: Verify it downloaded**

```bash
head -5 .claude/skills/impeccable/SKILL.md
```

Expected: first line is `---` (YAML frontmatter start).

- [ ] **Step 3: Download cleanup script**

```bash
curl -s "https://raw.githubusercontent.com/pbakaus/impeccable/main/.claude/skills/impeccable/scripts/cleanup-deprecated.mjs" -o ".claude/skills/impeccable/scripts/cleanup-deprecated.mjs"
```

Expected: no output. File created.

---

## Task 3: Download impeccable reference files

**Files:**
- Create: `.claude/skills/impeccable/reference/*.md` (9 files)

- [ ] **Step 1: Download all reference files**

```bash
BASE="https://raw.githubusercontent.com/pbakaus/impeccable/main/.claude/skills/impeccable/reference"
for ref in color-and-contrast craft extract interaction-design motion-design responsive-design spatial-design typography ux-writing; do
  curl -s "$BASE/$ref.md" -o ".claude/skills/impeccable/reference/$ref.md"
  echo "Downloaded $ref.md"
done
```

Expected: 9 lines of `Downloaded <name>.md`.

- [ ] **Step 2: Verify all 9 files exist**

```bash
ls .claude/skills/impeccable/reference/ | wc -l
```

Expected: `9`

---

## Task 4: Download all 17 command skills

**Files:**
- Create: `.claude/skills/<skill>/SKILL.md` for each of the 17 command skills

- [ ] **Step 1: Download all command skill files**

```bash
BASE="https://raw.githubusercontent.com/pbakaus/impeccable/main/.claude/skills"
for skill in adapt animate audit bolder clarify colorize critique delight distill harden layout optimize overdrive polish quieter shape typeset; do
  curl -s "$BASE/$skill/SKILL.md" -o ".claude/skills/$skill/SKILL.md"
  echo "Downloaded $skill/SKILL.md"
done
```

Expected: 17 lines of `Downloaded <skill>/SKILL.md`.

- [ ] **Step 2: Verify all 17 files exist**

```bash
for skill in adapt animate audit bolder clarify colorize critique delight distill harden layout optimize overdrive polish quieter shape typeset; do
  [ -f ".claude/skills/$skill/SKILL.md" ] && echo "OK: $skill" || echo "MISSING: $skill"
done
```

Expected: 17 lines of `OK: <skill>`. No `MISSING:` lines.

- [ ] **Step 3: Spot-check one skill has real content**

```bash
head -3 .claude/skills/audit/SKILL.md
```

Expected: YAML frontmatter with `name: audit` or similar, not an error page.

---

## Task 5: Create `.impeccable.md` design context file

**Files:**
- Create: `.impeccable.md`

- [ ] **Step 1: Write the design context file**

Create `.impeccable.md` at the project root with this exact content:

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

- [ ] **Step 2: Verify file exists and has content**

```bash
wc -l .impeccable.md
```

Expected: `36 .impeccable.md` (approximately — depends on trailing newline).

---

## Task 6: Add Impeccable Recommendations section to CLAUDE.md

**Files:**
- Modify: `CLAUDE.md` — append new section at the end

- [ ] **Step 1: Append the recommendations section to CLAUDE.md**

Open `CLAUDE.md` and append the following section at the very end of the file:

```markdown

## Impeccable UI Recommendations

After **every edit** to any file in `client/src/`, scan the change against the table below. For each matching signal, append an **"Impeccable Recommendations"** block to your response containing:

1. The slash command to run (e.g. `/audit`)
2. What the command does
3. Which specific part of the change it targets
4. What outcome to expect

When asked "what should I run here?" or similar, read the current state of `client/src/` files and return the same format for the most relevant signals.

### Command-to-Trigger Mapping

| Change Signal | Commands to Recommend |
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

### Recommendation Format Example

> **Impeccable Recommendations**
>
> **/audit** — Runs technical quality checks (accessibility, performance, responsive). Targets the new modal you just added: it will check focus trapping, ARIA roles, and keyboard dismissal. Expected outcome: a report of issues with specific fixes.
>
> **/critique** — UX design review of hierarchy, clarity, and emotional resonance. Targets the modal layout: it will assess whether the information hierarchy guides the user correctly. Expected outcome: design feedback with suggested improvements.
```

- [ ] **Step 2: Verify the section was added**

```bash
grep -n "Impeccable UI Recommendations" CLAUDE.md
```

Expected: one matching line with a line number.

---

## Task 7: Commit everything

- [ ] **Step 1: Stage all new and modified files**

```bash
git add .claude/skills/ .impeccable.md CLAUDE.md
```

- [ ] **Step 2: Verify staged files**

```bash
git status --short | grep "^A\|^M"
```

Expected: `A` entries for all new skill files, `M` entry for `CLAUDE.md`.

- [ ] **Step 3: Commit**

```bash
git commit -m "feat(ui): install impeccable skills and automated recommendation system"
```

Expected: commit succeeds, summary shows new files in `.claude/skills/`, `.impeccable.md`, and modified `CLAUDE.md`.
