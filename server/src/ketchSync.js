import crypto from "crypto";
import fs from "fs";
import path from "path";
import readline from "readline";
import { spawn } from "child_process";
import { fileURLToPath } from "url";

import {
  addSyncRun,
  dataDir,
  getByUrl,
  nowIso,
  readStore,
  updateSyncRun,
  upsertContent,
  writeStore,
} from "./store.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const isWindows = process.platform === "win32";
const bundledExeName = isWindows ? "ketch.exe" : "ketch";
const bundledKetchAssetPath = path.resolve(__dirname, "..", "vendor", "ketch", bundledExeName);
const runtimeKetchDir = path.join(dataDir, "runtime");
const runtimeKetchPath = path.join(runtimeKetchDir, bundledExeName);
const ketchPortableRoot = path.join(dataDir, "ketch-runtime");
const ketchDepth = Math.max(1, Number(process.env.SITENAVIGATOR_KETCH_DEPTH || 3));
const ketchConcurrency = Math.max(1, Number(process.env.SITENAVIGATOR_KETCH_CONCURRENCY || 8));

const KETCH_VENDOR_RUNS = [
  {
    id: "duo",
    seed: "https://duo.com",
    matchesUrl: (url) => /(^|\.)duo\.com$/i.test(hostnameFromUrl(url)),
  },
  {
    id: "okta",
    seed: "https://help.okta.com",
    matchesUrl: (url) => /(^|\.)(help|saml-doc)\.okta\.com$/i.test(hostnameFromUrl(url)),
  },
  {
    id: "pingidentity",
    seed: "https://docs.pingidentity.com",
    matchesUrl: (url) => /(^|\.)docs\.pingidentity\.com$/i.test(hostnameFromUrl(url)),
  },
  {
    id: "entra",
    seed: "https://learn.microsoft.com/en-us/entra/identity/saas-apps",
    matchesUrl: (url) => {
      const host = hostnameFromUrl(url);
      if (!/(^|\.)learn\.microsoft\.com$/i.test(host)) return false;
      try {
        const parsed = new URL(String(url || ""));
        return /^\/(?:[a-z]{2}-[a-z]{2}\/)?entra\/identity\/saas-apps(?:\/|$)/i.test(parsed.pathname);
      } catch {
        return false;
      }
    },
  },
];

const syncProgress = {
  inProgress: false,
  runId: null,
  startedAt: null,
  finishedAt: null,
  processed: 0,
  queued: KETCH_VENDOR_RUNS.length,
  completedVendors: 0,
  totalVendors: KETCH_VENDOR_RUNS.length,
  currentVendor: "",
  scannedCount: 0,
  discoveredCount: 0,
  changedCount: 0,
  unchangedCount: 0,
  skippedNotModifiedCount: 0,
  errorCount: 0,
  currentUrl: null,
  currentDepth: 0,
  percent: 0,
};

export function getSyncProgress() {
  return { ...syncProgress };
}

export function canUseKetchSync() {
  const explicit = String(process.env.SITENAVIGATOR_KETCH_BIN || "").trim();
  if (explicit) return fs.existsSync(explicit);
  return fs.existsSync(bundledKetchAssetPath);
}

function hostnameFromUrl(rawUrl) {
  try {
    return new URL(String(rawUrl || "")).hostname.toLowerCase();
  } catch {
    return "";
  }
}

function findLocaleSegment(pathname) {
  const segments = String(pathname || "")
    .toLowerCase()
    .split("/")
    .filter(Boolean);
  return segments.find((segment) => /^[a-z]{2}-[a-z]{2}$/.test(segment)) || "";
}

export function isEnglishContentUrl(rawUrl) {
  try {
    const parsed = new URL(String(rawUrl || ""));
    const locale = findLocaleSegment(parsed.pathname);
    return !locale || locale === "en-us";
  } catch {
    return true;
  }
}

