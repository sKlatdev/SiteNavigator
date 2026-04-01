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
import { detectSoftRedirectPage } from "./contentQuality.js";

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
  "https://demo.duo.com",
  "https://help.okta.com",
  "https://saml-doc.okta.com",
  "https://docs.pingidentity.com",
  "https://learn.microsoft.com/en-us/entra/identity/saas-apps",
  "https://learn.microsoft.com/en-us/entra/identity/saas-apps/tutorial-list"
];

const ALLOWED_HOSTS = [
  "duo.com",
  "guide.duo.com",
  "resources.duo.com",
  "help.duo.com",
  "demo.duo.com",
  "help.okta.com",
  "saml-doc.okta.com",
  "docs.pingidentity.com",
  "learn.microsoft.com"
];

const MAX_DEPTH_DEFAULT = 3;
const MAX_DEPTH_BY_HOST = {
  "help.duo.com": 4,
  "help.okta.com": 3,
  "saml-doc.okta.com": 3,
  "docs.pingidentity.com": 3,
  "learn.microsoft.com": 3
};

const SITEMAP_INDEX_SEEDS = [
  "https://help.okta.com/Sitemap-index.xml"
];

const ENTRA_TOC_URL = "https://learn.microsoft.com/en-us/entra/identity/saas-apps/toc.json";

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

