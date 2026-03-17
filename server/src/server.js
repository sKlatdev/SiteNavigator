import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { runIncrementalSync, getSyncProgress } from "./crawler.js";
import { readStore, writeStore, listActiveContent, getLastSyncRun } from "./store.js";
import { computeRecentSignals } from "./recency.js";

const app = express();
const cliPortArg = (() => {
  const eqArg = process.argv.find((arg) => /^--port=\d+$/i.test(String(arg || "")));
  if (eqArg) return Number(String(eqArg).split("=")[1]);

  const idx = process.argv.findIndex((arg) => String(arg) === "--port");
  if (idx >= 0 && process.argv[idx + 1]) return Number(process.argv[idx + 1]);

  return Number.NaN;
})();
const PORT = Number.isFinite(cliPortArg) && cliPortArg > 0 ? cliPortArg : Number(process.env.PORT || 8787);
const PORT_RETRY_COUNT = Math.max(1, Number(process.env.PORT_RETRY_COUNT || 5));
const IS_PROD = process.env.NODE_ENV === "production";
const ENABLE_PATH_IMPORT = process.env.ENABLE_PATH_IMPORT === "true";
const ENABLE_INDEX_PATH_IO = process.env.ENABLE_INDEX_PATH_IO !== "false";
const SLOW_ROUTE_MS = Math.max(50, Number(process.env.SLOW_ROUTE_MS || 700));
const CONTENT_CACHE_MAX_AGE = Math.max(0, Number(process.env.CONTENT_CACHE_MAX_AGE || 15));
const allowedOrigins = (process.env.ALLOWED_ORIGINS || "http://localhost:5173,http://127.0.0.1:5173")
  .split(",")
  .map((x) => x.trim())
  .filter(Boolean);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const defaultDataDir = path.resolve(__dirname, "..", "data");
const dataDir = path.resolve(process.env.SITENAVIGATOR_DATA_DIR || defaultDataDir);
const dbPath = path.join(dataDir, "index.json");

app.use(
  cors({
    origin(origin, cb) {
      if (!origin) return cb(null, true);
      if (!IS_PROD && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin)) {
        return cb(null, true);
      }
      if (allowedOrigins.includes(origin)) return cb(null, true);
      return cb(new Error("CORS origin denied"));
    }
  })
);
app.use(express.json({ limit: "25mb" }));
app.use((req, res, next) => {
  const started = process.hrtime.bigint();
  res.on("finish", () => {
    const elapsedMs = Number(process.hrtime.bigint() - started) / 1e6;
    if (elapsedMs >= SLOW_ROUTE_MS) {
      console.warn(
        `[slow-route] ${req.method} ${req.originalUrl} -> ${res.statusCode} in ${elapsedMs.toFixed(1)}ms`
      );
    }
  });
  next();
});

let inProgress = false;

function clampRecentDays(v) {
  return Math.max(1, Math.min(30, Number(v || 14)));
}

function clampPage(v) {
  return Math.max(1, Number(v || 1));
}

function clampPageSize(v) {
  const raw = Number(v || 0);
  if (!raw || raw < 0) return 0;
  return Math.max(1, Math.min(500, raw));
}