function normalizeKetchQuality(rawQuality) {
  return rawQuality && typeof rawQuality === "object"
    ? {
        indexable: rawQuality.indexable !== false,
        contentType: String(rawQuality.contentType || rawQuality.content_type || "article") || "article",
        navigationHeavy: Boolean(rawQuality.navigationHeavy ?? rawQuality.navigation_heavy),
        redirectTarget: String(rawQuality.redirectTarget || rawQuality.redirect_target || ""),
      }
    : {
        indexable: true,
        contentType: "article",
        navigationHeavy: false,
        redirectTarget: "",
      };
}

function deriveCategory(urlStr, title = "") {
  try {
    const u = new URL(urlStr);
    const host = u.hostname.toLowerCase();
    const pathname = u.pathname.toLowerCase();
    const loweredTitle = String(title || "").toLowerCase();
    const isDocsPath = pathname === "/docs" || pathname.startsWith("/docs/");
    const looksLikeReleaseNotes = loweredTitle.includes("release notes") || /\/docs\/(?:[^/?#]+-notes)(?:\/|$)/.test(pathname);

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
    if ((host === "learn.microsoft.com" || host.endsWith(".learn.microsoft.com")) && /^\/(?:[a-z]{2}-[a-z]{2}\/)?entra\/identity\/saas-apps(?:\/|$)/i.test(pathname)) {
      return "competitor_docs";
    }
    if (host === "duo.com" || host.endsWith(".duo.com")) {
      if (pathname.startsWith("/blog")) return "blog";
      if (isDocsPath && looksLikeReleaseNotes) return "release_notes";
      if (pathname.startsWith("/docs")) return "docs";
    }
  } catch {
    // Fall through to other for malformed URLs.
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
    if ((host === "learn.microsoft.com" || host.endsWith(".learn.microsoft.com")) && /^\/(?:[a-z]{2}-[a-z]{2}\/)?entra\/identity\/saas-apps(?:\/|$)/i.test(u.pathname.toLowerCase())) {
      return "Entra";
    }
  } catch {
    // Default to Duo for malformed URLs.
  }

  return "Duo";
}

function deriveTags(urlStr, vendor, category) {
  const tags = new Set([vendor, category || "other"]);
  try {
    const u = new URL(urlStr);
    const pathname = u.pathname.toLowerCase();
    if (vendor === "Okta" && (pathname === "/wf" || pathname.startsWith("/wf/"))) {
      tags.add("Workflow");
    }
  } catch {
    // Keep tags resilient to malformed URLs.
  }
  return Array.from(tags);
}

function buildPathSummary(urlStr) {
  try {
    const u = new URL(urlStr);
    const segments = u.pathname.split("/").filter(Boolean).slice(0, 3);
    return `${u.hostname}${segments.length ? `/${segments.join("/")}` : "/"}`;
  } catch {
    return "";
  }
}

function toIsoDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

function hashKetchContent({ title, summary, pageLastUpdated, category, vendor, quality }) {
  return crypto
    .createHash("sha256")
    .update(
      `${title || ""}||${summary || ""}||${pageLastUpdated || ""}||${category || ""}||${vendor || ""}||${JSON.stringify(quality || {})}`
    )
    .digest("hex");
}

function qualityEquals(a, b) {
  return JSON.stringify(normalizeKetchQuality(a)) === JSON.stringify(normalizeKetchQuality(b));
}

export function mapKetchResultToRow(result, existingRow = null) {
  const page = result?.page && typeof result.page === "object" ? result.page : null;
  if (!page) return null;

  const rowUrl = String(page.url || result.url || "").trim();
  if (!rowUrl) return null;

  const quality = normalizeKetchQuality(page.quality);
  const category = deriveCategory(rowUrl, page.title);
  const vendor = deriveVendor(rowUrl);
  const pageLastUpdated = toIsoDate(page.last_modified) || existingRow?.pageLastUpdated || "";
  const summary = String(page.summary || existingRow?.summary || "").trim();
  const title = String(page.title || existingRow?.title || "").trim();
  const pathSummary = buildPathSummary(rowUrl);
  const contentHash = String(
    page.content_hash ||
      hashKetchContent({ title, summary, pageLastUpdated, category, vendor, quality })
  );
  const now = nowIso();
  const row = {
    id: existingRow?.id || `ci_${crypto.createHash("md5").update(rowUrl).digest("hex")}`,
    url: rowUrl,
    title,
    category,
    vendor,
    tags: deriveTags(rowUrl, vendor, category),
    pathSummary,
    summary,
    pageLastUpdated,
    contentHash,
    firstSeenAt: existingRow?.firstSeenAt || now,
    lastSeenAt: now,
    updatedAt:
      !existingRow ||
      existingRow.contentHash !== contentHash ||
      existingRow.title !== title ||
      existingRow.summary !== summary ||
      existingRow.pageLastUpdated !== pageLastUpdated ||
      existingRow.category !== category ||
      existingRow.vendor !== vendor ||
      existingRow.pathSummary !== pathSummary ||
      !qualityEquals(existingRow.quality, quality)
        ? now
        : existingRow.updatedAt || now,
    active: true,
    quality,
  };

  return {
    row,
    isNew: !existingRow,
    isChanged:
      !existingRow ||
      existingRow.contentHash !== row.contentHash ||
      existingRow.updatedAt !== row.updatedAt ||
      !qualityEquals(existingRow.quality, row.quality),
  };
}

export function applySeenUrlsForVendor(store, vendorRun, seenUrls) {
  store.content = (store.content || []).map((row) => {
    if (!vendorRun.matchesUrl(row?.url)) return row;
    return {
      ...row,
      active: seenUrls.has(String(row?.url || "")),
    };
  });
}

function ensureRuntimeKetchBinary() {
  const explicit = String(process.env.SITENAVIGATOR_KETCH_BIN || "").trim();
  if (explicit) {
    if (!fs.existsSync(explicit)) {
      throw new Error(`Configured Ketch binary was not found at ${explicit}`);
    }
    return explicit;
  }

  if (!fs.existsSync(bundledKetchAssetPath)) {
    throw new Error("Bundled Ketch binary was not found. Build the portable assets first or set SITENAVIGATOR_KETCH_BIN.");
  }

  if (!process.pkg) return bundledKetchAssetPath;

  fs.mkdirSync(runtimeKetchDir, { recursive: true });
  const sourceSize = fs.statSync(bundledKetchAssetPath).size;
  const needsCopy = !fs.existsSync(runtimeKetchPath) || fs.statSync(runtimeKetchPath).size !== sourceSize;
  if (needsCopy) {
    fs.copyFileSync(bundledKetchAssetPath, runtimeKetchPath);
  }
  return runtimeKetchPath;
}

function updateVendorProgress(completedCount, currentUrl = null, currentDepth = 0) {
  syncProgress.processed = completedCount;
  syncProgress.completedVendors = completedCount;
  syncProgress.totalVendors = KETCH_VENDOR_RUNS.length;
  syncProgress.currentUrl = currentUrl;
  syncProgress.currentDepth = currentDepth;
  syncProgress.percent = Math.min(100, Math.round((completedCount / Math.max(1, KETCH_VENDOR_RUNS.length)) * 100));
}

async function runVendorCrawl(ketchBin, vendorRun, store, stats) {
  const seenUrls = new Set();
  syncProgress.currentVendor = vendorRun.id;
  const args = [
    "--json",
    "crawl",
    vendorRun.seed,
    "--depth",
    String(ketchDepth),
    "--concurrency",
    String(ketchConcurrency),
  ];

  const child = spawn(ketchBin, args, {
    env: {
      ...process.env,
      KETCH_PORTABLE_ROOT: ketchPortableRoot,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  const stderr = [];
  child.stderr.on("data", (chunk) => {
    stderr.push(chunk.toString());
  });

  const lineReader = readline.createInterface({ input: child.stdout, crlfDelay: Infinity });
  for await (const line of lineReader) {
    const trimmed = String(line || "").trim();
    if (!trimmed) continue;

    let record;
    try {
      record = JSON.parse(trimmed);
    } catch {
      continue;
    }

    syncProgress.currentUrl = String(record?.page?.url || record?.url || vendorRun.seed || "");
    syncProgress.currentDepth = Number(record?.depth || 0);

    if (record?.error) {
      stats.errorCount += 1;
      syncProgress.errorCount = stats.errorCount;
      continue;
    }

    const rowUrl = String(record?.page?.url || record?.url || "");
    if (!isEnglishContentUrl(rowUrl)) {
      continue;
    }

    const existing = getByUrl(store, rowUrl);
    const mapped = mapKetchResultToRow(record, existing);
    if (!mapped) continue;

    stats.scannedCount += 1;
    if (record.status === "new") stats.discoveredCount += 1;
    if (record.status === "changed") stats.changedCount += 1;
    if (record.status === "unchanged") stats.unchangedCount += 1;
    syncProgress.scannedCount = stats.scannedCount;
    syncProgress.discoveredCount = stats.discoveredCount;
    syncProgress.changedCount = stats.changedCount;
    syncProgress.unchangedCount = stats.unchangedCount;

    upsertContent(store, mapped.row);
    seenUrls.add(mapped.row.url);
  }

  const exitCode = await new Promise((resolve, reject) => {
    child.on("error", reject);
    child.on("exit", (code) => resolve(code ?? 1));
  });

  if (exitCode !== 0) {
    throw new Error(`Ketch crawl failed for ${vendorRun.id}: ${stderr.join("").trim() || `exit ${exitCode}`}`);
  }

  return seenUrls;
}

export async function runKetchIncrementalSync() {
  const ketchBin = ensureRuntimeKetchBinary();
  const store = readStore();
  const runId = `sync_${Date.now()}`;
  const startedAt = nowIso();
  const stats = {
    scannedCount: 0,
    discoveredCount: 0,
    changedCount: 0,
    unchangedCount: 0,
    skippedNotModifiedCount: 0,
    errorCount: 0,
  };

  addSyncRun(store, {
    id: runId,
    startedAt,
    finishedAt: null,
    status: "running",
    scannedCount: 0,
    discoveredCount: 0,
    changedCount: 0,
    unchangedCount: 0,
    skippedNotModifiedCount: 0,
    errorCount: 0,
    message: "Ketch sync started",
  });

  Object.assign(syncProgress, {
    inProgress: true,
    runId,
    startedAt,
    finishedAt: null,
    processed: 0,
    queued: KETCH_VENDOR_RUNS.length,
    completedVendors: 0,
    totalVendors: KETCH_VENDOR_RUNS.length,
    currentVendor: KETCH_VENDOR_RUNS[0]?.id || "",
    scannedCount: 0,
    discoveredCount: 0,
    changedCount: 0,
    unchangedCount: 0,
    skippedNotModifiedCount: 0,
    errorCount: 0,
    currentUrl: KETCH_VENDOR_RUNS[0]?.seed || null,
    currentDepth: 0,
    percent: 0,
  });

  let completedCount = 0;
  let failed = false;
  let failureMessage = "";

  try {
    for (const vendorRun of KETCH_VENDOR_RUNS) {
      syncProgress.currentUrl = vendorRun.seed;
      const seenUrls = await runVendorCrawl(ketchBin, vendorRun, store, stats);
      applySeenUrlsForVendor(store, vendorRun, seenUrls);
      completedCount += 1;
      updateVendorProgress(completedCount, vendorRun.seed, 0);
      writeStore(store);
    }
  } catch (error) {
    failed = true;
    failureMessage = error?.message || "Ketch sync failed";
  }

  updateSyncRun(store, runId, {
    finishedAt: nowIso(),
    status: failed ? "error" : "success",
    scannedCount: stats.scannedCount,
    discoveredCount: stats.discoveredCount,
    changedCount: stats.changedCount,
    unchangedCount: stats.unchangedCount,
    skippedNotModifiedCount: stats.skippedNotModifiedCount,
    errorCount: stats.errorCount + (failed ? 1 : 0),
    message: failed ? failureMessage : "Ketch sync completed",
  });
  writeStore(store);

  Object.assign(syncProgress, {
    inProgress: false,
    finishedAt: nowIso(),
    currentVendor: "",
    errorCount: stats.errorCount + (failed ? 1 : 0),
    percent: failed ? syncProgress.percent : 100,
  });

  if (failed) {
    throw new Error(failureMessage);
  }

  return { runId, ...stats, engine: "ketch" };
}