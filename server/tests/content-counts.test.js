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
      const text = buf.toString();
      if (text.includes("SiteNavigator server running at")) {
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

test("/api/content keeps cross-category counts while filtering selected category", async () => {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "sitenavigator-server-test-"));
  const dataDir = path.join(tmpRoot, "data");
  fs.mkdirSync(dataDir, { recursive: true });

  const now = new Date().toISOString();
  const seed = {
    meta: { createdAt: now, updatedAt: now, schemaVersion: 2 },
    syncRuns: [],
    fetchCache: {},
    content: [
      {
        id: "docs_alpha",
        url: "https://duo.com/docs/alpha",
        title: "Alpha docs",
        summary: "alpha",
        category: "docs",
        pathSummary: "duo.com/docs/alpha",
        pageLastUpdated: now.slice(0, 10),
        contentHash: "1",
        firstSeenAt: now,
        updatedAt: now,
        active: true,
      },
      {
        id: "other_alpha",
        url: "https://duo.com/alpha",
        title: "Alpha other",
        summary: "alpha",
        category: "other",
        pathSummary: "duo.com/alpha",
        pageLastUpdated: now.slice(0, 10),
        contentHash: "2",
        firstSeenAt: now,
        updatedAt: now,
        active: true,
      },
      {
        id: "blog_beta",
        url: "https://duo.com/blog/beta",
        title: "Beta blog",
        summary: "beta",
        category: "blog",
        pathSummary: "duo.com/blog/beta",
        pageLastUpdated: now.slice(0, 10),
        contentHash: "3",
        firstSeenAt: now,
        updatedAt: now,
        active: true,
      },
      {
        id: "docs_inactive",
        url: "https://duo.com/docs/inactive",
        title: "Inactive docs",
        summary: "alpha",
        category: "docs",
        pathSummary: "duo.com/docs/inactive",
        pageLastUpdated: now.slice(0, 10),
        contentHash: "4",
        firstSeenAt: now,
        updatedAt: now,
        active: false,
      },
    ],
  };

  fs.writeFileSync(path.join(dataDir, "index.json"), JSON.stringify(seed, null, 2), "utf8");

  const port = 9100 + Math.floor(Math.random() * 400);
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

    const base = `http://127.0.0.1:${port}/api/content?recentDays=14&q=alpha`;
    const otherRes = await fetch(`${base}&category=other`);
    const docsRes = await fetch(`${base}&category=docs`);

    assert.equal(otherRes.status, 200);
    assert.equal(docsRes.status, 200);

    const otherJson = await otherRes.json();
    const docsJson = await docsRes.json();

    assert.deepEqual(otherJson.counts, docsJson.counts);
    assert.equal(otherJson.counts.docs, 1);
    assert.equal(otherJson.counts.other, 1);
    assert.equal(otherJson.counts.blog, 0);

    assert.equal(otherJson.returnedCount, 1);
    assert.equal(docsJson.returnedCount, 1);
    assert.equal(otherJson.items[0].category, "other");
    assert.equal(docsJson.items[0].category, "docs");
  } finally {
    child.kill("SIGTERM");
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  }
});

test("/api/content derives release_notes category from docs release notes pages", async () => {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "sitenavigator-server-test-"));
  const dataDir = path.join(tmpRoot, "data");
  fs.mkdirSync(dataDir, { recursive: true });

  const now = new Date().toISOString();
  const seed = {
    meta: { createdAt: now, updatedAt: now, schemaVersion: 2 },
    syncRuns: [],
    fetchCache: {},
    content: [
      {
        id: "docs_release_notes",
        url: "https://duo.com/docs/dng-notes",
        title: "Duo Network Gateway Release Notes",
        summary: "Release notes",
        category: "docs",
        pathSummary: "duo.com/docs/dng-notes",
        pageLastUpdated: now.slice(0, 10),
        contentHash: "rn1",
        firstSeenAt: now,
        updatedAt: now,
        active: true,
      },
      {
        id: "docs_regular",
        url: "https://duo.com/docs/administration",
        title: "Administration",
        summary: "Setup guide",
        category: "docs",
        pathSummary: "duo.com/docs/administration",
        pageLastUpdated: now.slice(0, 10),
        contentHash: "d2",
        firstSeenAt: now,
        updatedAt: now,
        active: true,
      },
    ],
  };

  fs.writeFileSync(path.join(dataDir, "index.json"), JSON.stringify(seed, null, 2), "utf8");

  const port = 9600 + Math.floor(Math.random() * 300);
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

    const res = await fetch(`http://127.0.0.1:${port}/api/content?recentDays=14&category=release_notes`);
    assert.equal(res.status, 200);

    const body = await res.json();
    assert.equal(body.counts.release_notes, 1);
    assert.equal(body.counts.docs, 1);
    assert.equal(body.returnedCount, 1);
    assert.equal(body.items[0].category, "release_notes");
    assert.equal(body.items[0].url, "https://duo.com/docs/dng-notes");
  } finally {
    child.kill("SIGTERM");
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  }
});

