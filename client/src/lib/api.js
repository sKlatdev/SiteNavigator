const API_BASE = "http://localhost:8787/api";

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

export async function apiGetSyncStatus() {
  const res = await fetch(`${API_BASE}/sync/status`);
  return handleJson(res);
}

export async function apiGetSyncProgress() {
  const res = await fetch(`${API_BASE}/sync/progress`);
  return handleJson(res);
}

export async function apiRunSync() {
  const res = await fetch(`${API_BASE}/sync`, {
    method: "POST",
    headers: { "Content-Type": "application/json" }
  });
  return handleJson(res);
}

export async function apiGetContent(recentDays = 14) {
  const res = await fetch(`${API_BASE}/content?recentDays=${recentDays}`);
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