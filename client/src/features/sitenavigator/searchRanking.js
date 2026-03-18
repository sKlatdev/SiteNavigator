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

export function isIncludesOnlyMatch(item, query) {
  return rankItemForQuery(item, query).includesOnly;
}