test("/api/content derives Okta vendor for saml-doc host pages", async () => {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "sitenavigator-server-test-"));
  const dataDir = path.join(tmpRoot, "data");
  fs.mkdirSync(dataDir, { recursive: true });

  const now = new Date().toISOString();
  const seed = {
    meta: { createdAt: now, updatedAt: now, schemaVersion: 2 },
    syncRuns: [],
    fetchCache: {},
    content: [
      {
        id: "okta_saml_doc",
        url: "https://saml-doc.okta.com/SAML_Docs/How-to-Configure-SAML-2.0-for-Cisco-ASA-VPN.html",
        title: "How to Configure SAML 2.0 for Cisco ASA VPN",
        summary: "Okta SAML configuration for Cisco ASA VPN.",
        category: "competitor_docs",
        pathSummary: "saml-doc.okta.com/SAML_Docs/How-to-Configure-SAML-2.0-for-Cisco-ASA-VPN.html",
        pageLastUpdated: now.slice(0, 10),
        contentHash: "okta1",
        firstSeenAt: now,
        updatedAt: now,
        active: true,
      },
    ],
  };

  fs.writeFileSync(path.join(dataDir, "index.json"), JSON.stringify(seed, null, 2), "utf8");

  const port = 9800 + Math.floor(Math.random() * 200);
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

    const res = await fetch(`http://127.0.0.1:${port}/api/content?recentDays=14`);
    assert.equal(res.status, 200);

    const body = await res.json();
    assert.equal(body.items.length, 1);
    assert.equal(body.items[0].vendor, "Okta");
    assert.ok(Array.isArray(body.items[0].tags));
    assert.equal(body.items[0].tags.includes("Okta"), true);
  } finally {
    child.kill("SIGTERM");
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  }
});

test("/api/content excludes non-English locale pages", async () => {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "sitenavigator-server-test-"));
  const dataDir = path.join(tmpRoot, "data");
  fs.mkdirSync(dataDir, { recursive: true });

  const now = new Date().toISOString();
  const seed = {
    meta: { createdAt: now, updatedAt: now, schemaVersion: 2 },
    syncRuns: [],
    fetchCache: {},
    content: [
      {
        id: "okta_jp",
        url: "https://help.okta.com/oie/ja-jp/content/topics/apps/example.htm",
        title: "Japanese Okta page",
        summary: "ja-jp",
        category: "competitor_docs",
        pathSummary: "help.okta.com/oie/ja-jp/content",
        pageLastUpdated: now.slice(0, 10),
        contentHash: "jp1",
        firstSeenAt: now,
        updatedAt: now,
        active: true,
      },
      {
        id: "okta_en",
        url: "https://help.okta.com/oie/en-us/content/topics/apps/example.htm",
        title: "English Okta page",
        summary: "en-us",
        category: "competitor_docs",
        pathSummary: "help.okta.com/oie/en-us/content",
        pageLastUpdated: now.slice(0, 10),
        contentHash: "en1",
        firstSeenAt: now,
        updatedAt: now,
        active: true,
      },
    ],
  };

  fs.writeFileSync(path.join(dataDir, "index.json"), JSON.stringify(seed, null, 2), "utf8");

  const port = 9700 + Math.floor(Math.random() * 100);
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

    const res = await fetch(`http://127.0.0.1:${port}/api/content?recentDays=14`);
    assert.equal(res.status, 200);

    const body = await res.json();
    assert.equal(body.items.length, 1);
    assert.equal(body.items[0].url, "https://help.okta.com/oie/en-us/content/topics/apps/example.htm");
  } finally {
    child.kill("SIGTERM");
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  }
});

