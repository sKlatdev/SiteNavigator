import test from "node:test";
import assert from "node:assert/strict";

import {
  getSearchMatchExplanation,
  parseSearchQuery,
  rankItemForQuery,
  sortItemsBySearchPriority,
} from "../../src/features/sitenavigator/searchRanking.js";

test("parseSearchQuery keeps quoted phrase and tokens", () => {
  const parsed = parseSearchQuery('"Cisco ASA" firewall');
  assert.deepEqual(parsed.phraseTerms, ["cisco asa", "cisco asa firewall"]);
  assert.deepEqual(parsed.tokenTerms, ["firewall"]);
});

test("exact token boundary outranks includes-only matches", () => {
  const itemExact = {
    id: "1",
    title: "Cisco ASA hardening guide",
    tags: ["firewall"],
    url: "https://example.com/cisco-asa",
    summary: "",
    pathSummary: "",
    category: "docs",
  };

  const itemIncludes = {
    id: "2",
    title: "Asana onboarding",
    tags: ["productivity"],
    url: "https://example.com/asana",
    summary: "",
    pathSummary: "",
    category: "docs",
  };

  const sorted = sortItemsBySearchPriority([itemIncludes, itemExact], "Cisco ASA");
  assert.equal(sorted[0].id, "1");
  assert.equal(sorted[1].id, "2");
});

test("quoted phrase enforces strict adjacency", () => {
  const adjacent = rankItemForQuery(
    {
      title: "Cisco ASA deployment",
      tags: ["firewall"],
      url: "https://example.com/cisco-asa",
      summary: "",
      pathSummary: "",
      category: "docs",
    },
    '"Cisco ASA"'
  );

  const nonAdjacent = rankItemForQuery(
    {
      title: "Cisco adaptive security appliance",
      tags: ["firewall"],
      url: "https://example.com/cisco-appliance",
      summary: "",
      pathSummary: "",
      category: "docs",
    },
    '"Cisco ASA"'
  );

  assert.equal(adjacent.hasMatch, true);
  assert.equal(nonAdjacent.hasMatch, false);
});

test("sortItemsBySearchPriority drops non-matches when query is present", () => {
  const items = [
    { id: "a", title: "Duo Admin", tags: [], url: "https://duo.com", summary: "", pathSummary: "", category: "docs" },
    { id: "b", title: "Ping Docs", tags: [], url: "https://ping.com", summary: "", pathSummary: "", category: "docs" },
  ];

  const sorted = sortItemsBySearchPriority(items, "duo");
  assert.deepEqual(sorted.map((item) => item.id), ["a"]);
});

test("getSearchMatchExplanation returns context windows for hits", () => {
  const item = {
    id: "a",
    title: "Duo Admin MFA setup",
    tags: ["mfa", "duo"],
    url: "https://duo.com/docs/mfa",
    summary: "Step by step guide for Duo admins configuring MFA",
    pathSummary: "duo.com/docs/mfa",
    category: "docs",
  };

  const explanation = getSearchMatchExplanation(item, "duo mfa", "hits");
  assert.ok(explanation);
  assert.equal(explanation.mode, "hits");
  assert.ok(explanation.headline.includes("Matched 2 of 2 terms exactly."));
  assert.ok(explanation.matches.length > 0);
  assert.ok(explanation.groups.some((group) => group.field === "title"));
  assert.ok(explanation.matches.some((match) => match.snippet.includes("Duo")));
});

test("getSearchMatchExplanation partial mode limits evidence to partial contributors", () => {
  const item = {
    id: "b",
    title: "Cisco adaptive security appliance",
    tags: ["firewall"],
    url: "https://example.com/cisco-adaptive-security",
    summary: "Security appliance overview",
    pathSummary: "example.com/docs/appliance",
    category: "docs",
  };

  const explanation = getSearchMatchExplanation(item, "Cisco ASA", "partial");
  assert.ok(explanation);
  assert.equal(explanation.mode, "partial");
  assert.ok(explanation.headline.includes("Matched 1 of 2 terms exactly."));
  assert.ok(explanation.headline.includes("1 term did not match."));
  assert.ok(explanation.matches.every((match) => match.matchType.startsWith("partial_")));
});

test("all tokens matching in body but not title ranks as full match tier 2", () => {
  const item = {
    id: "f1",
    title: "Identity Security Overview",
    tags: ["security"],
    url: "https://example.com/docs/identity-security",
    summary: "Cisco provides SAML-based authentication for ASA devices in enterprise deployments",
    pathSummary: "example.com/docs/identity",
    category: "docs",
  };

  const rank = rankItemForQuery(item, "cisco saml asa");
  assert.equal(rank.tier, 2, "expected full match tier (all terms in body)");
  assert.equal(rank.hasMatch, true);
  assert.equal(rank.includesOnly, false);
});

test("full match tier 2 ranks above partial match tier 3", () => {
  const fullMatchItem = {
    id: "fm",
    title: "Identity Security Overview",
    tags: ["security"],
    url: "https://example.com/identity",
    summary: "Cisco provides SAML-based authentication for ASA devices",
    pathSummary: "example.com/docs/identity",
    category: "docs",
  };

  const partialItem = {
    id: "pm",
    title: "Cisco Identity Platform",
    tags: ["cisco"],
    url: "https://example.com/cisco",
    summary: "Overview of the Cisco identity platform",
    pathSummary: "example.com/cisco",
    category: "docs",
  };

  const sorted = sortItemsBySearchPriority([partialItem, fullMatchItem], "cisco saml asa");
  assert.equal(sorted[0].id, "fm", "full match should outrank partial");
});

test("getSearchMatchExplanation hits mode reports body-only term count in headline", () => {
  const item = {
    id: "f2",
    title: "Identity Security Overview",
    tags: ["security"],
    url: "https://example.com/docs/identity-security",
    summary: "Cisco provides SAML-based authentication for ASA devices in enterprise deployments",
    pathSummary: "example.com/docs/identity",
    category: "docs",
  };

  const explanation = getSearchMatchExplanation(item, "cisco saml asa", "hits");
  assert.ok(explanation, "should return an explanation");
  assert.ok(explanation.headline.includes("Matched 0 of 3 terms exactly."), `unexpected headline: ${explanation.headline}`);
  assert.ok(explanation.headline.includes("3 terms matched in body."), `unexpected headline: ${explanation.headline}`);
});

test("article quality outranks navigation-heavy hub pages for the same query", () => {
  const hub = {
    id: "hub",
    title: "Duo Admin MFA setup",
    tags: ["mfa", "duo"],
    url: "https://example.com/docs",
    summary: "Hub summary",
    pathSummary: "example.com/docs",
    category: "docs",
    quality: { indexable: true, contentType: "hub", navigationHeavy: true },
  };
  const article = {
    ...hub,
    id: "article",
    url: "https://example.com/docs/mfa",
    quality: { indexable: true, contentType: "article", navigationHeavy: false },
  };

  const sorted = sortItemsBySearchPriority([hub, article], "duo mfa");
  assert.equal(sorted[0].id, "article");
});
