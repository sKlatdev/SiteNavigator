const RELATION_STOP_WORDS = new Set([
  "the",
  "and",
  "for",
  "with",
  "from",
  "into",
  "your",
  "this",
  "that",
  "how",
  "what",
  "when",
  "why",
  "using",
  "guide",
  "docs",
  "documentation",
  "duo",
  "okta",
  "entra",
  "ping",
  "identity",
  "configure",
  "configuration",
  "single",
  "sign",
  "login",
  "logins",
  "access",
  "service",
  "services",
  "microsoft",
  "learn",
  "http",
  "https",
  "www",
  "com",
  "net",
  "org",
  "html",
  "saas",
  "apps",
  "app",
  "tutorial",
  "successor",
  "overview",
  "overviews",
  "admin",
  "center",
  "cloud",
  "account",
  "accounts",
  "user",
  "users",
  "content",
  "topics",
  "topic",
  "docs",
]);

const SHORT_RELATION_ALLOWLIST = new Set(["sso", "mfa", "asa", "vpn", "api", "saml", "scim"]);
const WEAK_ANCHOR_TOKENS = new Set(["sso", "saml", "mfa", "scim", "secure", "client", "firewall", "identity", "login", "access"]);

function normalizeRelationText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function addCanonicalTokens(tokens, rawValue) {
  const normalized = ` ${normalizeRelationText(rawValue)} `;
  if (normalized.includes(" adaptive security appliance ")) tokens.add("asa");
  if (normalized.includes(" single sign on ")) tokens.add("sso");
  if (normalized.includes(" multi factor authentication ")) tokens.add("mfa");
  if (normalized.includes(" secure client ")) tokens.add("secure_client");
  if (normalized.includes(" secure firewall ")) tokens.add("secure_firewall");
  if (normalized.includes(" cisco asa ")) {
    tokens.add("cisco");
    tokens.add("asa");
  }
}

export function tokenizeRelationText(value) {
  const normalized = normalizeRelationText(value);
  const tokens = new Set(
    normalized
      .split(/\s+/)
      .filter((token) => (token.length > 2 || SHORT_RELATION_ALLOWLIST.has(token)) && !RELATION_STOP_WORDS.has(token))
  );
  addCanonicalTokens(tokens, value);
  return [...tokens];
}