test("/api/content includes Duo, Okta, Entra, and Ping Identity vendor tags", async () => {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "sitenavigator-server-test-"));
  const dataDir = path.join(tmpRoot, "data");
  fs.mkdirSync(dataDir, { recursive: true });

  const now = new Date().toISOString();
  const seed = {
    meta: { createdAt: now, updatedAt: now, schemaVersion: 2 },
    syncRuns: [],
    fetchCache: {},
    content: [
      {
        id: "duo_doc",
        url: "https://duo.com/docs/admin",
        title: "Duo admin docs",
        summary: "duo",
        category: "docs",
        pathSummary: "duo.com/docs/admin",
        pageLastUpdated: now.slice(0, 10),
        contentHash: "duo1",
        firstSeenAt: now,
        updatedAt: now,
        active: true,
      },
      {
        id: "okta_help",
        url: "https://help.okta.com/oie/en-us/content/topics/identity-engine.htm",
        title: "Okta help",
        summary: "okta",
        category: "competitor_docs",
        pathSummary: "help.okta.com/oie/en-us",
        pageLastUpdated: now.slice(0, 10),
        contentHash: "okta1",
        firstSeenAt: now,
        updatedAt: now,
        active: true,
      },
      {
        id: "entra_help",
        url: "https://learn.microsoft.com/en-us/entra/identity/saas-apps/4dx-tutorial",
        title: "Entra app tutorial",
        summary: "entra",
        category: "competitor_docs",
        pathSummary: "learn.microsoft.com/en-us/entra/identity/saas-apps",
        pageLastUpdated: now.slice(0, 10),
        contentHash: "entra1",
        firstSeenAt: now,
        updatedAt: now,
        active: true,
      },
      {
        id: "ping_help",
        url: "https://docs.pingidentity.com/r/en-us/pingfederate-120/pf_example",
        title: "Ping Identity docs",
        summary: "ping",
        category: "competitor_docs",
        pathSummary: "docs.pingidentity.com/r/en-us",
        pageLastUpdated: now.slice(0, 10),
        contentHash: "ping1",
        firstSeenAt: now,
        updatedAt: now,
        active: true,
      },
    ],
  };

  fs.writeFileSync(path.join(dataDir, "index.json"), JSON.stringify(seed, null, 2), "utf8");

  const port = 9800 + Math.floor(Math.random() * 150);
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

    const res = await fetch(`http://127.0.0.1:${port}/api/content?recentDays=14`);
    assert.equal(res.status, 200);

    const body = await res.json();
    assert.equal(body.counts.competitor_docs, 3);

    const byUrl = new Map((body.items || []).map((item) => [item.url, item]));
    const duo = byUrl.get("https://duo.com/docs/admin");
    const okta = byUrl.get("https://help.okta.com/oie/en-us/content/topics/identity-engine.htm");
    const entra = byUrl.get("https://learn.microsoft.com/en-us/entra/identity/saas-apps/4dx-tutorial");
    const ping = byUrl.get("https://docs.pingidentity.com/r/en-us/pingfederate-120/pf_example");

    assert.equal(duo.vendor, "Duo");
    assert.ok(Array.isArray(duo.tags));
    assert.ok(duo.tags.includes("Duo"));

    assert.equal(okta.vendor, "Okta");
    assert.ok(Array.isArray(okta.tags));
    assert.ok(okta.tags.includes("Okta"));

    assert.equal(entra.vendor, "Entra");
    assert.ok(Array.isArray(entra.tags));
    assert.ok(entra.tags.includes("Entra"));

    assert.equal(ping.vendor, "Ping Identity");
    assert.ok(Array.isArray(ping.tags));
    assert.ok(ping.tags.includes("Ping Identity"));
  } finally {
    child.kill("SIGTERM");
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  }
});

