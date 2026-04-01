import fs from "fs";
import path from "path";
import { spawnSync } from "child_process";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const serverRoot = path.resolve(__dirname, "..");
const repoRoot = path.resolve(serverRoot, "..");
const outputDir = path.join(serverRoot, "vendor", "ketch");
const exeName = process.platform === "win32" ? "ketch.exe" : "ketch";
const outputPath = path.join(outputDir, exeName);

const configuredSource = String(process.env.SITENAVIGATOR_KETCH_SOURCE || "").trim();
const sourceCandidates = [
  configuredSource,
  path.resolve(repoRoot, "..", "..", "Ketch"),
].filter(Boolean);

const ketchSource = sourceCandidates.find((candidate) => fs.existsSync(path.join(candidate, "go.mod")));

if (!ketchSource) {
  throw new Error(
    `Ketch source repo not found. Set SITENAVIGATOR_KETCH_SOURCE or place the repo at ${path.resolve(repoRoot, "..", "..", "Ketch")}`
  );
}

fs.mkdirSync(outputDir, { recursive: true });

const result = spawnSync("go", ["build", "-o", outputPath, "."], {
  cwd: ketchSource,
  stdio: "inherit",
  env: process.env,
});

if (result.status !== 0) {
  throw new Error(`Failed to build Ketch binary (exit ${result.status ?? 1})`);
}

console.log(`Built bundled Ketch binary at ${outputPath}`);