function deriveCategory(row) {
  const currentCategory = String(row?.category || "other").trim().toLowerCase() || "other";
  if (currentCategory === "release_notes") return "release_notes";

  try {
    const title = String(row?.title || "").toLowerCase();
    const urlObj = new URL(String(row?.url || ""));
    const host = urlObj.hostname.toLowerCase();
    const pathname = urlObj.pathname.toLowerCase();
    const isDuoDocsPath = (host === "duo.com" || host.endsWith(".duo.com")) && pathname.startsWith("/docs");
    const looksLikeReleaseNotes =
      title.includes("release notes") || /\/docs\/(?:[^/?#]+-notes)(?:\/|$)/.test(pathname);

    if (isDuoDocsPath && looksLikeReleaseNotes) {
      return "release_notes";
    }
  } catch {
    // Fall through to persisted category on URL parsing issues.
  }

  return currentCategory;
}

function deriveVendor(row) {
  const currentVendor = String(row?.vendor || "").trim();
  if (currentVendor) return currentVendor;

  try {
    const urlObj = new URL(String(row?.url || ""));
    const host = urlObj.hostname.toLowerCase();
    if (host === "help.okta.com" || host.endsWith(".help.okta.com")) return "Okta";
    if (host === "docs.pingidentity.com" || host.endsWith(".docs.pingidentity.com")) return "Ping Identity";
    if ((host === "learn.microsoft.com" || host.endsWith(".learn.microsoft.com")) && /^\/(?:[a-z]{2}-[a-z]{2}\/)?entra\/identity\/saas-apps(?:\/|$)/i.test(urlObj.pathname.toLowerCase())) return "Entra";
  } catch {
    // Fall through to default vendor when URL parsing fails.
  }

  return "Duo";
}

function deriveTags(row, vendor) {
  const incoming = Array.isArray(row?.tags) ? row.tags : [];
  const normalized = incoming
    .map((x) => String(x || "").trim())
    .filter(Boolean);
  const tags = new Set(normalized);
  tags.add(vendor);

  try {
    const urlObj = new URL(String(row?.url || ""));
    const path = urlObj.pathname.toLowerCase();
    if (vendor === "Okta" && (path === "/wf" || path.startsWith("/wf/"))) {
      tags.add("Workflow");
    }
  } catch {
    // Keep derived tags resilient to malformed URLs.
  }

  return Array.from(tags);
}

function isLocalRequest(req) {
  const ip = req.ip || req.socket?.remoteAddress || "";
  return ip === "127.0.0.1" || ip === "::1" || ip === "::ffff:127.0.0.1";
}

function isSafeJsonPath(absPath) {
  if (path.extname(absPath).toLowerCase() !== ".json") return false;
  const rel = path.relative(dataDir, absPath);
  return rel && !rel.startsWith("..") && !path.isAbsolute(rel);
}

function resolveJsonPath(inputPath) {
  const candidate = String(inputPath || "").trim();
  if (!candidate) return null;
  const abs = path.resolve(candidate);
  if (path.extname(abs).toLowerCase() !== ".json") return null;
  return abs;
}

function formatPathInfo(absPath) {
  const exists = fs.existsSync(absPath);
  const sizeBytes = exists ? fs.statSync(absPath).size : 0;
  return {
    filePath: absPath,
    exists,
    sizeBytes,
    sizeMB: Number((sizeBytes / (1024 * 1024)).toFixed(2)),
  };
}

function mergeStores(current, payload) {
  const next = {
    ...current,
    meta: { ...(current.meta || {}), ...(payload.meta || {}) },
    syncRuns: [...(current.syncRuns || []), ...(payload.syncRuns || [])],
    fetchCache: { ...(current.fetchCache || {}), ...(payload.fetchCache || {}) },
    content: []
  };

  const byUrl = new Map();
  [...(current.content || []), ...(payload.content || [])].forEach((item) => {
    if (!item?.url) return;
    const prev = byUrl.get(item.url);
    if (!prev) {
      byUrl.set(item.url, item);
      return;
    }
    const prevTs = new Date(prev.updatedAt || 0).getTime();
    const curTs = new Date(item.updatedAt || 0).getTime();
    byUrl.set(item.url, curTs >= prevTs ? item : prev);
  });

  next.content = Array.from(byUrl.values());
  return next;
}

function importIndexPayload(mode, payload) {
  if (!payload || typeof payload !== "object") {
    return { ok: false, code: 400, message: "Invalid payload" };
  }

  if (mode === "replace") {
    writeStore(payload);
    return {
      ok: true,
      mode,
      message: "Index replaced",
      contentCount: (payload.content || []).length
    };
  }

  const current = readStore();
  const merged = mergeStores(current, payload);
  writeStore(merged);

  return {
    ok: true,
    mode: "merge",
    message: "Index merged",
    contentCount: merged.content.length
  };
}

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "sitenavigator-server-node25" });
});

app.get("/api/sync/status", (_req, res) => {
  const store = readStore();
  res.json({
    inProgress,
    lastRun: getLastSyncRun(store)
  });
});

app.get("/api/sync/progress", (_req, res) => {
  res.json({
    ok: true,
    progress: getSyncProgress()
  });
});

app.post("/api/sync", async (_req, res) => {
  if (inProgress) {
    return res.status(409).json({ ok: false, message: "Sync already in progress" });
  }

  try {
    inProgress = true;
    const result = await runIncrementalSync();
    res.json({ ok: true, result });
  } catch (e) {
    res.status(500).json({ ok: false, message: e?.message || "Sync failed" });
  } finally {
    inProgress = false;
  }
});

