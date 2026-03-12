import crypto from "crypto";
import * as cheerio from "cheerio";
import {
  nowIso,
  readStore,
  writeStore,
  getByUrl,
  upsertContent,
  addSyncRun,
  updateSyncRun
} from "./store.js";

/**
 * Optimized crawler:
 * - category-aware host/path rules
 * - concurrency worker pool
 * - conditional GET (ETag/Last-Modified)
 * - deterministic URL normalization
 */

const START_POINTS = [
  "https://duo.com",
  "https://duo.com/blog",
  "https://duo.com/docs",
  "https://guide.duo.com",
  "https://resources.duo.com",
  "https://help.duo.com",
  "https://demo.duo.com"
];

const ALLOWED_HOSTS = [
  "duo.com",
  "guide.duo.com",
  "resources.duo.com",
  "help.duo.com",
  "demo.duo.com"
];

const MAX_DEPTH_DEFAULT = 3;
const MAX_DEPTH_BY_HOST = {
  "help.duo.com": 4
};

const CONCURRENCY = 8;
const REQUEST_TIMEOUT_MS = 15000;

const syncProgress = {
  inProgress: false,
  runId: null,
  startedAt: null,
  finishedAt: null,
  processed: 0,
  queued: 0,
  scannedCount: 0,
  discoveredCount: 0,
  changedCount: 0,
  unchangedCount: 0,
  skippedNotModifiedCount: 0,
  errorCount: 0,
  currentUrl: null,
  currentDepth: 0,
  percent: 0
};

export function getSyncProgress() {
  return { ...syncProgress };
}

function safeUrl(input, base) {
  try {
    return new URL(input, base);
  } catch {
    return null;
  }
}

function hostAllowed(hostname) {
  return ALLOWED_HOSTS.some((h) => hostname === h || hostname.endsWith(`.${h}`));
}

function maxDepthForHost(hostname) {
  const key = Object.keys(MAX_DEPTH_BY_HOST).find((h) => hostname === h || hostname.endsWith(`.${h}`));
  return key ? MAX_DEPTH_BY_HOST[key] : MAX_DEPTH_DEFAULT;
}

function isAllowedUrl(urlObj) {
  if (!urlObj) return false;
  if (!["http:", "https:"].includes(urlObj.protocol)) return false;
  if (!hostAllowed(urlObj.hostname)) return false;

  const p = (urlObj.pathname || "").toLowerCase();
  if (
    p.endsWith(".png") || p.endsWith(".jpg") || p.endsWith(".jpeg") ||
    p.endsWith(".gif") || p.endsWith(".svg") || p.endsWith(".pdf") ||
    p.endsWith(".zip") || p.endsWith(".ico")
  ) return false;

  if (p.startsWith("/cdn-cgi/")) return false;
  return true;
}

function normalizeUrl(urlObj) {
  const u = new URL(urlObj.toString());
  u.hash = "";

  const keep = new URLSearchParams();
  for (const [k, v] of u.searchParams.entries()) {
    if (!k.toLowerCase().startsWith("utm_")) keep.append(k, v);
  }
  u.search = keep.toString() ? `?${keep.toString()}` : "";

  if (u.pathname !== "/" && u.pathname.endsWith("/")) u.pathname = u.pathname.slice(0, -1);
  return u.toString();
}

function categorize(urlStr) {
  const u = new URL(urlStr);
  const host = u.hostname.toLowerCase();
  const path = u.pathname.toLowerCase();

  if (host === "resources.duo.com" || host.endsWith(".resources.duo.com")) return "resources";
  if (host === "guide.duo.com" || host.endsWith(".guide.duo.com")) return "guides";
  if (host === "help.duo.com" || host.endsWith(".help.duo.com")) return "help_kb";
  if (host === "demo.duo.com" || host.endsWith(".demo.duo.com")) return "demos";

  if (host === "duo.com" || host.endsWith(".duo.com")) {
    if (path.startsWith("/blog")) return "blog";
    if (path.startsWith("/docs")) return "docs";
  }

  return "other";
}

