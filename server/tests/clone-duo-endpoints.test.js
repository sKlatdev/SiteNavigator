import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const serverRoot = path.resolve(__dirname, "..");

function waitForServerReady(child, timeoutMs = 10000) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error("Timed out waiting for server to start"));
    }, timeoutMs);

    const onStdout = (buf) => {
      if (buf.toString().includes("SiteNavigator server running at")) {
        cleanup();
        resolve();
      }
    };

    const onStderr = (buf) => {
      const text = buf.toString();
      if (text.includes("EADDRINUSE") || text.toLowerCase().includes("error")) {
        cleanup();
        reject(new Error(`Server failed to start: ${text.trim()}`));
      }
    };

    const onExit = (code) => {
      cleanup();
      reject(new Error(`Server exited before ready (code ${code})`));
    };

    const cleanup = () => {
      clearTimeout(timeout);
      child.stdout?.off("data", onStdout);
      child.stderr?.off("data", onStderr);
      child.off("exit", onExit);
    };

    child.stdout?.on("data", onStdout);
    child.stderr?.on("data", onStderr);
    child.on("exit", onExit);
  });
}

test("/api/sync/status includes durationMs for the last completed run", async () => {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "sitenavigator-server-test-"));
  const dataDir = path.join(tmpRoot, "data");
  fs.mkdirSync(dataDir, { recursive: true });

  const startedAt = "2026-03-26T10:00:00.000Z";
  const finishedAt = "2026-03-26T10:00:12.250Z";
  fs.writeFileSync(
    path.join(dataDir, "index.json"),
    JSON.stringify({
      meta: { createdAt: startedAt, updatedAt: finishedAt, schemaVersion: 2 },
      content: [],
      fetchCache: {},
      syncRuns: [
        {
          id: "sync_1",
          startedAt,
          finishedAt,
          status: "success",
          scannedCount: 15,
          discoveredCount: 2,
          changedCount: 3,
          unchangedCount: 10,
          skippedNotModifiedCount: 0,
          errorCount: 0,
          message: "Sync completed",
        },
      ],
    }, null, 2),
    "utf8"
  );

  const port = 9200 + Math.floor(Math.random() * 200);
  const child = spawn(process.execPath, ["src/server.js"], {
    cwd: serverRoot,
    env: {
      ...process.env,
      PORT: String(port),
      SITENAVIGATOR_DATA_DIR: dataDir,
      CONTENT_CACHE_MAX_AGE: "0",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  try {
    await waitForServerReady(child);
    const res = await fetch(`http://127.0.0.1:${port}/api/sync/status`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.ok(["legacy", "ketch"].includes(body.engine));
    assert.equal(body.lastRun.durationMs, 12250);
  } finally {
    child.kill("SIGTERM");
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  }
});

test("DELETE /api/clone-duo/saml/review-draft/:draftId removes a saved draft", async () => {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "sitenavigator-server-test-"));
  const dataDir = path.join(tmpRoot, "data");
  fs.mkdirSync(dataDir, { recursive: true });

  const now = new Date().toISOString();
  fs.writeFileSync(
    path.join(dataDir, "index.json"),
    JSON.stringify({ meta: { createdAt: now, updatedAt: now, schemaVersion: 2 }, content: [], syncRuns: [], fetchCache: {} }, null, 2),
    "utf8"
  );
  fs.writeFileSync(
    path.join(dataDir, "clone-duo-drafts.json"),
    JSON.stringify({
      meta: { schemaVersion: 1, updatedAt: now },
      drafts: [
        {
          draftId: "draft_1",
          createdAt: now,
          updatedAt: now,
          fields: [],
          issues: [],
          sections: [],
          summary: { unresolvedFieldCount: 0, blockingIssueCount: 0, readyToExport: true },
        },
      ],
    }, null, 2),
    "utf8"
  );

  const port = 9450 + Math.floor(Math.random() * 200);
  const child = spawn(process.execPath, ["src/server.js"], {
    cwd: serverRoot,
    env: {
      ...process.env,
      PORT: String(port),
      SITENAVIGATOR_DATA_DIR: dataDir,
      CONTENT_CACHE_MAX_AGE: "0",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  try {
    await waitForServerReady(child);

    const delRes = await fetch(`http://127.0.0.1:${port}/api/clone-duo/saml/review-draft/draft_1`, {
      method: "DELETE",
    });
    assert.equal(delRes.status, 200);
    const delBody = await delRes.json();
    assert.equal(delBody.ok, true);

    const getRes = await fetch(`http://127.0.0.1:${port}/api/clone-duo/saml/review-draft/draft_1`);
    assert.equal(getRes.status, 404);
  } finally {
    child.kill("SIGTERM");
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  }
});