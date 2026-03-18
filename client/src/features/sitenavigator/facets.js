import { parseSearchQuery } from "./searchRanking.js";

function itemSearchText(item) {
  return [item.title, item.summary, item.pathSummary, item.url, item.category, item.vendor]
    .join(" ")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function matchesSearchFacetTerm(item, term) {
  const text = itemSearchText(item);
  if (!text) return false;

  const parsed = parseSearchQuery(term);
  const phraseTerms = parsed.phraseTerms || [];
  const tokenTerms = parsed.tokenTerms || [];

  if (phraseTerms.length && !phraseTerms.every((phrase) => text.includes(phrase))) {
    return false;
  }

  if (!tokenTerms.length) {
    return phraseTerms.length > 0;
  }

  return tokenTerms.some((token) => text.includes(token));
}

export function createPresetFacetTagDefinitions(searchFacetTerms, matchers) {
  const {
    isOktaItem = () => false,
    isEntraItem = () => false,
    isPingItem = () => false,
  } = matchers || {};

  const base = [
    {
      id: "recently_updated",
      label: "Recently Updated",
      predicate: (item) => item.recentlyUpdated && item.recentReason !== "new_page",
    },
    {
      id: "newly_discovered",
      label: "Newly Discovered",
      predicate: (item) => item.recentReason === "new_page",
    },
    {
      id: "okta",
      label: "Okta",
      predicate: (item) => {
        const tags = Array.isArray(item.tags) ? item.tags : [];
        return isOktaItem(item) || tags.some((tag) => String(tag || "").toLowerCase() === "okta");
      },
    },
    {
      id: "entra",
      label: "Entra",
      predicate: (item) => {
        const tags = Array.isArray(item.tags) ? item.tags : [];
        return isEntraItem(item) || tags.some((tag) => String(tag || "").toLowerCase() === "entra");
      },
    },
    {
      id: "ping_identity",
      label: "Ping Identity",
      predicate: (item) => {
        const tags = Array.isArray(item.tags) ? item.tags : [];
        return isPingItem(item) || tags.some((tag) => String(tag || "").toLowerCase() === "ping identity");
      },
    },
    {
      id: "duo",
      label: "Duo",
      predicate: (item) => String(item?.vendor || "duo").toLowerCase() === "duo",
    },
    {
      id: "competitor_docs",
      label: "Competitor Docs",
      predicate: (item) => String(item?.category || "") === "competitor_docs",
    },
  ];

  const searchTags = searchFacetTerms.map((term) => ({
    id: `search:${term}`,
    label: term,
    predicate: (item) => matchesSearchFacetTerm(item, term),
    isSearchTag: true,
  }));

  return [...base, ...searchTags];
}

export function withFacetTagCounts(items, tags) {
  return tags.map((tag) => ({
    ...tag,
    count: items.filter((item) => tag.predicate(item)).length,
  }));
}

export function applyFacetModes(items, tags, modes) {
  if (!items.length || !tags.length || !Object.keys(modes).length) return items;

  const tagMap = new Map(tags.map((tag) => [tag.id, tag]));
  const andTags = Object.entries(modes)
    .filter(([, mode]) => mode === "and")
    .map(([id]) => tagMap.get(id))
    .filter(Boolean);
  const orTags = Object.entries(modes)
    .filter(([, mode]) => mode === "or")
    .map(([id]) => tagMap.get(id))
    .filter(Boolean);
  const excludeTags = Object.entries(modes)
    .filter(([, mode]) => mode === "exclude")
    .map(([id]) => tagMap.get(id))
    .filter(Boolean);

  return items.filter((item) => {
    if (excludeTags.some((tag) => tag.predicate(item))) return false;
    if (andTags.some((tag) => !tag.predicate(item))) return false;
    if (orTags.length && !orTags.some((tag) => tag.predicate(item))) return false;
    return true;
  });
}
