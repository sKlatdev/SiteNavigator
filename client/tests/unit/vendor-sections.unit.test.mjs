import test from "node:test";
import assert from "node:assert/strict";

import { buildDiscoveredVendorSections } from "../../src/features/sitenavigator/vendorSections.js";

function makeCatalog(vendorLabel, countsByPrefix) {
  const entries = Object.entries(countsByPrefix);
  let id = 0;
  return entries.flatMap(([prefix, count]) =>
    Array.from({ length: count }, (_, idx) => {
      id += 1;
      return {
        id: `${vendorLabel}-${id}`,
        vendor: vendorLabel,
        url: `https://example.test/${prefix}/doc-${idx + 1}`,
        sectionPrefix: prefix,
      };
    })
  );
}

function countMatches(items, sections) {
  return sections.reduce((sum, section) => sum + items.filter(section.predicate).length, 0);
}

test("buildDiscoveredVendorSections preserves total coverage when other is dominant", () => {
  const catalog = makeCatalog("Ping Identity", {
    pingidentity: 120,
    integrations: 80,
    other: 900,
    pingfederate: 47,
    pingaccess: 12,
  });

  const vendorConfig = {
    key: "ping_identity",
    label: "Ping Identity",
    isItem: (item) => item.vendor === "Ping Identity",
    getPrefix: (item) => item.sectionPrefix,
    fallbackPrefix: "general_docs",
    fallbackLabel: "General Docs",
    maxSections: 30,
    minSectionCount: 50,
    otherPrefix: "other",
    otherLabel: "Other",
    labelOverrides: {
      pingidentity: "Ping Identity",
      integrations: "Integrations",
      other: "Other",
    },
    sectionOrder: ["integrations", "pingidentity", "other"],
  };

  const sections = buildDiscoveredVendorSections(catalog, vendorConfig);
  const keys = sections.map((section) => section.key);
  const otherSections = sections.filter((section) => section.key === "other");
  const otherCount = catalog.filter(otherSections[0].predicate).length;

  assert.equal(otherSections.length, 1, "other bucket should be emitted exactly once");
  assert.deepEqual(keys, ["integrations", "pingidentity", "other"]);
  assert.equal(
    countMatches(catalog, sections),
    catalog.length,
    "section predicates should cover the full vendor universe with no drops"
  );
  assert.equal(
    otherCount,
    959,
    "other bucket should contain native other docs plus non-prominent sections"
  );
});

test("buildDiscoveredVendorSections disambiguates section label matching vendor name", () => {
  const catalog = makeCatalog("Ping Identity", {
    pingidentity: 60,
    integrations: 10,
  });

  const vendorConfig = {
    key: "ping_identity",
    label: "Ping Identity",
    isItem: (item) => item.vendor === "Ping Identity",
    getPrefix: (item) => item.sectionPrefix,
    fallbackPrefix: "general_docs",
    fallbackLabel: "General Docs",
    maxSections: 30,
    minSectionCount: 50,
    otherPrefix: "other",
    otherLabel: "Other",
    labelOverrides: {
      pingidentity: "Ping Identity",
    },
    sectionOrder: ["pingidentity", "other"],
  };

  const sections = buildDiscoveredVendorSections(catalog, vendorConfig);
  const pingIdentitySection = sections.find((section) => section.key === "pingidentity");

  assert.ok(pingIdentitySection, "pingidentity section should exist");
  assert.equal(pingIdentitySection.label, "Ping Identity Docs");
});

test("buildDiscoveredVendorSections keeps section invariants across vendor configs", () => {
  const vendorFixtures = [
    {
      label: "Okta",
      countsByPrefix: { api: 140, auth: 80, concepts: 22, other: 11 },
      order: ["api", "auth", "other"],
    },
    {
      label: "Microsoft Entra ID",
      countsByPrefix: { identity: 100, graph: 73, samples: 30, other: 5 },
      order: ["identity", "graph", "other"],
    },
    {
      label: "Duo",
      countsByPrefix: { admin: 90, websdk: 52, radius: 12, other: 8 },
      order: ["admin", "websdk", "other"],
    },
  ];

  vendorFixtures.forEach((fixture) => {
    const catalog = makeCatalog(fixture.label, fixture.countsByPrefix);
    const sections = buildDiscoveredVendorSections(catalog, {
      key: slugifyFixture(fixture.label),
      label: fixture.label,
      isItem: (item) => item.vendor === fixture.label,
      getPrefix: (item) => item.sectionPrefix,
      fallbackPrefix: "general_docs",
      fallbackLabel: "General Docs",
      maxSections: 30,
      minSectionCount: 50,
      otherPrefix: "other",
      otherLabel: "Other",
      sectionOrder: fixture.order,
      labelOverrides: {},
    });

    assert.equal(
      countMatches(catalog, sections),
      catalog.length,
      `${fixture.label}: section predicates should match vendor item total`
    );

    const otherSections = sections.filter((section) => section.key === "other");
    assert.equal(otherSections.length, 1, `${fixture.label}: should always provide one consolidated other section`);
  });
});

test("buildDiscoveredVendorSections falls back when sections exceed max or are empty", () => {
  const iconToken = Symbol("icon");
  const catalog = makeCatalog("Okta", {
    alpha: 2,
    beta: 2,
    gamma: 2,
  });

  const sections = buildDiscoveredVendorSections(
    catalog,
    {
      key: "okta",
      label: "Okta",
      isItem: (item) => item.vendor === "Okta",
      getPrefix: (item) => item.sectionPrefix,
      fallbackPrefix: "general_docs",
      fallbackLabel: "General Docs",
      maxSections: 1,
      minSectionCount: 1,
      otherPrefix: "other",
      otherLabel: "Other",
      sectionOrder: ["alpha", "beta", "gamma", "other"],
      labelOverrides: {},
    },
    { defaultSectionIcon: iconToken }
  );

  assert.equal(sections.length, 1);
  assert.equal(sections[0].key, "general_docs");
  assert.equal(sections[0].label, "General Docs");
  assert.equal(sections[0].icon, iconToken);
  assert.equal(catalog.filter(sections[0].predicate).length, catalog.length);
});

function slugifyFixture(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}