test("/api/content hides stale redirect notice rows from search results and counts", async () => {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "sitenavigator-server-test-"));
  const dataDir = path.join(tmpRoot, "data");
  fs.mkdirSync(dataDir, { recursive: true });

  const now = new Date().toISOString();
  const seed = {
    meta: { createdAt: now, updatedAt: now, schemaVersion: 2 },
    syncRuns: [],
    fetchCache: {},
    content: [
      {
        id: "ping_redirect",
        url: "https://docs.pingidentity.com/integrations/zscaler/index.html",
        title: "Redirect Notice",
        summary: "The page you requested has been relocated to https://docs.pingidentity.com/integrations/zscaler/pf_is_overview_of_zscaler.html",
        category: "competitor_docs",
        vendor: "Ping Identity",
        pathSummary: "docs.pingidentity.com/integrations/zscaler/index.html",
        pageLastUpdated: now.slice(0, 10),
        contentHash: "redirect-1",
        firstSeenAt: now,
        updatedAt: now,
        active: true,
      },
      {
        id: "ping_real",
        url: "https://docs.pingidentity.com/integrations/zscaler/pf_is_overview_of_zscaler.html",
        title: "Zscaler Connector",
        summary: "Configure Zscaler with Ping Identity.",
        category: "competitor_docs",
        vendor: "Ping Identity",
        pathSummary: "docs.pingidentity.com/integrations/zscaler/pf_is_overview_of_zscaler.html",
        pageLastUpdated: now.slice(0, 10),
        contentHash: "real-1",
        firstSeenAt: now,
        updatedAt: now,
        active: true,
      },
    ],
  };

  fs.writeFileSync(path.join(dataDir, "index.json"), JSON.stringify(seed, null, 2), "utf8");

  const port = 9800 + Math.floor(Math.random() * 100);
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

    const res = await fetch(`http://127.0.0.1:${port}/api/content?recentDays=14&category=competitor_docs&q=pingidentity.com`);
    assert.equal(res.status, 200);

    const body = await res.json();
    assert.equal(body.counts.competitor_docs, 1);
    assert.equal(body.returnedCount, 1);
    assert.equal(body.items[0].title, "Zscaler Connector");
  } finally {
    child.kill("SIGTERM");
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  }
});

test("/api/content keeps newly discovered and recently updated counts disjoint", async () => {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "sitenavigator-server-test-"));
  const dataDir = path.join(tmpRoot, "data");
  fs.mkdirSync(dataDir, { recursive: true });

  const now = new Date();
  const nowIso = now.toISOString();
  const oldIso = new Date(now.getTime() - 45 * 24 * 60 * 60 * 1000).toISOString();
  const oldDay = oldIso.slice(0, 10);
  const nowDay = nowIso.slice(0, 10);

  const seed = {
    meta: { createdAt: nowIso, updatedAt: nowIso, schemaVersion: 2 },
    syncRuns: [],
    fetchCache: {},
    content: [
      {
        id: "new_with_page_last_updated",
        url: "https://duo.com/docs/new-page",
        title: "New page",
        summary: "new",
        category: "docs",
        pathSummary: "duo.com/docs/new-page",
        pageLastUpdated: nowDay,
        contentHash: "new1",
        firstSeenAt: nowIso,
        updatedAt: nowIso,
        active: true,
      },
      {
        id: "existing_changed_content",
        url: "https://duo.com/docs/changed-page",
        title: "Changed page",
        summary: "changed",
        category: "docs",
        pathSummary: "duo.com/docs/changed-page",
        pageLastUpdated: null,
        contentHash: "chg1",
        firstSeenAt: oldIso,
        updatedAt: nowIso,
        active: true,
      },
      {
        id: "existing_page_last_updated",
        url: "https://duo.com/docs/updated-page",
        title: "Updated page",
        summary: "updated",
        category: "docs",
        pathSummary: "duo.com/docs/updated-page",
        pageLastUpdated: nowDay,
        contentHash: "upd1",
        firstSeenAt: oldIso,
        updatedAt: oldIso,
        active: true,
      },
      {
        id: "not_recent",
        url: "https://duo.com/docs/old-page",
        title: "Old page",
        summary: "old",
        category: "docs",
        pathSummary: "duo.com/docs/old-page",
        pageLastUpdated: oldDay,
        contentHash: "old1",
        firstSeenAt: oldIso,
        updatedAt: oldIso,
        active: true,
      },
    ],
  };

  fs.writeFileSync(path.join(dataDir, "index.json"), JSON.stringify(seed, null, 2), "utf8");

  const port = 9400 + Math.floor(Math.random() * 400);
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

    const res = await fetch(`http://127.0.0.1:${port}/api/content?recentDays=14`);
    assert.equal(res.status, 200);

    const body = await res.json();
    assert.equal(body.signals.newlyDiscovered, 1);
    assert.equal(body.signals.recentlyUpdated, 2);

    const byId = new Map((body.items || []).map((item) => [item.id, item]));
    assert.equal(byId.get("new_with_page_last_updated")?.recentReason, "new_page");
    assert.equal(byId.get("existing_changed_content")?.recentReason, "changed_content");
    assert.equal(byId.get("existing_page_last_updated")?.recentReason, "page_last_updated");
    assert.equal(byId.get("not_recent")?.recentReason, "none");
  } finally {
    child.kill("SIGTERM");
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  }
});
