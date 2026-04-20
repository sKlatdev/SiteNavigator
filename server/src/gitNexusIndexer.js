import { execFile } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const gitnexusBin = String(process.env.SITENAVIGATOR_GITNEXUS_BIN || "gitnexus").trim();

const indexProgress = {
  inProgress: false,
  phase: "idle",
  message: "",
  startedAt: null,
  finishedAt: null,
};

export function isIndexed(docsDir) {
  return fs.existsSync(path.join(docsDir, ".gitnexus"));
}

export function getIndexProgress() {
  return { ...indexProgress };
}

export async function analyzeAfterSync(docsDir) {
  if (indexProgress.inProgress) return;

  Object.assign(indexProgress, {
    inProgress: true,
    phase: "analyzing",
    message: "Building search index…",
    startedAt: new Date().toISOString(),
    finishedAt: null,
  });

  const args = ["analyze", docsDir, "--name", "sitenavigator-docs", "--skip-git"];

  return new Promise((resolve) => {
    const proc = execFile(gitnexusBin, args);

    proc.on("error", (err) => {
      Object.assign(indexProgress, {
        inProgress: false,
        phase: "error",
        message: `gitnexus not available: ${err.message}`,
        finishedAt: new Date().toISOString(),
      });
      resolve({ ok: false, error: err.message });
    });

    proc.on("exit", (code) => {
      const ok = code === 0;
      Object.assign(indexProgress, {
        inProgress: false,
        phase: ok ? "done" : "error",
        message: ok ? "Search index ready." : `gitnexus analyze exited with code ${code}`,
        finishedAt: new Date().toISOString(),
      });
      resolve({ ok, code });
    });
  });
}
