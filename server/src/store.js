import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const defaultDataDir = path.resolve(__dirname, "..", "data");
const dataDir = path.resolve(process.env.SITENAVIGATOR_DATA_DIR || defaultDataDir);
const dbPath = path.join(dataDir, "index.json");

function nowIso() {
  return new Date().toISOString();
}

function ensureStore() {
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

  if (!fs.existsSync(dbPath)) {
    const initial = {
      meta: {
        createdAt: nowIso(),
        updatedAt: nowIso(),
        schemaVersion: 2
      },
      content: [],
      syncRuns: [],
      fetchCache: {} // url -> { etag, lastModified, lastSeenAt, lastStatus }
    };
    fs.writeFileSync(dbPath, JSON.stringify(initial, null, 2), "utf8");
  }
}

function readStore() {
  ensureStore();
  const raw = fs.readFileSync(dbPath, "utf8");
  return JSON.parse(raw);
}

function writeStore(store) {
  store.meta = store.meta || {};
  store.meta.updatedAt = nowIso();
  fs.writeFileSync(dbPath, JSON.stringify(store, null, 2), "utf8");
}

function getByUrl(store, url) {
  return store.content.find((x) => x.url === url) || null;
}

function upsertContent(store, row) {
  const idx = store.content.findIndex((x) => x.url === row.url);
  if (idx === -1) {
    store.content.push(row);
  } else {
    store.content[idx] = { ...store.content[idx], ...row };
  }
}

function listActiveContent(store) {
  return store.content
    .filter((x) => x.active)
    .sort((a, b) => {
      const da = new Date(a.pageLastUpdated || a.updatedAt).getTime();
      const db = new Date(b.pageLastUpdated || b.updatedAt).getTime();
      return db - da;
    });
}

function addSyncRun(store, run) {
  store.syncRuns.push(run);
}

function updateSyncRun(store, runId, patch) {
  const idx = store.syncRuns.findIndex((r) => r.id === runId);
  if (idx >= 0) {
    store.syncRuns[idx] = { ...store.syncRuns[idx], ...patch };
  }
}

function getLastSyncRun(store) {
  if (!store.syncRuns.length) return null;
  return [...store.syncRuns].sort((a, b) => new Date(b.startedAt) - new Date(a.startedAt))[0];
}

export {
  nowIso,
  readStore,
  writeStore,
  getByUrl,
  upsertContent,
  listActiveContent,
  addSyncRun,
  updateSyncRun,
  getLastSyncRun
};