function findLocaleSegment(pathname) {
  const match = String(pathname || "").toLowerCase().match(/\/(?:[a-z]{2}-[a-z]{2})(?=\/|$)/g);
  if (!match?.length) return "";
  return match[0].replace(/^\//, "");
}

function isEnglishLocalePath(pathname) {
  const locale = findLocaleSegment(pathname);
  return !locale || locale === "en-us";
}

function isAllowedEntraSaasPath(pathname) {
  const p = String(pathname || "").toLowerCase();
  return /^\/(?:en-us\/)?entra\/identity\/saas-apps(?:\/[^/?#]+)?\/?$/i.test(p);
}

function isAllowedUrl(urlObj) {
  if (!urlObj) return false;
  if (!["http:", "https:"].includes(urlObj.protocol)) return false;
  if (!hostAllowed(urlObj.hostname)) return false;

  const p = (urlObj.pathname || "").toLowerCase();
  const host = urlObj.hostname.toLowerCase();

  if (!isEnglishLocalePath(p)) return false;

  if (
    host === "help.okta.com" ||
    host.endsWith(".help.okta.com") ||
    host === "saml-doc.okta.com" ||
    host.endsWith(".saml-doc.okta.com")
  ) {
    const locale = findLocaleSegment(p);
    if (locale && locale !== "en-us") return false;
  }

  if (host === "learn.microsoft.com" || host.endsWith(".learn.microsoft.com")) {
    if (!isAllowedEntraSaasPath(p)) return false;
    const locale = /^\/([a-z]{2}-[a-z]{2})(?=\/|$)/i.exec(p)?.[1]?.toLowerCase() || "";
    if (locale && locale !== "en-us") return false;
  }

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

const NORMALIZED_START_POINTS = Array.from(
  new Set(START_POINTS.map((u) => normalizeUrl(new URL(u))))
);

function categorize(urlStr) {
  const u = new URL(urlStr);
  const host = u.hostname.toLowerCase();
  const path = u.pathname.toLowerCase();
  const isDocsPath = path.startsWith("/docs/") || path === "/docs";
  const isNotesPath = /(?:^|\/)docs\/(?:[^/?#]+-notes)(?:\/|$)/.test(path);

  if (host === "resources.duo.com" || host.endsWith(".resources.duo.com")) return "resources";
  if (host === "guide.duo.com" || host.endsWith(".guide.duo.com")) return "guides";
  if (host === "help.duo.com" || host.endsWith(".help.duo.com")) return "help_kb";
  if (host === "demo.duo.com" || host.endsWith(".demo.duo.com")) return "demos";
  if (
    host === "help.okta.com" ||
    host.endsWith(".help.okta.com") ||
    host === "saml-doc.okta.com" ||
    host.endsWith(".saml-doc.okta.com")
  ) {
    return "competitor_docs";
  }
  if (host === "docs.pingidentity.com" || host.endsWith(".docs.pingidentity.com")) return "competitor_docs";
  if ((host === "learn.microsoft.com" || host.endsWith(".learn.microsoft.com")) && /^\/(?:[a-z]{2}-[a-z]{2}\/)?entra\/identity\/saas-apps(?:\/|$)/i.test(path)) return "competitor_docs";

  if (host === "duo.com" || host.endsWith(".duo.com")) {
    if (path.startsWith("/blog")) return "blog";
    if (isDocsPath && isNotesPath) return "release_notes";
    if (path.startsWith("/docs")) return "docs";
  }

  return "other";
}

function deriveVendor(urlStr) {
  try {
    const u = new URL(urlStr);
    const host = u.hostname.toLowerCase();
    if (
      host === "help.okta.com" ||
      host.endsWith(".help.okta.com") ||
      host === "saml-doc.okta.com" ||
      host.endsWith(".saml-doc.okta.com")
    ) {
      return "Okta";
    }
    if (host === "docs.pingidentity.com" || host.endsWith(".docs.pingidentity.com")) return "Ping Identity";
    if ((host === "learn.microsoft.com" || host.endsWith(".learn.microsoft.com")) && /^\/(?:[a-z]{2}-[a-z]{2}\/)?entra\/identity\/saas-apps(?:\/|$)/i.test(u.pathname.toLowerCase())) return "Entra";
  } catch {
    // Default to Duo for malformed URLs; parser errors are tolerated elsewhere.
  }
  return "Duo";
}

function deriveTags(urlStr, vendor) {
  const tags = new Set([vendor]);
  try {
    const u = new URL(urlStr);
    const path = u.pathname.toLowerCase();
    if (vendor === "Okta" && (path === "/wf" || path.startsWith("/wf/"))) {
      tags.add("Workflow");
    }
  } catch {
    // Keep crawl resilient to malformed URLs.
  }
  return Array.from(tags);
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

function toIsoDate(value) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

function extractLastUpdatedTextCandidate($) {
  const text = $("body").text().replace(/\s+/g, " ").trim();
  if (!text) return null;

  const match = text.match(
    /last\s+updated(?:\s+on)?\s*:?\s*([A-Za-z]{3,9}\s+\d{1,2},\s+\d{4}|\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/\d{4})/i
  );

  return match?.[1] || null;
}

function extractPageLastUpdated($) {
  const candidates = [
    $('meta[property="article:modified_time"]').attr("content"),
    $('meta[name="last-modified"]').attr("content"),
    $('meta[name="last_modified"]').attr("content"),
    $('meta[property="og:updated_time"]').attr("content"),
    $("time[datetime]").first().attr("datetime"),
    extractLastUpdatedTextCandidate($)
  ].filter(Boolean);

  for (const c of candidates) {
    const iso = toIsoDate(c);
    if (iso) return iso;
  }
  return null;
}

function summarizeText(text) {
  return (text || "").replace(/\s+/g, " ").trim().slice(0, 260);
}

function hashContent({ title, summary, pageLastUpdated, category, vendor }) {
  return crypto
    .createHash("sha256")
    .update(`${title || ""}||${summary || ""}||${pageLastUpdated || ""}||${category || ""}||${vendor || ""}`)
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

async function fetchText(url) {
  const controller = new AbortController();
  const to = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      method: "GET",
      signal: controller.signal,
      headers: {
        "User-Agent": "SiteNavigatorIndexer/2.0 (+local-index)"
      }
    });

    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  } finally {
    clearTimeout(to);
  }
}

function extractSitemapLocs(xmlText) {
  if (!xmlText) return [];
  const matches = xmlText.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi);
  return Array.from(matches, (m) => m[1]).filter(Boolean);
}

function extractTocHrefs(node, hrefs = []) {
  if (!node || typeof node !== "object") return hrefs;
  if (typeof node.href === "string") hrefs.push(node.href);
  if (Array.isArray(node.items)) {
    for (const child of node.items) extractTocHrefs(child, hrefs);
  }
  if (Array.isArray(node.children)) {
    for (const child of node.children) extractTocHrefs(child, hrefs);
  }
  return hrefs;
}

function extractEntraChildUrlsFromHtml(htmlText) {
  if (!htmlText) return [];
  const matches = htmlText.matchAll(
    /(?:https:\/\/learn\.microsoft\.com)?\/en-us\/entra\/identity\/saas-apps\/([a-z0-9-]+)(?=[\/?#"']|$)/gi
  );

  const urls = new Set();
  for (const match of matches) {
    const slug = match?.[1]?.toLowerCase();
    if (!slug) continue;
    urls.add(`https://learn.microsoft.com/en-us/entra/identity/saas-apps/${slug}`);
  }

  return Array.from(urls);
}

async function discoverSitemapSeedUrls() {
  const discovered = new Set();

  for (const indexUrl of SITEMAP_INDEX_SEEDS) {
    const indexXml = await fetchText(indexUrl);
    if (!indexXml) continue;

    const sitemapUrls = extractSitemapLocs(indexXml);
    for (const sitemapUrl of sitemapUrls) {
      const sitemapXml = await fetchText(sitemapUrl);
      if (!sitemapXml) continue;

      const pageUrls = extractSitemapLocs(sitemapXml);
      for (const pageUrl of pageUrls) {
        const resolved = safeUrl(pageUrl);
        if (!isAllowedUrl(resolved)) continue;
        discovered.add(normalizeUrl(resolved));
      }
    }
  }

  return Array.from(discovered);
}

async function discoverEntraTocUrls() {
  const tocText = await fetchText(ENTRA_TOC_URL);
  if (!tocText) return [];

  let tocData;
  try {
    tocData = JSON.parse(tocText);
  } catch {
    return [];
  }

  const discovered = new Set();
  const hrefs = extractTocHrefs(tocData, []);
  for (const href of hrefs) {
    const resolved = safeUrl(href, "https://learn.microsoft.com/en-us/entra/identity/saas-apps/");
    if (!isAllowedUrl(resolved)) continue;
    discovered.add(normalizeUrl(resolved));
  }

  return Array.from(discovered);
}

function updatePercent() {
  const denom = Math.max(1, syncProgress.queued);
  syncProgress.percent = Math.min(100, Math.round((syncProgress.processed / denom) * 100));
}

export async function runIncrementalSync() {
  const store = readStore();
  store.fetchCache = store.fetchCache || {};
  const sitemapSeedUrls = await discoverSitemapSeedUrls();
  const entraSeedUrls = await discoverEntraTocUrls();
  const startPoints = Array.from(new Set([...NORMALIZED_START_POINTS, ...sitemapSeedUrls, ...entraSeedUrls]));

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
    queued: startPoints.length,
    scannedCount: 0,
    discoveredCount: 0,
    changedCount: 0,
    unchangedCount: 0,
    skippedNotModifiedCount: 0,
    errorCount: 0,
    currentUrl: startPoints[0] || null,
    currentDepth: 0,
    percent: 0
  });

  // Keep only URLs that still match current crawl policy (including locale restrictions).
  store.content = store.content.map((c) => {
    const keep = isAllowedUrl(safeUrl(c.url));
    return { ...c, active: keep };
  });

  const stats = {
    scannedCount: 0,
    discoveredCount: 0,
    changedCount: 0,
    unchangedCount: 0,
    skippedNotModifiedCount: 0,
    errorCount: 0
  };

  const queue = startPoints.map((u) => ({ url: u, depth: 0 }));
  const queuedSet = new Set(startPoints);
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
      const redirectInfo = detectSoftRedirectPage($, url);
      if (redirectInfo.isSoftRedirect) {
        const now = nowIso();
        const existing = getByUrl(store, url);
        if (existing) {
          upsertContent(store, { ...existing, active: false, lastSeenAt: now, updatedAt: now });
        }

        const redirectTarget = safeUrl(redirectInfo.targetUrl, url);
        if (isAllowedUrl(redirectTarget)) {
          const normalized = normalizeUrl(redirectTarget);
          if (!visited.has(normalized) && !queuedSet.has(normalized)) {
            queue.push({ url: normalized, depth });
            queuedSet.add(normalized);
            syncProgress.queued = queuedSet.size;
          }
        }

        syncProgress.processed += 1;
        updatePercent();
        continue;
      }

      const title = $("title").first().text().trim() || "";
      const summary =
        $('meta[name="description"]').attr("content")?.trim() ||
        summarizeText($("main p").first().text() || $("article p").first().text() || $("p").first().text() || "");
      const pageLastUpdated = extractPageLastUpdated($);
      const category = categorize(url);
      const vendor = deriveVendor(url);
      const tags = deriveTags(url, vendor);
      const pathSummary = buildPathSummary(url);
      const contentHash = hashContent({ title, summary, pageLastUpdated, category, vendor });

      const existing = getByUrl(store, url);
      const isNew = !existing;
      const isChanged =
        !existing ||
        existing.contentHash !== contentHash ||
        (existing.pageLastUpdated || "") !== (pageLastUpdated || "") ||
        (existing.title || "") !== (title || "") ||
        (existing.summary || "") !== (summary || "") ||
        (existing.category || "") !== category ||
        (existing.vendor || "") !== vendor ||
        (existing.pathSummary || "") !== pathSummary;

      const now = nowIso();
      const row = {
        id: existing?.id || `ci_${crypto.createHash("md5").update(url).digest("hex")}`,
        url,
        title,
        category,
        vendor,
        tags,
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

      // Learn pages often embed section links in JSON/script payloads instead of direct anchors.
      if (new URL(url).hostname.toLowerCase() === "learn.microsoft.com") {
        const discoveredEntraUrls = extractEntraChildUrlsFromHtml(html);
        discoveredEntraUrls.forEach((candidateUrl) => {
          const resolved = safeUrl(candidateUrl);
          if (!isAllowedUrl(resolved)) return;
          const normalized = normalizeUrl(resolved);
          if (!visited.has(normalized) && !queuedSet.has(normalized)) {
            queue.push({ url: normalized, depth: depth + 1 });
            queuedSet.add(normalized);
            syncProgress.queued = queuedSet.size;
          }
        });
      }

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