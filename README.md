# Duo-SiteNavigator

## Runtime and Dependency Policy

- Primary runtime: Node 22 LTS
- Secondary compatibility runtime: Node 24 LTS
- Supported range in package manifests: >=22 <25
- Stable dependencies only on the default branch (no beta prereleases)

See the implementation checklist in `docs/execution-checklist.md`.

## Portable Packaging

SiteNavigator is distributed as a portable Windows executable. End users do not need to install Node.js, npm, or any app dependencies.

`main` is the production branch. Every push to `main` runs the production release workflow, rebuilds and verifies the portable app, and updates the GitHub Latest Release.

### Build Artifacts

- `dist/sitenavigator-win.exe`: single self-contained Windows executable that launches without a visible terminal window.
- `dist/data/index.json`: base index data generated during portable smoke verification and published on GitHub as `sitenavigator-data.zip`.

### Build and Verify

From repository root:

```powershell
npm run build:portable:verify
```

This command builds the client and server, assembles the final single-file Windows executable, and smoke-tests the packaged app.

### GitHub Production Release

The production release workflow publishes these assets from `main` to the GitHub Latest Release:

- `sitenavigator-win.exe`
- `sitenavigator-data.zip`

The zip contains the `data` folder with the verified base index generated during the portable smoke test.

### Dependency Audit for Portable Runtime

Run this from repository root:

```powershell
npm run audit:portable:deps
```

This audit verifies runtime dependency trees for `client` and `server`, and flags dependency metadata that can imply non-self-contained runtime behavior (such as install scripts, native build markers, or external binary metadata).
