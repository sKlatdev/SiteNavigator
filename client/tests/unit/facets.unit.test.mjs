import test from "node:test";
import assert from "node:assert/strict";

import {
  applyFacetModes,
  createPresetFacetTagDefinitions,
  withFacetTagCounts,
} from "../../src/features/sitenavigator/facets.js";

function byId(tags, id) {
  return tags.find((tag) => tag.id === id);
}

test("recency tags are disjoint between new and recently updated", () => {
  const tags = createPresetFacetTagDefinitions([], {
    isOktaItem: () => false,
    isEntraItem: () => false,
    isPingItem: () => false,
  });

  const recentlyUpdated = byId(tags, "recently_updated");
  const newlyDiscovered = byId(tags, "newly_discovered");

  const newItem = { recentlyUpdated: true, recentReason: "new_page" };
  const changedItem = { recentlyUpdated: true, recentReason: "changed_content" };
  const staleItem = { recentlyUpdated: false, recentReason: "none" };

  assert.equal(newlyDiscovered.predicate(newItem), true);
  assert.equal(recentlyUpdated.predicate(newItem), false);

  assert.equal(newlyDiscovered.predicate(changedItem), false);
  assert.equal(recentlyUpdated.predicate(changedItem), true);

  assert.equal(newlyDiscovered.predicate(staleItem), false);
  assert.equal(recentlyUpdated.predicate(staleItem), false);
});

test("facet modes correctly combine and/or/exclude semantics", () => {
  const tags = createPresetFacetTagDefinitions([], {
    isOktaItem: (item) => item.vendor === "Okta",
    isEntraItem: (item) => item.vendor === "Entra",
    isPingItem: (item) => item.vendor === "Ping Identity",
  });

  const items = [
    { id: "a", vendor: "Duo", category: "docs", recentlyUpdated: true, recentReason: "changed_content", tags: ["Duo"] },
    { id: "b", vendor: "Okta", category: "competitor_docs", recentlyUpdated: true, recentReason: "new_page", tags: ["Okta"] },
    { id: "c", vendor: "Entra", category: "competitor_docs", recentlyUpdated: false, recentReason: "none", tags: ["Entra"] },
  ];

  const result = applyFacetModes(items, tags, {
    competitor_docs: "and",
    okta: "or",
    entra: "or",
    newly_discovered: "exclude",
  });

  assert.deepEqual(result.map((item) => item.id), ["c"]);
});

test("facet tag counts reflect currently provided item universe", () => {
  const tags = createPresetFacetTagDefinitions([], {
    isOktaItem: (item) => item.vendor === "Okta",
    isEntraItem: (item) => item.vendor === "Entra",
    isPingItem: (item) => item.vendor === "Ping Identity",
  });

  const scopedItems = [
    { id: "b", vendor: "Okta", category: "competitor_docs", recentlyUpdated: true, recentReason: "new_page", tags: ["Okta"] },
    { id: "c", vendor: "Entra", category: "competitor_docs", recentlyUpdated: false, recentReason: "none", tags: ["Entra"] },
  ];

  const counts = withFacetTagCounts(scopedItems, tags);

  assert.equal(byId(counts, "competitor_docs").count, 2);
  assert.equal(byId(counts, "okta").count, 1);
  assert.equal(byId(counts, "entra").count, 1);
  assert.equal(byId(counts, "newly_discovered").count, 1);
  assert.equal(byId(counts, "recently_updated").count, 0);
}
);

test("search facet tags are generated and match text content", () => {
  const tags = createPresetFacetTagDefinitions(["duo admin"], {});
  const searchTag = byId(tags, "search:duo admin");

  assert.ok(searchTag, "search tag should be present");
  assert.equal(
    searchTag.predicate({ title: "Duo Admin Panel", summary: "", pathSummary: "", url: "", category: "docs" }),
    true
  );
  assert.equal(
    searchTag.predicate({ title: "Ping", summary: "", pathSummary: "", url: "", category: "competitor_docs" }),
    false
  );
});