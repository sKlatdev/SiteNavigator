import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const defaultDataDir = path.resolve(__dirname, "..", "data");
const packagedDataDir = process.pkg ? path.join(path.dirname(process.execPath), "data") : null;
const dataDir = path.resolve(process.env.SITENAVIGATOR_DATA_DIR || packagedDataDir || defaultDataDir);
const dbPath = path.join(dataDir, "clone-duo-drafts.json");

function ensureDraftStore() {
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  if (!fs.existsSync(dbPath)) {
    fs.writeFileSync(
      dbPath,
      JSON.stringify({ meta: { schemaVersion: 1, updatedAt: new Date().toISOString() }, drafts: [] }, null, 2),
      "utf8"
    );
  }
}

function readDraftStore() {
  ensureDraftStore();
  return JSON.parse(fs.readFileSync(dbPath, "utf8"));
}

function writeDraftStore(store) {
  const next = {
    ...store,
    meta: {
      ...(store.meta || {}),
      updatedAt: new Date().toISOString(),
    },
  };
  fs.writeFileSync(dbPath, JSON.stringify(next, null, 2), "utf8");
}

export function saveCloneDuoDraft(draft) {
  const store = readDraftStore();
  const drafts = Array.isArray(store.drafts) ? [...store.drafts] : [];
  const index = drafts.findIndex((entry) => entry?.draftId === draft?.draftId);
  if (index >= 0) {
    drafts[index] = draft;
  } else {
    drafts.unshift(draft);
  }
  writeDraftStore({ ...store, drafts });
  return draft;
}

export function getCloneDuoDraft(draftId) {
  const store = readDraftStore();
  return (store.drafts || []).find((entry) => entry?.draftId === draftId) || null;
}