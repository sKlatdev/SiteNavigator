import assert from "node:assert/strict";
import test from "node:test";

import { computeRecentSignals, withinDays } from "../src/recency.js";

test("withinDays handles invalid and missing dates safely", () => {
  const now = Date.UTC(2026, 2, 17);
  assert.equal(withinDays(null, 14, now), false);
  assert.equal(withinDays("not-a-date", 14, now), false);
  assert.equal(withinDays("2026-03-10", 14, now), true);
  assert.equal(withinDays("2026-01-01", 14, now), false);
});

test("computeRecentSignals gives new_page precedence over all other recency signals", () => {
  const now = Date.UTC(2026, 2, 17);
  const row = {
    firstSeenAt: "2026-03-16T00:00:00.000Z",
    pageLastUpdated: "2026-03-17",
    updatedAt: "2026-03-17T00:00:00.000Z",
  };

  assert.deepEqual(computeRecentSignals(row, 14, now), {
    recentlyUpdated: true,
    recentReason: "new_page",
  });
});

test("computeRecentSignals falls back to page_last_updated, changed_content, then none", () => {
  const now = Date.UTC(2026, 2, 17);

  const pageLastUpdatedRecent = {
    firstSeenAt: "2026-01-01T00:00:00.000Z",
    pageLastUpdated: "2026-03-10",
    updatedAt: "2026-01-02T00:00:00.000Z",
  };

  const changedOnly = {
    firstSeenAt: "2026-01-01T00:00:00.000Z",
    pageLastUpdated: null,
    updatedAt: "2026-03-12T00:00:00.000Z",
  };

  const stale = {
    firstSeenAt: "2026-01-01T00:00:00.000Z",
    pageLastUpdated: "2025-12-31",
    updatedAt: "2026-01-02T00:00:00.000Z",
  };

  assert.deepEqual(computeRecentSignals(pageLastUpdatedRecent, 14, now), {
    recentlyUpdated: true,
    recentReason: "page_last_updated",
  });

  assert.deepEqual(computeRecentSignals(changedOnly, 14, now), {
    recentlyUpdated: true,
    recentReason: "changed_content",
  });

  assert.deepEqual(computeRecentSignals(stale, 14, now), {
    recentlyUpdated: false,
    recentReason: "none",
  });
});