function buildPathSummary(urlStr) {
  try {
    const u = new URL(urlStr);
    const segs = u.pathname.split("/").filter(Boolean).slice(0, 3);
    const path = segs.length ? `/${segs.join("/")}` : "/";
    return `${u.hostname}${path}`;
  } catch {
    return "";
  }
}

function extractPageLastUpdated($) {
  const candidates = [
    $('meta[property="article:modified_time"]').attr("content"),
    $('meta[name="last-modified"]').attr("content"),
    $('meta[name="last_modified"]').attr("content"),
    $('meta[property="og:updated_time"]').attr("content"),
    $("time[datetime]").first().attr("datetime")
  ].filter(Boolean);

  for (const c of candidates) {
    const d = new Date(c);
    if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  }
  return null;
}

function summarizeText(text) {
  return (text || "").replace(/\s+/g, " ").trim().slice(0, 260);
}

function hashContent({ title, summary, pageLastUpdated, category }) {
  return crypto
    .createHash("sha256")
    .update(`${title || ""}||${summary || ""}||${pageLastUpdated || ""}||${category || ""}`)
    .digest("hex");
}

async function fetchHtmlWithCache(url, fetchCache) {
  const controller = new AbortController();
  const to = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  const cache = fetchCache[url] || {};
  const headers = {
    "User-Agent": "SiteNavigatorIndexer/2.0 (+local-index)"
  };
  if (cache.etag) headers["If-None-Match"] = cache.etag;
  if (cache.lastModified) headers["If-Modified-Since"] = cache.lastModified;

  try {
    const res = await fetch(url, { method: "GET", signal: controller.signal, headers });

    if (res.status === 304) {
      fetchCache[url] = {
        ...cache,
        lastSeenAt: nowIso(),
        lastStatus: 304
      };
      return { notModified: true, html: null };
    }

    const ct = res.headers.get("content-type") || "";
    if (!res.ok || !ct.includes("text/html")) {
      fetchCache[url] = {
        ...cache,
        lastSeenAt: nowIso(),
        lastStatus: res.status
      };
      return { notModified: false, html: null };
    }

    const html = await res.text();
    fetchCache[url] = {
      etag: res.headers.get("etag") || cache.etag || null,
      lastModified: res.headers.get("last-modified") || cache.lastModified || null,
      lastSeenAt: nowIso(),
      lastStatus: res.status
    };

    return { notModified: false, html };
  } catch {
    return { notModified: false, html: null };
  } finally {
    clearTimeout(to);
  }
}

function updatePercent() {
  const denom = Math.max(1, syncProgress.queued);
  syncProgress.percent = Math.min(100, Math.round((syncProgress.processed / denom) * 100));
}

