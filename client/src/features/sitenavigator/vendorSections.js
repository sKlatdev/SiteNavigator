export function slugifyKeySegment(value, fallback = "general_docs") {
  const slug = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return slug || fallback;
}

export function prefixToLabel(prefix) {
  return String(prefix || "")
    .split(/[-_]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function buildDiscoveredVendorSections(catalog, vendorConfig, options = {}) {
  const items = catalog.filter(vendorConfig.isItem);
  const grouped = new Map();
  const defaultSectionIcon = options.defaultSectionIcon ?? null;

  items.forEach((item) => {
    const prefixRaw = vendorConfig.getPrefix(item) || "";
    const prefix = slugifyKeySegment(prefixRaw, "general_docs");
    const bucket = grouped.get(prefix) || { prefix, count: 0 };
    bucket.count += 1;
    grouped.set(prefix, bucket);
  });

  const minSectionCount = Number.isFinite(Number(vendorConfig.minSectionCount))
    ? Math.max(1, Number(vendorConfig.minSectionCount))
    : 50;
  const otherPrefix = slugifyKeySegment(vendorConfig.otherPrefix || "other", "other");
  const prominentEntries = [...grouped.values()].filter(
    (entry) => entry.prefix !== otherPrefix && entry.count > minSectionCount
  );
  const prominentPrefixes = new Set(prominentEntries.map((entry) => entry.prefix));
  const consolidatedOtherCount = [...grouped.values()].reduce(
    (sum, entry) => sum + (prominentPrefixes.has(entry.prefix) ? 0 : entry.count),
    0
  );
  const entries = consolidatedOtherCount > 0
    ? [...prominentEntries, { prefix: otherPrefix, count: consolidatedOtherCount }]
    : prominentEntries;

  const orderMap = new Map(
    (Array.isArray(vendorConfig.sectionOrder) ? vendorConfig.sectionOrder : []).map((key, index) => [String(key), index])
  );
  const sortedEntries = entries.sort((a, b) => {
    if (a.prefix === otherPrefix && b.prefix !== otherPrefix) return 1;
    if (b.prefix === otherPrefix && a.prefix !== otherPrefix) return -1;
    const aRank = orderMap.has(a.prefix) ? orderMap.get(a.prefix) : Number.MAX_SAFE_INTEGER;
    const bRank = orderMap.has(b.prefix) ? orderMap.get(b.prefix) : Number.MAX_SAFE_INTEGER;
    if (aRank !== bRank) return aRank - bRank;
    return b.count - a.count || a.prefix.localeCompare(b.prefix);
  });

  const hasMaxSections = Number.isFinite(Number(vendorConfig.maxSections));
  const tooManySections = hasMaxSections && sortedEntries.length > Number(vendorConfig.maxSections);

  if (!sortedEntries.length || tooManySections) {
    const fallbackPrefix = vendorConfig.fallbackPrefix || "general_docs";
    const fallbackLabel = vendorConfig.fallbackLabel || "General Docs";
    return [
      {
        key: slugifyKeySegment(fallbackPrefix, "general_docs"),
        label: fallbackLabel,
        icon: defaultSectionIcon,
        predicate: vendorConfig.isItem,
      },
    ];
  }

  const disambiguateSectionLabel = (label) => {
    const normalizedVendor = String(vendorConfig.label || "").trim().toLowerCase();
    const normalizedLabel = String(label || "").trim().toLowerCase();
    if (normalizedVendor && normalizedLabel === normalizedVendor) {
      return `${label} Docs`;
    }
    return label;
  };

  return sortedEntries.map((entry) => {
    if (entry.prefix === otherPrefix) {
      const label = disambiguateSectionLabel(
        vendorConfig.otherLabel || vendorConfig.labelOverrides?.[otherPrefix] || "Other"
      );
      return {
        key: otherPrefix,
        label,
        icon: defaultSectionIcon,
        predicate: (item) => {
          if (!vendorConfig.isItem(item)) return false;
          const candidatePrefix = slugifyKeySegment(vendorConfig.getPrefix(item), "general_docs");
          return !prominentPrefixes.has(candidatePrefix);
        },
      };
    }

    const label = disambiguateSectionLabel(
      vendorConfig.labelOverrides?.[entry.prefix] || prefixToLabel(entry.prefix)
    );
    return {
      key: entry.prefix,
      label,
      icon: defaultSectionIcon,
      predicate: (item) =>
        vendorConfig.isItem(item) && slugifyKeySegment(vendorConfig.getPrefix(item), "general_docs") === entry.prefix,
    };
  });
}
