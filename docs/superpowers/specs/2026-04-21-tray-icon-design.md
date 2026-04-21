# Tray Icon — Design Spec

**Date:** 2026-04-21  
**Status:** Approved  
**Scope:** `scripts/PortableLauncher.cs`, `scripts/build-single-exe-launcher.ps1`

---

## Goal

When `sitenavigator-win.exe` is running, a system tray icon appears so users can Open, Restart, or Quit the app without hunting for a console window or Task Manager.

---

## Architecture

The C# launcher (`PortableLauncher.cs`) is already compiled as `winexe` with `[STAThread]`, making it directly compatible with WinForms. No new processes, no npm dependencies, no extra asset files.

### Lifecycle change

**Before:** `Main()` blocks on `child.WaitForExit()` then returns.

**After:** `Main()` enters a WinForms message pump via `Application.Run()`. The tray icon lives for the full launcher lifetime.

```
Main()
  └─ Extract sitenavigator-core.exe + compute port
  └─ SpawnChild() → Process
  └─ child.EnableRaisingEvents = true
  └─ child.Exited += OnChildExited
  └─ CreateTrayIcon()  →  NotifyIcon + ContextMenuStrip
  └─ Application.Run()                    ← blocks here (message pump)
        │
        ├─ "Open SiteNavigator"  → Process.Start("http://localhost:{port}")
        ├─ "Restart"             → KillChild() → SpawnChild() → assign to job
        └─ "Quit"                → KillChild() → Application.Exit()

OnChildExited (unexpected exit):
  └─ NotifyIcon.ShowBalloonTip("SiteNavigator stopped unexpectedly")
  └─ Application.Exit()
```

### Job Object

The `SafeJobHandle` (`KILL_ON_JOB_CLOSE`) is held for the full launcher lifetime. On **Restart**, the old child is killed explicitly and the new child is assigned to the same job handle, preserving the kill-on-close guarantee.

---

## Components

### `SpawnChild()` (extracted helper)

Encapsulates the `ProcessStartInfo` setup and `Process.Start()` call currently inlined in `Main()`. Returns a `Process`. Called once at startup and again on each Restart.

### `KillChild(Process child)`

Calls `child.Kill()` + `child.WaitForExit(3000)`. Safe to call if the process has already exited.

A `_restarting` boolean flag is set to `true` before `KillChild()` is called during a Restart, and cleared after the new child is assigned. `OnChildExited` checks this flag and skips `Application.Exit()` when it is set, preventing the intentional kill from being treated as a crash.

### `CreateTrayIcon(int port)` → `NotifyIcon`

- **Icon:** 16×16 `Bitmap` drawn with GDI+: dark teal fill (`#1a6b6b`), white `"S"` glyph (bold, centered). Converted to `Icon` via `Icon.FromHandle(bitmap.GetHicon())`.
- **Tooltip:** `"SiteNavigator"`
- **Double-click:** triggers Open
- **Context menu:**
  ```
  Open SiteNavigator
  Restart
  ─────────────────
  Quit
  ```

### Port detection

Mirrors the Node server rule exactly:
```csharp
string portEnv = Environment.GetEnvironmentVariable("PORT");
int port = int.TryParse(portEnv, out int p) && p > 0 ? p : 8787;
```

---

## Build changes

`build-single-exe-launcher.ps1` — add two `/reference` flags to the `csc` call:

```powershell
& $csc /nologo /target:winexe /optimize+ `
    /reference:System.Windows.Forms.dll `
    /reference:System.Drawing.dll `
    "/out:$finalExe" `
    "/resource:$coreExe,SiteNavigator.Core.exe" `
    $launcherSource
```

Both assemblies ship with every .NET Framework 4.x installation on Windows.

---

## Files changed

| File | Change |
|------|--------|
| `scripts/PortableLauncher.cs` | Replace blocking `WaitForExit` with message pump; add `NotifyIcon`, `SpawnChild`, `KillChild`, `CreateTrayIcon` |
| `scripts/build-single-exe-launcher.ps1` | Add `/reference:System.Windows.Forms.dll /reference:System.Drawing.dll` |

No new files. No new npm/NuGet dependencies.

---

## Out of scope

- Sync Now / status display in tray menu
- Custom `.ico` asset (icon is drawn programmatically)
- macOS / Linux tray support (portable build is Windows-only)
