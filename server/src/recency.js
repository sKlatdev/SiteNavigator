export function withinDays(iso, days, nowTs = Date.now()) {
  if (!iso) return false;
  const ts = new Date(iso).getTime();
  if (Number.isNaN(ts)) return false;
  const diffDays = Math.floor((nowTs - ts) / (1000 * 60 * 60 * 24));
  return diffDays <= days;
}

export function computeRecentSignals(row, recentDays, nowTs) {
  const isNewPage = withinDays(row.firstSeenAt, recentDays, nowTs);
  if (isNewPage) {
    return { recentlyUpdated: true, recentReason: "new_page" };
  }

  const hasPageLastUpdated = !!row.pageLastUpdated && !Number.isNaN(new Date(row.pageLastUpdated).getTime());

  if (hasPageLastUpdated) {
    const recentlyUpdated = withinDays(row.pageLastUpdated, recentDays, nowTs);
    return {
      recentlyUpdated,
      recentReason: recentlyUpdated ? "page_last_updated" : "none",
    };
  }

  const hasChangedContent = withinDays(row.updatedAt, recentDays, nowTs);
  if (hasChangedContent) {
    return { recentlyUpdated: true, recentReason: "changed_content" };
  }

  return { recentlyUpdated: false, recentReason: "none" };
}
