import { graphQueryClient } from "./graphQueryClient.js";

const CONFIDENCE_THRESHOLD = 0.6;
const MARGIN_THRESHOLD = 0.15;
const SEARCH_LIMIT = 3;
const SEARCH_TIMEOUT_MS = 5_000;

// resolveAmbiguityWithGraph: for each candidate value, queries GitNexus and picks
// the value most corroborated by indexed docs.
// Returns { resolvedValue, confidence, evidenceUrls } or null if unavailable/uncertain.
export async function resolveAmbiguityWithGraph(field, candidateValues, context) {
  if (!graphQueryClient.isAvailable()) {
    if (process.env.DEBUG_GITNEXUS) {
      console.debug(`[cloneDuoGraphResolver] unavailable — skipping disambiguation for field ${context?.fieldId}`);
    }
    return null;
  }

  try {
    const scores = await Promise.all(
      candidateValues.map(async (value) => {
        const hits = await searchWithTimeout(
          `${value} ${field.label}`,
          { limit: SEARCH_LIMIT }
        );
        const score = hits.reduce((sum, h) => sum + Number(h.score || 0), 0);
        return {
          value,
          score,
          evidenceUrls: hits.map((h) => h.url || "").filter(Boolean),
        };
      })
    );

    scores.sort((a, b) => b.score - a.score);
    const top = scores[0];
    const second = scores[1];
    const margin = second ? top.score - second.score : top.score;

    if (top.score < CONFIDENCE_THRESHOLD || margin < MARGIN_THRESHOLD) {
      if (process.env.DEBUG_GITNEXUS) {
        console.debug(
          `[cloneDuoGraphResolver] low confidence for field ${context?.fieldId}: ` +
          `top=${top.score.toFixed(3)} margin=${margin.toFixed(3)} — staying UNRESOLVED_AMBIGUOUS`
        );
      }
      return null;
    }

    if (process.env.DEBUG_GITNEXUS) {
      console.debug(
        `[cloneDuoGraphResolver] resolved field ${context?.fieldId}: ` +
        `value="${top.value}" confidence=${top.score.toFixed(3)} margin=${margin.toFixed(3)}`
      );
    }

    return {
      resolvedValue: top.value,
      confidence: top.score,
      evidenceUrls: top.evidenceUrls,
    };
  } catch (err) {
    if (process.env.DEBUG_GITNEXUS) {
      console.debug(`[cloneDuoGraphResolver] search error for field ${context?.fieldId}: ${err.message}`);
    }
    return null;
  }
}

async function searchWithTimeout(query, opts) {
  return Promise.race([
    graphQueryClient.search(query, opts),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error("search timeout")), SEARCH_TIMEOUT_MS)
    ),
  ]).catch(() => []);
}