app.get("/api/content", (req, res) => {
  const recentDays = clampRecentDays(req.query.recentDays);
  const page = clampPage(req.query.page);
  const pageSize = clampPageSize(req.query.pageSize);
  const q = String(req.query.q || "").trim().toLowerCase();
  const category = String(req.query.category || "").trim().toLowerCase();
  const store = readStore();
  let rows = listActiveContent(store);

  if (q) {
    rows = rows.filter((r) =>
      [r.title, r.summary, r.pathSummary, r.url, r.category, r.vendor, ...(Array.isArray(r.tags) ? r.tags : [])]
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }

  let categorizedRows = rows.map((r) => ({ row: r, category: deriveCategory(r) }));

  const counts = {
    blog: categorizedRows.filter((r) => r.category === "blog").length,
    docs: categorizedRows.filter((r) => r.category === "docs").length,
    release_notes: categorizedRows.filter((r) => r.category === "release_notes").length,
    guides: categorizedRows.filter((r) => r.category === "guides").length,
    resources: categorizedRows.filter((r) => r.category === "resources").length,
    help_kb: categorizedRows.filter((r) => r.category === "help_kb").length,
    demos: categorizedRows.filter((r) => r.category === "demos").length,
    competitor_docs: categorizedRows.filter((r) => r.category === "competitor_docs").length,
    other: categorizedRows.filter((r) => r.category === "other").length
  };

  if (category) {
    categorizedRows = categorizedRows.filter((r) => r.category === category);
  }

  const nowTs = Date.now();
  const filteredItems = categorizedRows.map(({ row: r, category: derivedCategory }) => {
    const recent = computeRecentSignals(r, recentDays, nowTs);
    const vendor = deriveVendor(r);
    const tags = deriveTags(r, vendor);

    return {
      id: r.id,
      url: r.url,
      title: r.title,
      category: derivedCategory,
      vendor,
      tags,
      pathSummary: r.pathSummary || "",
      summary: r.summary,
      pageLastUpdated: r.pageLastUpdated,
      contentHash: r.contentHash,
      firstSeenAt: r.firstSeenAt,
      updatedAt: r.updatedAt,
      recentlyUpdated: recent.recentlyUpdated,
      recentReason: recent.recentReason
    };
  });

  const totalItems = filteredItems.length;
  const signals = {
    newlyDiscovered: filteredItems.filter((item) => item.recentReason === "new_page").length,
    recentlyUpdated: filteredItems.filter((item) => item.recentlyUpdated && item.recentReason !== "new_page").length
  };
  const totalPages = pageSize > 0 ? Math.max(1, Math.ceil(totalItems / pageSize)) : 1;
  const pageSafe = Math.min(page, totalPages);
  const offset = pageSize > 0 ? (pageSafe - 1) * pageSize : 0;
  const items = pageSize > 0 ? filteredItems.slice(offset, offset + pageSize) : filteredItems;

  const etagSeed = [
    store.meta?.updatedAt || "",
    recentDays,
    q,
    category,
    pageSafe,
    pageSize,
    totalItems
  ].join("|");
  const etag = `W/"${Buffer.from(etagSeed).toString("base64")}"`;

  if (req.headers["if-none-match"] === etag) {
    return res.status(304).end();
  }

  res.setHeader("Cache-Control", `public, max-age=${CONTENT_CACHE_MAX_AGE}, must-revalidate`);
  res.setHeader("ETag", etag);
  if (store.meta?.updatedAt) {
    res.setHeader("Last-Modified", new Date(store.meta.updatedAt).toUTCString());
  }

  res.json({
    ok: true,
    recentDays,
    count: totalItems,
    returnedCount: items.length,
    page: pageSafe,
    pageSize,
    totalPages,
    hasNextPage: pageSafe < totalPages,
    hasPrevPage: pageSafe > 1,
    filters: {
      q,
      category
    },
    signals,
    counts,
    items
  });
});

app.get("/api/index/export", (_req, res) => {
  const store = readStore();
  res.json({
    ok: true,
    exportedAt: new Date().toISOString(),
    schema: "sitenavigator-index-v1",
    data: store
  });
});

app.post("/api/index/import", (req, res) => {
  const { mode = "replace", payload } = req.body || {};
  const result = importIndexPayload(mode, payload);
  if (!result.ok) return res.status(result.code || 400).json(result);
  return res.json(result);
});

app.post("/api/index/import-from-path", (req, res) => {
  const { filePath, mode = "replace" } = req.body || {};
  if (!filePath) return res.status(400).json({ ok: false, message: "filePath required" });

  if (!ENABLE_PATH_IMPORT && (IS_PROD || !isLocalRequest(req))) {
    return res.status(403).json({ ok: false, message: "Path import disabled" });
  }

  try {
    const abs = path.resolve(filePath);
    if (!isSafeJsonPath(abs)) {
      return res.status(400).json({ ok: false, message: "Only JSON files under server/data are allowed" });
    }
    if (!fs.existsSync(abs)) {
      return res.status(404).json({ ok: false, message: "File not found" });
    }

    const raw = fs.readFileSync(abs, "utf8");
    const parsed = JSON.parse(raw);
    const payload = parsed?.data || parsed;

    const result = importIndexPayload(mode, payload);
    if (!result.ok) return res.status(result.code || 400).json(result);

    return res.json({
      ...result,
      source: abs
    });
  } catch (e) {
    return res.status(500).json({ ok: false, message: e?.message || "Import failed" });
  }
});

function startServerWithRetry(startPort, retriesRemaining) {
  const server = app.listen(startPort, () => {
    console.log(`SiteNavigator server running at http://localhost:${startPort}`);
  });

  server.on("error", (err) => {
    if (err?.code === "EADDRINUSE" && retriesRemaining > 1) {
      const nextPort = startPort + 1;
      console.warn(`[startup] Port ${startPort} is already in use. Retrying on ${nextPort}...`);
      startServerWithRetry(nextPort, retriesRemaining - 1);
      return;
    }

    if (err?.code === "EADDRINUSE") {
      console.error(
        `[startup] Failed to bind any port starting at ${PORT}. Set PORT or free the port and retry.`
      );
    } else {
      console.error(`[startup] Server failed to start: ${err?.message || "Unknown error"}`);
    }
    process.exit(1);
  });
}

app.get("/api/index/path-info", (req, res) => {
  if (!ENABLE_INDEX_PATH_IO || (IS_PROD && !isLocalRequest(req))) {
    return res.status(403).json({ ok: false, message: "Index path operations disabled" });
  }

  const requested = String(req.query.filePath || "").trim();
  const resolved = requested ? resolveJsonPath(requested) : dbPath;
  if (!resolved) {
    return res.status(400).json({ ok: false, message: "A valid JSON file path is required" });
  }

  return res.json({
    ok: true,
    currentIndexPath: dbPath,
    ...formatPathInfo(resolved),
  });
});

app.post("/api/index/save-to-path", (req, res) => {
  if (!ENABLE_INDEX_PATH_IO || (IS_PROD && !isLocalRequest(req))) {
    return res.status(403).json({ ok: false, message: "Index path operations disabled" });
  }

  const resolved = resolveJsonPath(req.body?.filePath);
  if (!resolved) {
    return res.status(400).json({ ok: false, message: "A valid JSON file path is required" });
  }

  try {
    const store = readStore();
    fs.mkdirSync(path.dirname(resolved), { recursive: true });
    fs.writeFileSync(
      resolved,
      JSON.stringify(
        {
          ok: true,
          exportedAt: new Date().toISOString(),
          schema: "sitenavigator-index-v1",
          data: store,
        },
        null,
        2
      ),
      "utf8"
    );

    return res.json({
      ok: true,
      message: "Index saved",
      ...formatPathInfo(resolved),
    });
  } catch (e) {
    return res.status(500).json({ ok: false, message: e?.message || "Failed to save index" });
  }
});

app.post("/api/index/load-from-path", (req, res) => {
  if (!ENABLE_INDEX_PATH_IO || (IS_PROD && !isLocalRequest(req))) {
    return res.status(403).json({ ok: false, message: "Index path operations disabled" });
  }

  const resolved = resolveJsonPath(req.body?.filePath);
  const mode = req.body?.mode || "replace";
  if (!resolved) {
    return res.status(400).json({ ok: false, message: "A valid JSON file path is required" });
  }

  try {
    if (!fs.existsSync(resolved)) {
      return res.status(404).json({ ok: false, message: "File not found" });
    }

    const parsed = JSON.parse(fs.readFileSync(resolved, "utf8"));
    const payload = parsed?.data || parsed;
    const result = importIndexPayload(mode, payload);
    if (!result.ok) return res.status(result.code || 400).json(result);

    return res.json({
      ...result,
      source: resolved,
      ...formatPathInfo(resolved),
    });
  } catch (e) {
    return res.status(500).json({ ok: false, message: e?.message || "Failed to load index" });
  }
});

startServerWithRetry(PORT, PORT_RETRY_COUNT);