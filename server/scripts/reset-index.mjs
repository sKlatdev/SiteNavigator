import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const defaultDataDir = path.resolve(__dirname, "..", "data");
const dataDir = path.resolve(process.env.SITENAVIGATOR_DATA_DIR || defaultDataDir);
const dbPath = path.join(dataDir, "index.json");
const now = new Date().toISOString();

const emptyStore = {
  meta: {
    createdAt: now,
    updatedAt: now,
    schemaVersion: 2,
  },
  content: [],
  syncRuns: [],
  fetchCache: {},
};

fs.mkdirSync(dataDir, { recursive: true });
fs.writeFileSync(dbPath, JSON.stringify(emptyStore, null, 2), "utf8");

console.log(`Reset index at ${dbPath}`);
