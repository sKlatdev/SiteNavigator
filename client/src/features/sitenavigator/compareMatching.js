// Re-export everything from the legacy implementation so existing imports keep working.
import { findRelatedCompareItems } from "./compareMatchingLegacy.js";
export * from "./compareMatchingLegacy.js";

// fetchRelatedItems: calls /api/compare/related when GitNexus is available,
// falls back to the legacy token matcher when the server returns fallback:true or on error.
// Returns array in the same shape as findRelatedCompareItems.

export async function fetchRelatedItems(seed, catalog, limit = 6, options = {}) {
  const { vendorPriority, boostTerms = [] } = options;
  try {
    const response = await fetch("/api/compare/related", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ seedUrl: seed?.url, boostTerms, limit }),
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const data = await response.json();
    if (!data.ok || data.fallback) {
      return findRelatedCompareItems(seed, catalog, limit, options);
    }
    return data.results;
  } catch {
    return findRelatedCompareItems(seed, catalog, limit, options);
  }
}
