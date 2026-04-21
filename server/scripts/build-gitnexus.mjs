#!/usr/bin/env node
/**
 * Downloads gitnexus from npm, pkg-packages it as a standalone Windows exe,
 * and places it in server/vendor/gitnexus/gitnexus.exe for bundling into
 * the sitenavigator portable build.
 *
 * Native addons (onnxruntime-node, tree-sitter parsers) are listed as pkg
 * assets so they get extracted to a temp dir at runtime.
 */
import { execSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const serverRoot = path.resolve(__dirname, "..");
const outputDir = path.join(serverRoot, "vendor", "gitnexus");
const outputExe = path.join(outputDir, "gitnexus.exe");
const workDir = path.join(serverRoot, "build", "gitnexus-build");

// Read the gitnexus version from the server's package.json if pinned,
// otherwise use the installed version from node_modules (if present).
function resolveGitnexusVersion() {
  const serverPkg = JSON.parse(fs.readFileSync(path.join(serverRoot, "package.json"), "utf-8"));
  return (
    serverPkg.dependencies?.gitnexus ||
    serverPkg.devDependencies?.gitnexus ||
    "latest"
  );
}

// Collect all .node native addon files under a directory (relative paths).
function findNodeFiles(dir, base = dir) {
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...findNodeFiles(full, base));
    } else if (entry.isFile() && entry.name.endsWith(".node")) {
      results.push(path.relative(base, full).replaceAll("\\", "/"));
    }
  }
  return results;
}

// ── 1. Prepare build directory ─────────────────────────────────────
console.log("[build-gitnexus] Setting up build workspace…");
fs.rmSync(workDir, { recursive: true, force: true });
fs.mkdirSync(workDir, { recursive: true });
fs.mkdirSync(outputDir, { recursive: true });

const version = resolveGitnexusVersion();
console.log(`[build-gitnexus] Installing gitnexus@${version}…`);

// Minimal package.json for the install workspace
fs.writeFileSync(
  path.join(workDir, "package.json"),
  JSON.stringify({ name: "gitnexus-build", version: "0.0.1", private: true }, null, 2)
);

execSync(`npm install gitnexus@${version} --no-save --prefer-offline`, {
  cwd: workDir,
  stdio: "inherit",
});

// ── 2. Find the gitnexus entry point ──────────────────────────────
const gitnexusPkg = JSON.parse(
  fs.readFileSync(path.join(workDir, "node_modules", "gitnexus", "package.json"), "utf-8")
);
const binEntry = gitnexusPkg.bin?.gitnexus;
if (!binEntry) throw new Error("gitnexus package has no bin.gitnexus entry");
const entryPoint = path.join(workDir, "node_modules", "gitnexus", binEntry);

// ── 3. Collect native addon paths for pkg assets ──────────────────
console.log("[build-gitnexus] Scanning for native addons…");
const nodeModulesDir = path.join(workDir, "node_modules");
const nativeFiles = findNodeFiles(nodeModulesDir, workDir);
console.log(`[build-gitnexus] Found ${nativeFiles.length} native addon(s).`);

// ── 4. Build pkg config ───────────────────────────────────────────
const pkgConfig = {
  pkg: {
    scripts: [entryPoint.replaceAll("\\", "/")],
    assets: [
      "node_modules/gitnexus/dist/**/*",
      "node_modules/gitnexus/node_modules/**/*",
      ...nativeFiles,
    ],
    targets: ["node22-win-x64"],
  },
};

const buildPkgPath = path.join(workDir, "package.json");
const existing = JSON.parse(fs.readFileSync(buildPkgPath, "utf-8"));
fs.writeFileSync(buildPkgPath, JSON.stringify({ ...existing, ...pkgConfig }, null, 2));

// ── 5. Run pkg ────────────────────────────────────────────────────
console.log("[build-gitnexus] Running pkg…");
const result = spawnSync(
  "npx",
  [
    "@yao-pkg/pkg",
    entryPoint,
    "--compress", "GZip",
    "--target", "node22-win-x64",
    "--output", outputExe,
    "--config", buildPkgPath,
  ],
  { cwd: workDir, stdio: "inherit", shell: true }
);

if (result.status !== 0) {
  throw new Error(`pkg failed with exit code ${result.status ?? 1}`);
}

console.log(`[build-gitnexus] Built gitnexus binary at ${outputExe}`);
