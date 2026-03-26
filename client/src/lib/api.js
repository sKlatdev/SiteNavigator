const API_BASE = (
  import.meta.env.VITE_API_BASE_URL || "/api"
).replace(/\/+$/, "");

const VALID_CONTENT_CATEGORIES = new Set([
  "other",
  "docs",
  "release_notes",
  "guides",
  "blog",
  "resources",
  "help_kb",
  "demos",
  "competitor_docs",
]);

async function handleJson(res) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.message || `HTTP ${res.status}`);
  }
  return data;
}

export async function apiHealth() {
  const res = await fetch(`${API_BASE}/health`);
  return handleJson(res);
}

export async function apiGetSyncStatus(options = {}) {
  const res = await fetch(`${API_BASE}/sync/status`, { signal: options.signal });
  return handleJson(res);
}

export async function apiGetSyncProgress(options = {}) {
  const res = await fetch(`${API_BASE}/sync/progress`, { signal: options.signal });
  return handleJson(res);
}

export async function apiRunSync() {
  const res = await fetch(`${API_BASE}/sync`, {
    method: "POST",
    headers: { "Content-Type": "application/json" }
  });
  return handleJson(res);
}

export async function apiGetContent(recentDays = 14, options = {}) {
  const params = new URLSearchParams({ recentDays: String(recentDays) });
  if (options.q) params.set("q", String(options.q));
  if (options.category && VALID_CONTENT_CATEGORIES.has(String(options.category))) {
    params.set("category", String(options.category));
  }
  if (options.page) params.set("page", String(options.page));
  if (options.pageSize) params.set("pageSize", String(options.pageSize));

  const res = await fetch(`${API_BASE}/content?${params.toString()}`, {
    signal: options.signal,
  });
  return handleJson(res);
}

export async function apiExportIndex() {
  const res = await fetch(`${API_BASE}/index/export`);
  return handleJson(res);
}

export async function apiImportIndex(payload, mode = "replace") {
  const res = await fetch(`${API_BASE}/index/import`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mode, payload })
  });
  return handleJson(res);
}

export async function apiImportIndexFromPath(filePath, mode = "replace") {
  const res = await fetch(`${API_BASE}/index/import-from-path`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ filePath, mode })
  });
  return handleJson(res);
}

export async function apiGetIndexPathInfo(filePath) {
  const params = new URLSearchParams();
  if (filePath) params.set("filePath", String(filePath));
  const suffix = params.toString() ? `?${params.toString()}` : "";
  const res = await fetch(`${API_BASE}/index/path-info${suffix}`);
  return handleJson(res);
}

export async function apiSaveIndexToPath(filePath) {
  const res = await fetch(`${API_BASE}/index/save-to-path`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ filePath })
  });
  return handleJson(res);
}

export async function apiLoadIndexFromPath(filePath, mode = "replace") {
  const res = await fetch(`${API_BASE}/index/load-from-path`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ filePath, mode })
  });
  return handleJson(res);
}

export async function apiBuildCloneDuoSourceBundle(sourceItems) {
  const res = await fetch(`${API_BASE}/clone-duo/saml/source-bundle`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sourceItems }),
  });
  return handleJson(res);
}

export async function apiTransformCloneDuoDraft({ sourceItems, sourceBundle, blueprintFamily }) {
  const res = await fetch(`${API_BASE}/clone-duo/saml/transform`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sourceItems, sourceBundle, blueprintFamily }),
  });
  return handleJson(res);
}

export async function apiSaveCloneDuoDraft(draft) {
  const res = await fetch(`${API_BASE}/clone-duo/saml/review-draft`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ draft }),
  });
  return handleJson(res);
}

export async function apiGetCloneDuoDraft(draftId) {
  const res = await fetch(`${API_BASE}/clone-duo/saml/review-draft/${encodeURIComponent(String(draftId || ""))}`);
  return handleJson(res);
}

export async function apiDeleteCloneDuoDraft(draftId) {
  const res = await fetch(`${API_BASE}/clone-duo/saml/review-draft/${encodeURIComponent(String(draftId || ""))}`, {
    method: "DELETE",
  });
  return handleJson(res);
}

export async function apiExportCloneDuoDraft(draft) {
  const res = await fetch(`${API_BASE}/clone-duo/saml/export`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ draft }),
  });
  return handleJson(res);
}