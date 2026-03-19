const SHORT_ACRONYM_ALLOWLIST = new Set([
  "ai",
  "id",
  "it",
  "hr",
  "ux",
  "ui",
  "sso",
  "mfa",
  "asa",
]);

function normalizeSpaces(value) {
  return String(value || "").toLowerCase().replace(/\s+/g, " ").trim();
}

function escapeRegExp(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function countOccurrences(haystack, needle) {
  const text = normalizeSpaces(haystack);
  const term = normalizeSpaces(needle);
  if (!text || !term) return 0;

  let count = 0;
  let offset = 0;
  while (offset < text.length) {
    const idx = text.indexOf(term, offset);
    if (idx < 0) break;
    count += 1;
    offset = idx + term.length;
  }
  return count;
}

function tokenize(rawText) {
  return String(rawText || "")
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean);
}

export function parseSearchQuery(query) {
  const raw = String(query || "").trim();
  if (!raw) {
    return {
      normalizedQuery: "",
      phraseTerms: [],
      tokenTerms: [],
      hasQuotedPhrases: false,
    };
  }

  const phrases = [];
  const consumed = new Set();
  for (const match of raw.matchAll(/"([^"]+)"/g)) {
    const phrase = normalizeSpaces(match[1]);
    if (phrase) {
      phrases.push(phrase);
      consumed.add(phrase);
    }
  }

  const rawWithoutQuotes = raw.replace(/"([^"]+)"/g, " ");
  const tokens = tokenize(normalizeSpaces(rawWithoutQuotes)).filter((token) => {
    if (!token) return false;
    if (consumed.has(token)) return false;
    return token.length >= 2 || SHORT_ACRONYM_ALLOWLIST.has(token);
  });

  const normalizedQuery = normalizeSpaces(raw.replace(/"/g, " "));
  if (normalizedQuery && normalizedQuery.includes(" ") && !consumed.has(normalizedQuery)) {
    phrases.push(normalizedQuery);
  }

  return {
    normalizedQuery,
    phraseTerms: [...new Set(phrases)],
    tokenTerms: [...new Set(tokens)],
    hasQuotedPhrases: phrases.length > 0,
  };
}

function buildItemSearchText(item) {
  const title = normalizeSpaces(item?.title);
  const summary = normalizeSpaces(item?.summary);
  const pathSummary = normalizeSpaces(item?.pathSummary);
  const category = normalizeSpaces(item?.category);
  const vendor = normalizeSpaces(item?.vendor);
  const url = normalizeSpaces(item?.url);
  const tags = Array.isArray(item?.tags)
    ? item.tags.map((tag) => normalizeSpaces(tag)).filter(Boolean).join(" ")
    : "";

  const highPriority = [title, tags, url].filter(Boolean).join(" ");
  const bodyPriority = [summary, pathSummary, category, vendor].filter(Boolean).join(" ");
  const fullText = [highPriority, bodyPriority].filter(Boolean).join(" ");

  return {
    title,
    tags,
    url,
    highPriority,
    bodyPriority,
    fullText,
  };
}

function buildItemSearchFields(item) {
  return [
    { key: "title", label: "Title", text: String(item?.title || "") },
    { key: "summary", label: "Summary", text: String(item?.summary || "") },
    { key: "pathSummary", label: "Path", text: String(item?.pathSummary || "") },
    { key: "url", label: "URL", text: String(item?.url || "") },
    {
      key: "tags",
      label: "Tags",
      text: Array.isArray(item?.tags) ? item.tags.filter(Boolean).join(" ") : "",
    },
  ].filter((field) => field.text.trim());
}

function collectSubstringMatchPositions(text, term) {
  const source = String(text || "");
  const queryTerm = String(term || "");
  if (!source || !queryTerm) return [];

  const sourceLower = source.toLowerCase();
  const termLower = queryTerm.toLowerCase();
  const positions = [];
  let offset = 0;
  while (offset < sourceLower.length) {
    const idx = sourceLower.indexOf(termLower, offset);
    if (idx < 0) break;
    positions.push({ start: idx, end: idx + termLower.length });
    offset = idx + termLower.length;
  }
  return positions;
}

function collectBoundaryMatchPositions(text, token) {
  const source = String(text || "");
  const value = String(token || "").toLowerCase();
  if (!source || !value) return [];

  const pattern = new RegExp(`(^|[^a-z0-9])(${escapeRegExp(value)})(?=$|[^a-z0-9])`, "gi");
  const positions = [];
  let match = pattern.exec(source.toLowerCase());
  while (match) {
    const leading = match[1] ? match[1].length : 0;
    const start = match.index + leading;
    positions.push({ start, end: start + value.length });
    match = pattern.exec(source.toLowerCase());
  }
  return positions;
}

function buildContextSnippet(text, start, end, contextWindow = 36) {
  const source = String(text || "");
  const safeStart = Math.max(0, Math.min(source.length, start));
  const safeEnd = Math.max(safeStart, Math.min(source.length, end));
  const left = Math.max(0, safeStart - contextWindow);
  const right = Math.min(source.length, safeEnd + contextWindow);
  const prefix = left > 0 ? "..." : "";
  const suffix = right < source.length ? "..." : "";
  const snippet = `${prefix}${source.slice(left, right)}${suffix}`;
  const snippetMatchStart = prefix.length + (safeStart - left);
  const snippetMatchEnd = snippetMatchStart + (safeEnd - safeStart);
  return {
    snippet,
    snippetMatchStart,
    snippetMatchEnd,
  };
}

function pushMatches(matches, dedupe, field, term, matchType, positions) {
  positions.forEach(({ start, end }) => {
    const key = `${field.key}:${matchType}:${term}:${start}:${end}`;
    if (dedupe.has(key)) return;
    dedupe.add(key);
    const context = buildContextSnippet(field.text, start, end);
    matches.push({
      field: field.key,
      fieldLabel: field.label,
      matchType,
      term,
      start,
      end,
      ...context,
    });
  });
}

function countBoundaryMatches(text, token) {
  if (!text || !token) return 0;
  const pattern = new RegExp(`(^|[^a-z0-9])${escapeRegExp(token)}(?=$|[^a-z0-9])`, "gi");
  const matches = text.match(pattern);
  return matches ? matches.length : 0;
}

export function rankItemForQuery(item, query) {
  const parsed = typeof query === "string" ? parseSearchQuery(query) : query;
  const phraseTerms = Array.isArray(parsed?.phraseTerms) ? parsed.phraseTerms : [];
  const tokenTerms = Array.isArray(parsed?.tokenTerms) ? parsed.tokenTerms : [];
  if (!phraseTerms.length && !tokenTerms.length) {
    return {
      tier: 4,
      score: 0,
      includesOnly: false,
      totalHits: 0,
      exactPhraseHits: 0,
      exactTokenHits: 0,
      partialTokenHits: 0,
      hasMatch: false,
    };
  }

  const text = buildItemSearchText(item);

  const exactPhraseHighHits = phraseTerms.reduce(
    (sum, phrase) => sum + countOccurrences(text.highPriority, phrase),
    0
  );
  const exactPhraseBodyHits = phraseTerms.reduce(
    (sum, phrase) => sum + countOccurrences(text.bodyPriority, phrase),
    0
  );

  const boundaryMatchesByToken = tokenTerms.map((token) => countBoundaryMatches(text.highPriority, token));
  const exactTokenCoverage = tokenTerms.length
    ? boundaryMatchesByToken.every((count) => count > 0)
    : false;
  const exactTokenHits = boundaryMatchesByToken.reduce((sum, count) => sum + count, 0);
  const partialTokenHits = boundaryMatchesByToken.filter((count) => count > 0).length;

  const includesHits = tokenTerms.reduce((sum, token) => sum + countOccurrences(text.fullText, token), 0);
  const hasAnyIncludes = includesHits > 0 || exactPhraseBodyHits > 0;

  const tier = exactPhraseHighHits > 0
    ? 0
    : exactTokenCoverage
      ? 1
      : partialTokenHits > 0 || exactPhraseBodyHits > 0
        ? 2
        : hasAnyIncludes
          ? 3
          : 4;

  const hasMatch = tier < 4;
  const includesOnly = tier === 3;
  const totalHits = exactPhraseHighHits + exactPhraseBodyHits + exactTokenHits + includesHits;

  const score =
    exactPhraseHighHits * 1000 +
    exactPhraseBodyHits * 400 +
    (exactTokenCoverage ? 300 : 0) +
    exactTokenHits * 60 +
    partialTokenHits * 20 +
    includesHits;

  return {
    tier,
    score,
    includesOnly,
    totalHits,
    exactPhraseHits: exactPhraseHighHits + exactPhraseBodyHits,
    exactTokenHits,
    partialTokenHits,
    hasMatch,
  };
}

export function sortItemsBySearchPriority(items, query) {
  const normalized = String(query || "").trim();
  if (!normalized) return items;

  const parsed = parseSearchQuery(normalized);
  return items
    .map((item, idx) => ({ item, idx, rank: rankItemForQuery(item, parsed) }))
    .filter((entry) => entry.rank.hasMatch)
    .sort((a, b) => {
      if (a.rank.tier !== b.rank.tier) return a.rank.tier - b.rank.tier;
      if (a.rank.score !== b.rank.score) return b.rank.score - a.rank.score;
      if (a.rank.totalHits !== b.rank.totalHits) return b.rank.totalHits - a.rank.totalHits;
      return a.idx - b.idx;
    })
    .map((entry) => entry.item);
}

export function getSearchPriorityBadges(item, query) {
  const rank = rankItemForQuery(item, query);
  if (!rank.hasMatch) return [];

  const badges = [];
  if (rank.tier === 0) badges.push({ id: "exact_phrase", label: "Exact Phrase", tone: "exact_phrase" });
  else if (rank.tier === 1) badges.push({ id: "exact_token", label: "Exact Token", tone: "exact_token" });
  else if (rank.tier === 2) badges.push({ id: "partial", label: "Partial Match", tone: "partial" });
  else badges.push({ id: "includes", label: "Includes", tone: "includes" });

  badges.push({ id: "hits", label: `${rank.totalHits} hits`, tone: "hits" });
  return badges;
}

export function getSearchMatchExplanation(item, query, mode = "hits") {
  const parsed = typeof query === "string" ? parseSearchQuery(query) : query;
  const rank = rankItemForQuery(item, parsed);
  if (!rank.hasMatch) return null;

  const fields = buildItemSearchFields(item);
  const highPriorityKeys = new Set(["title", "tags", "url"]);
  const phraseTerms = Array.isArray(parsed?.phraseTerms) ? parsed.phraseTerms : [];
  const tokenTerms = Array.isArray(parsed?.tokenTerms) ? parsed.tokenTerms : [];

  const matches = [];
  const dedupe = new Set();

  if (mode === "partial") {
    phraseTerms.forEach((phrase) => {
      fields
        .filter((field) => !highPriorityKeys.has(field.key))
        .forEach((field) => {
          pushMatches(
            matches,
            dedupe,
            field,
            phrase,
            "partial_phrase",
            collectSubstringMatchPositions(field.text, phrase)
          );
        });
    });

    tokenTerms.forEach((token) => {
      fields
        .filter((field) => highPriorityKeys.has(field.key))
        .forEach((field) => {
          pushMatches(
            matches,
            dedupe,
            field,
            token,
            "partial_token",
            collectBoundaryMatchPositions(field.text, token)
          );
        });
    });
  } else {
    phraseTerms.forEach((phrase) => {
      fields.forEach((field) => {
        pushMatches(
          matches,
          dedupe,
          field,
          phrase,
          "exact_phrase",
          collectSubstringMatchPositions(field.text, phrase)
        );
      });
    });

    tokenTerms.forEach((token) => {
      fields
        .filter((field) => highPriorityKeys.has(field.key))
        .forEach((field) => {
          pushMatches(
            matches,
            dedupe,
            field,
            token,
            "exact_token",
            collectBoundaryMatchPositions(field.text, token)
          );
        });

      fields.forEach((field) => {
        pushMatches(
          matches,
          dedupe,
          field,
          token,
          "includes",
          collectSubstringMatchPositions(field.text, token)
        );
      });
    });
  }

  const grouped = matches.reduce((acc, match) => {
    const key = match.field;
    if (!acc[key]) {
      acc[key] = {
        field: match.field,
        fieldLabel: match.fieldLabel,
        count: 0,
      };
    }
    acc[key].count += 1;
    return acc;
  }, {});

  const exactMatchedTerms = tokenTerms.filter((token) =>
    fields
      .filter((field) => highPriorityKeys.has(field.key))
      .some((field) => collectBoundaryMatchPositions(field.text, token).length > 0)
  );
  const includesOnlyTerms = tokenTerms.filter((token) =>
    !exactMatchedTerms.includes(token) &&
    fields.some((field) => collectSubstringMatchPositions(field.text, token).length > 0)
  );
  const missingTerms = tokenTerms.filter(
    (token) => !exactMatchedTerms.includes(token) && !includesOnlyTerms.includes(token)
  );

  let baseHeadline = `${rank.totalHits} total hits contributed to ranking.`;
  if (tokenTerms.length) {
    const exactCount = exactMatchedTerms.length;
    const includeCount = includesOnlyTerms.length;
    const missingCount = missingTerms.length;
    baseHeadline = `Matched ${exactCount} of ${tokenTerms.length} terms exactly.`;
    if (includeCount > 0) {
      baseHeadline += ` ${includeCount} term${includeCount === 1 ? "" : "s"} matched as includes-only.`;
    }
    if (missingCount > 0) {
      baseHeadline += ` ${missingCount} term${missingCount === 1 ? "" : "s"} did not match.`;
    }
  }

  const phraseHeadline = phraseTerms.length
    ? ` Phrase hits: ${rank.exactPhraseHits}.`
    : "";
  const hitsHeadline = `${baseHeadline}${phraseHeadline}`;
  const partialHeadline = tokenTerms.length
    ? baseHeadline
    : "Partial match was triggered by phrase matches outside high-priority fields.";

  const sortedMatches = matches.sort((a, b) => a.fieldLabel.localeCompare(b.fieldLabel) || a.start - b.start);

  return {
    mode: mode === "partial" ? "partial" : "hits",
    rank,
    headline: mode === "partial" ? partialHeadline : hitsHeadline,
    groups: Object.values(grouped).sort((a, b) => b.count - a.count),
    matches: sortedMatches.slice(0, 40),
  };
}

export function isIncludesOnlyMatch(item, query) {
  return rankItemForQuery(item, query).includesOnly;
}
