# Global Plan-Completion Reindex Workflow (No Hooks)

## Purpose
This document captures:
1. The current global-install + per-project-index model for GitNexus + jCodeMunch + jDocMunch + jDataMunch + claude-mem.
2. Your new requirement: a global agent/skill invocation that runs incremental reindex at plan completion, without lifecycle hooks.

## Current Baseline (Confirmed)

### Global installs (once per machine)
- `gitnexus` installed globally and registered in user-scope MCP.
- `jcodemunch-mcp` installed globally (Python tool install or pip), registered user-scope MCP.
- `jdocmunch-mcp` installed globally, registered user-scope MCP.
- `jdatamunch-mcp` installed globally, registered user-scope MCP.
- `claude-mem` installed globally for memory only.

### Per-project indexes (isolated)
- GitNexus: repo-local graph in `.gitnexus/` and global pointer registry in `~/.gitnexus/registry.json`.
- jCodeMunch: per-project code index under `~/.code-index/`.
- jDocMunch: per-project doc index under `~/.doc-index/`.
- jDataMunch: per-dataset local index under `~/.data-index/` via `index_local(...)`.
- claude-mem: global memory service with project-scoped retrieval context.

This gives all projects access to the same global toolchain while keeping index state separated by repo/dataset path.

## New Addition: No-Hook Plan Completion Reindex

## Design goal
Run incremental indexing only when explicitly requested at the end of a completed plan, not automatically via `PreToolUse`/`PostToolUse` hooks.

## Recommended implementation
Use a global custom agent (user profile scope) that can be invoked on demand from any repository.

Important constraint:
- User-level customizations support `.agent.md`, `.prompt.md`, `.instructions.md`.
- User-level `SKILL.md` is not supported.
- So the portable/global option is a custom agent or prompt, not a skill file.

## What the global agent should do
When invoked (example: `/complete-plan-reindex`), it should:
1. Confirm current repo root.
2. Run GitNexus incremental analyze for that repo.
3. Trigger jCodeMunch index refresh for code path.
4. Trigger jDocMunch index refresh for docs path(s).
5. Trigger jDataMunch index refresh for configured dataset files.
6. Return a compact status summary (success/fail, durations, skipped unchanged).

## Canonical indexing operations
Use these operations in the workflow:
- GitNexus: `gitnexus analyze [path]` (incremental by default).
- jCodeMunch: MCP index call for local code folder (`index_code_folder(path=...)`).
- jDocMunch: `index_local(path=...)` (CLI `index-local --path ...` also valid).
- jDataMunch: `index_local(path=..., name=...)` (incremental; skips unchanged files).

## Suggested invocation contract
Inputs:
- `repo_root` (required)
- `docs_paths` (optional list, default: `docs/`)
- `data_files` (optional list, explicit CSV/XLSX/Parquet/JSONL paths)
- `run_gitnexus` / `run_code` / `run_docs` / `run_data` (optional booleans)

Output:
- Machine-readable block:
  - `gitnexus: ok|failed|skipped`
  - `jcodemunch: ok|failed|skipped`
  - `jdocmunch: ok|failed|skipped`
  - `jdatamunch: ok|failed|skipped`
  - `notes: [...]`

## Global custom agent template (user scope)
Place in your user prompts folder as:
- `{{VSCODE_USER_PROMPTS_FOLDER}}/complete-plan-reindex.agent.md`

Template:

```md
---
name: complete-plan-reindex
description: Run post-plan incremental indexing for gitnexus + jcodemunch + jdocmunch + jdatamunch for the current repo without hooks.
model: GPT-5.3-Codex
---

You are a post-plan indexing agent.

When invoked:
1) Detect repository root from current workspace.
2) Run incremental GitNexus analyze at repo root.
3) Refresh jCodeMunch code index for repo root.
4) Refresh jDocMunch for docs paths (default docs/ if present).
5) Refresh jDataMunch for any configured dataset files.
6) Return concise status table and any failures with exact command/tool that failed.

Rules:
- No hooks.
- No destructive commands.
- Only reindex current workspace/repo unless explicitly told otherwise.
- If a path is missing, report skipped, do not fail whole run.
```

## Optional companion prompt (user scope)
Place as:
- `{{VSCODE_USER_PROMPTS_FOLDER}}/complete-plan-reindex.prompt.md`

```md
---
description: Invoke the global post-plan reindex agent for the current repository.
---

Run the `complete-plan-reindex` agent now.
Use defaults:
- docs_paths: ["docs/"]
- data_files: []
Return a final status summary only.
```

## Workflow usage in practice
At the end of implementation/planning sessions:
1. Finish plan and changes.
2. Invoke `/complete-plan-reindex`.
3. Review status output.
4. If all green, proceed to test/commit.

This makes reindexing explicit, auditable, and repeatable without hidden automations.

## Why this matches your requirement
- Global tool installs: yes.
- Project-specific indexes: yes.
- No hooks: yes.
- Triggered as plan-completion step: yes.
- Works across all projects with consistent behavior: yes.