function toTitleCaseWords(value) {
  return String(value || "")
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

export function summarizeTopicTitle(value, maxWords = 8) {
  const cleaned = String(value || "").replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
  const words = cleaned.split(" ").filter(Boolean).slice(0, maxWords);
  return toTitleCaseWords(words.join(" ")) || "Untitled Topic";
}

export function changedWeight(item) {
  if (item?.recentReason === "new_page") return 3;
  if (item?.recentReason === "changed_content") return 2;
  return item?.recentlyUpdated ? 1 : 0;
}

function uniqueOverlap(left, right) {
  const rightSet = new Set(right);
  return [...new Set(left)].filter((token) => rightSet.has(token));
}

function buildRelationIndex(item) {
  const titleText = [item?.title, item?.url].join(" ");
  const summaryText = [item?.summary, item?.pathSummary].join(" ");
  const titleTokens = tokenizeRelationText(titleText);
  const summaryTokens = tokenizeRelationText(summaryText);
  const allTokens = [...new Set([...titleTokens, ...summaryTokens])];
  const anchorTokens = titleTokens.length ? titleTokens : allTokens;

  return {
    titleTokens,
    summaryTokens,
    allTokens,
    anchorTokens,
    strongAnchorTokens: anchorTokens.filter((token) => !WEAK_ANCHOR_TOKENS.has(token)),
  };
}

export function relationScore(seed, candidate, options = {}) {
  const boosts = Array.isArray(options.boostTerms) ? options.boostTerms : [];
  const vendorPriority = options.vendorPriority || "balanced";

  const seedIndex = buildRelationIndex(seed);
  const candidateIndex = buildRelationIndex(candidate);
  if (!seedIndex.allTokens.length || !candidateIndex.allTokens.length) {
    return { score: 0, matchedTokens: [], boostedTokens: [] };
  }

  const strongAnchorOverlap = uniqueOverlap(seedIndex.strongAnchorTokens, candidateIndex.allTokens);
  if (!strongAnchorOverlap.length) {
    return { score: 0, matchedTokens: [], boostedTokens: [] };
  }

  const anchorOverlap = uniqueOverlap(seedIndex.anchorTokens, candidateIndex.allTokens);

  const titleOverlap = uniqueOverlap(seedIndex.anchorTokens, candidateIndex.titleTokens);
  const summaryOverlap = uniqueOverlap(seedIndex.anchorTokens, candidateIndex.summaryTokens);
  const genericOverlap = uniqueOverlap(seedIndex.allTokens, candidateIndex.allTokens).filter(
    (token) => !anchorOverlap.includes(token)
  );

  let score = anchorOverlap.length * 6 + titleOverlap.length * 4 + summaryOverlap.length * 2 + Math.min(genericOverlap.length, 2);
  if ((seed?.category || "") === (candidate?.category || "")) score += 1;
  if (changedWeight(candidate) > 0) score += 1;

  const boostedTokens = [];
  boosts.forEach((term) => {
    const normalized = String(term || "").toLowerCase().trim();
    if (!normalized) return;
    const haystack = [candidate?.title, candidate?.summary, candidate?.pathSummary, candidate?.url].join(" ").toLowerCase();
    if (haystack.includes(normalized)) {
      score += 2;
      boostedTokens.push(normalized);
    }
  });

  const candidateVendor = String(candidate?.vendor || "Duo").toLowerCase();
  if (vendorPriority === "duo_first" && candidateVendor === "duo") score += 1;
  if (vendorPriority === "competitor_first" && candidateVendor !== "duo") score += 1;

  return {
    score,
    matchedTokens: [...new Set([...anchorOverlap, ...genericOverlap])],
    boostedTokens,
  };
}

export function relationConfidence(score) {
  if (score >= 12) return "high";
  if (score >= 6) return "medium";
  return "low";
}

function compareRelatedEntries(left, right) {
  return right.scoreMeta.score - left.scoreMeta.score || String(left.item.title || "").localeCompare(String(right.item.title || ""));
}

function selectVendorBalancedEntries(entries, limit) {
  if (entries.length <= limit) {
    return entries;
  }

  const groups = new Map();
  entries.forEach((entry) => {
    const vendor = String(entry.item.vendor || "Duo");
    const existing = groups.get(vendor) || [];
    existing.push(entry);
    groups.set(vendor, existing);
  });

  const vendorOrder = [...groups.entries()]
    .sort((left, right) => compareRelatedEntries(left[1][0], right[1][0]) || left[0].localeCompare(right[0]))
    .map(([vendor]) => vendor);

  const selected = [];
  const selectedIds = new Set();

  vendorOrder.forEach((vendor) => {
    if (selected.length >= limit) return;
    const topEntry = groups.get(vendor)?.[0];
    if (!topEntry || selectedIds.has(topEntry.item.id)) return;
    selected.push(topEntry);
    selectedIds.add(topEntry.item.id);
  });

  entries.forEach((entry) => {
    if (selected.length >= limit) return;
    if (selectedIds.has(entry.item.id)) return;
    selected.push(entry);
    selectedIds.add(entry.item.id);
  });

  return selected;
}

export function buildRelatedVendorBuckets(matches) {
  const groups = new Map();
  matches.forEach((match) => {
    const vendor = String(match?.vendor || "Duo");
    const existing = groups.get(vendor) || [];
    existing.push(match);
    groups.set(vendor, existing);
  });

  return [...groups.entries()]
    .map(([vendor, vendorMatches]) => ({
      vendor,
      topScore: vendorMatches.reduce((maxScore, match) => Math.max(maxScore, Number(match?.relationScore || 0)), 0),
      matches: [...vendorMatches].sort(
        (left, right) => Number(right.pinned) - Number(left.pinned) || right.relationScore - left.relationScore || String(left.title || "").localeCompare(String(right.title || ""))
      ),
    }))
    .sort(
      (left, right) =>
        right.topScore - left.topScore || left.vendor.localeCompare(right.vendor)
    )
    .map(({ topScore: _topScore, ...bucket }) => bucket);
}

export function buildRelatedMatchDiagnostics(matches, activeVendor = "all") {
  const vendorBuckets = buildRelatedVendorBuckets(matches);
  const hasAllTab = vendorBuckets.length > 1;
  const availableValues = new Set(vendorBuckets.map((bucket) => bucket.vendor));
  const resolvedActiveVendor = hasAllTab
    ? availableValues.has(activeVendor)
      ? activeVendor
      : "all"
    : vendorBuckets[0]?.vendor || "all";
  const visibleMatches = resolvedActiveVendor === "all"
    ? matches
    : vendorBuckets.find((bucket) => bucket.vendor === resolvedActiveVendor)?.matches || [];

  return {
    totalMatches: matches.length,
    visibleMatches,
    activeVendor: resolvedActiveVendor,
    hasAllTab,
    topScore: matches.reduce((maxScore, match) => Math.max(maxScore, Number(match?.relationScore || 0)), 0),
    pinnedCount: matches.reduce((count, match) => count + Number(Boolean(match?.pinned)), 0),
    vendorBuckets: vendorBuckets.map((bucket) => ({
      vendor: bucket.vendor,
      count: bucket.matches.length,
      topScore: bucket.matches.reduce((maxScore, match) => Math.max(maxScore, Number(match?.relationScore || 0)), 0),
      pinnedCount: bucket.matches.reduce((count, match) => count + Number(Boolean(match?.pinned)), 0),
      visible: resolvedActiveVendor === "all" || bucket.vendor === resolvedActiveVendor,
    })),
  };
}

function normalizeDedupTitle(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/\|.*$/, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function findRelatedCompareItems(seed, catalog, limit = 6, options = {}) {
  const seedVendor = String(seed?.vendor || "Duo");
  const isSeedDuo = seedVendor.toLowerCase() === "duo";
  const isIndexable = options.isIndexableItem || ((item) => item?.quality?.indexable !== false);
  const isNavigationHeavy = options.isNavigationHeavyItem || ((item) => Boolean(item?.quality?.navigationHeavy) || String(item?.quality?.contentType || "") === "hub");

  const candidates = catalog.filter((item) => {
    const vendor = String(item.vendor || "Duo");
    if (!item?.id || item.id === seed?.id) return false;
    if (!isIndexable(item)) return false;
    if (vendor === seedVendor) return false;
    if (isSeedDuo) return item.category === "competitor_docs";
    return vendor.toLowerCase() === "duo" || item.category === "competitor_docs";
  });

  const ranked = candidates
    .map((item) => ({ item, scoreMeta: relationScore(seed, item, options) }))
    .filter((entry) => entry.scoreMeta.score > 0);

  const preferredPool = ranked.filter((entry) => !isNavigationHeavy(entry.item));
  const pool = preferredPool.length ? preferredPool : ranked;
  const sorted = pool.sort(
    (a, b) => b.scoreMeta.score - a.scoreMeta.score || String(a.item.title || "").localeCompare(String(b.item.title || ""))
  );

  const deduped = [];
  const seen = new Set();
  for (const entry of sorted) {
    const key = `${String(entry.item.vendor || "").toLowerCase()}::${normalizeDedupTitle(entry.item.title)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(entry);
  }

  const selected = selectVendorBalancedEntries(deduped, limit);

  return selected.map((entry) => ({
    ...entry.item,
    relationScore: entry.scoreMeta.score,
    relationConfidence: relationConfidence(entry.scoreMeta.score),
    matchedTokens: entry.scoreMeta.matchedTokens,
    boostedTokens: entry.scoreMeta.boostedTokens,
  }));
}