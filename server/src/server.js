import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import { runIncrementalSync, getSyncProgress } from "./crawler.js";
import { readStore, writeStore, listActiveContent, getLastSyncRun } from "./store.js";

const app = express();
const PORT = 8787;

app.use(cors());
app.use(express.json({ limit: "25mb" }));

let inProgress = false;

function clampRecentDays(v) {
  return Math.max(1, Math.min(30, Number(v || 14)));
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
  const store = readStore();
  const rows = listActiveContent(store);

  const now = Date.now();
  const items = rows.map((r) => {
    let recentlyUpdated = false;
    if (r.pageLastUpdated) {
      const d = new Date(r.pageLastUpdated).getTime();
      if (!Number.isNaN(d)) {
        const days = Math.floor((now - d) / (1000 * 60 * 60 * 24));
        recentlyUpdated = days <= recentDays;
      }
    }

    return {
      id: r.id,
      url: r.url,
      title: r.title,
      category: r.category || "other",
      pathSummary: r.pathSummary || "",
      summary: r.summary,
      pageLastUpdated: r.pageLastUpdated,
      contentHash: r.contentHash,
      updatedAt: r.updatedAt,
      recentlyUpdated
    };
  });

  const counts = {
    blog: items.filter((i) => i.category === "blog").length,
    docs: items.filter((i) => i.category === "docs").length,
    guides: items.filter((i) => i.category === "guides").length,
    resources: items.filter((i) => i.category === "resources").length,
    help_kb: items.filter((i) => i.category === "help_kb").length,
    demos: items.filter((i) => i.category === "demos").length,
    other: items.filter((i) => i.category === "other").length
  };

  res.json({
    ok: true,
    recentDays,
    count: items.length,
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

  try {
    const abs = path.resolve(filePath);
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

app.listen(PORT, () => {
  console.log(`SiteNavigator server (Node 25 optimized) running at http://localhost:${PORT}`);
});