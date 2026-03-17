# Phase Checkpoint Commit Workflow

Use the helper below to create a checkpoint commit whenever a todo list or phase is completed.

## Command

Run from repository root:

```powershell
pwsh ./scripts/commit-phase.ps1 -Phase "P2 complete"
```

Optional validation before commit:

```powershell
pwsh ./scripts/commit-phase.ps1 -Phase "P2 complete" -RunChecks
```

## Commit Message Format

The helper uses this pattern:

- `chore(phase): <phase> checkpoint`

If `docs/execution-checklist.md` exists, it appends completed todo count:

- `chore(phase): <phase> checkpoint (<n> todos complete)`

## Recommended Usage

1. Finish one todo group or phase.
2. Run the phase helper command.
3. Push the checkpoint commit.
4. Continue with the next phase.