export async function runIncrementalSync() {
  const store = readStore();
  store.fetchCache = store.fetchCache || {};

  const runId = `sync_${Date.now()}`;
  addSyncRun(store, {
    id: runId,
    startedAt: nowIso(),
    finishedAt: null,
    status: "running",
    scannedCount: 0,
    discoveredCount: 0,
    changedCount: 0,
    unchangedCount: 0,
    skippedNotModifiedCount: 0,
    errorCount: 0,
    message: "Sync started"
  });

  Object.assign(syncProgress, {
    inProgress: true,
    runId,
    startedAt: nowIso(),
    finishedAt: null,
    processed: 0,
    queued: START_POINTS.length,
    scannedCount: 0,
    discoveredCount: 0,
    changedCount: 0,
    unchangedCount: 0,
    skippedNotModifiedCount: 0,
    errorCount: 0,
    currentUrl: START_POINTS[0] || null,
    currentDepth: 0,
    percent: 0
  });

  store.content = store.content.map((c) => ({ ...c, active: false }));

  const stats = {
    scannedCount: 0,
    discoveredCount: 0,
    changedCount: 0,
    unchangedCount: 0,
    skippedNotModifiedCount: 0,
    errorCount: 0
  };

  const queue = START_POINTS.map((u) => ({ url: u, depth: 0 }));
  const queuedSet = new Set(START_POINTS);
  const visited = new Set();

  async function worker() {
    while (true) {
      const next = queue.shift();
      if (!next) break;

      const { url, depth } = next;
      if (visited.has(url)) continue;
      visited.add(url);

      syncProgress.currentUrl = url;
      syncProgress.currentDepth = depth;

      const { notModified, html } = await fetchHtmlWithCache(url, store.fetchCache);

      if (notModified) {
        stats.skippedNotModifiedCount += 1;
        syncProgress.skippedNotModifiedCount = stats.skippedNotModifiedCount;

        const existing = getByUrl(store, url);
        if (existing) {
          upsertContent(store, { ...existing, active: true, lastSeenAt: nowIso() });
        }

        syncProgress.processed += 1;
        updatePercent();
        continue;
      }

      if (!html) {
        stats.errorCount += 1;
        syncProgress.errorCount = stats.errorCount;
        syncProgress.processed += 1;
        updatePercent();
        continue;
      }

      stats.scannedCount += 1;
      syncProgress.scannedCount = stats.scannedCount;

      const $ = cheerio.load(html);
      const title = $("title").first().text().trim() || "";
      const summary =
        $('meta[name="description"]').attr("content")?.trim() ||
        summarizeText($("main p").first().text() || $("article p").first().text() || $("p").first().text() || "");
      const pageLastUpdated = extractPageLastUpdated($);
      const category = categorize(url);
      const pathSummary = buildPathSummary(url);
      const contentHash = hashContent({ title, summary, pageLastUpdated, category });

      const existing = getByUrl(store, url);
      const isNew = !existing;
      const isChanged =
        !existing ||
        existing.contentHash !== contentHash ||
        (existing.pageLastUpdated || "") !== (pageLastUpdated || "") ||
        (existing.title || "") !== (title || "") ||
        (existing.summary || "") !== (summary || "") ||
        (existing.category || "") !== category ||
        (existing.pathSummary || "") !== pathSummary;

      const now = nowIso();
      const row = {
        id: existing?.id || `ci_${crypto.createHash("md5").update(url).digest("hex")}`,
        url,
        title,
        category,
        pathSummary,
        summary,
        pageLastUpdated,
        contentHash,
        firstSeenAt: existing?.firstSeenAt || now,
        lastSeenAt: now,
        updatedAt: isChanged ? now : existing?.updatedAt || now,
        active: true
      };

      upsertContent(store, row);

      if (isNew) stats.discoveredCount += 1;
      if (isChanged) stats.changedCount += 1;
      else stats.unchangedCount += 1;

      syncProgress.discoveredCount = stats.discoveredCount;
      syncProgress.changedCount = stats.changedCount;
      syncProgress.unchangedCount = stats.unchangedCount;

      const depthLimit = maxDepthForHost(new URL(url).hostname);
      if (depth < depthLimit) {
        $("a[href]").each((_, el) => {
          const href = $(el).attr("href");
          const resolved = safeUrl(href, url);
          if (!isAllowedUrl(resolved)) return;
          const normalized = normalizeUrl(resolved);
          if (!visited.has(normalized) && !queuedSet.has(normalized)) {
            queue.push({ url: normalized, depth: depth + 1 });
            queuedSet.add(normalized);
            syncProgress.queued = queuedSet.size;
          }
        });
      }

      syncProgress.processed += 1;
      updatePercent();
    }
  }

  const workers = Array.from({ length: CONCURRENCY }, () => worker());
  await Promise.all(workers);

  updateSyncRun(store, runId, {
    finishedAt: nowIso(),
    status: "success",
    scannedCount: stats.scannedCount,
    discoveredCount: stats.discoveredCount,
    changedCount: stats.changedCount,
    unchangedCount: stats.unchangedCount,
    skippedNotModifiedCount: stats.skippedNotModifiedCount,
    errorCount: stats.errorCount,
    message: "Sync completed"
  });

  writeStore(store);

  Object.assign(syncProgress, {
    inProgress: false,
    finishedAt: nowIso(),
    percent: 100
  });

  return { runId, ...stats };
}