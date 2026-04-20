// fetchGapItems: POST /api/gap/analyze for a slice of competitor items.
// Returns array of gap findings on success, null on server unavailable or any error.
// Null triggers caller to fall back to inline token-matcher computation.
export async function fetchGapItems(competitorItems, { signal } = {}) {
  const debug = typeof localStorage !== "undefined" && localStorage.getItem("debug") === "gitnexus";
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10_000);
    const fetchSignal = signal ?? controller.signal;

    const response = await fetch("/api/gap/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ competitorItems, limit: 3 }),
      signal: fetchSignal,
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      if (debug) console.debug(`[gitnexus] gap/analyze HTTP ${response.status} — falling back inline`);
      return null;
    }

    const data = await response.json();
    if (!data.ok || data.fallback) {
      if (debug) console.debug(`[gitnexus] gap/analyze fallback: ${data.message}`);
      return null;
    }

    return Array.isArray(data.findings) ? data.findings : null;
  } catch (err) {
    if (debug) console.debug(`[gitnexus] gap/analyze error — falling back inline:`, err.message);
    return null;
  }
}
