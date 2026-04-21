import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { resolveFieldWithGraph } from "../src/cloneDuoMapping.js";

function makeField(overrides = {}) {
  return {
    id: "sp_entity_id",
    label: "Service Provider Entity ID",
    group: "service_provider",
    valueType: "string",
    cardinality: "single",
    targetSectionId: "update_application_in_duo",
    extractionAliases: ["service provider (sp) entity id", "sp entity id", "audience uri", "entityid", "entity id"],
    expectedFormatHint: "The service provider identifier or audience URI.",
    confidenceThreshold: 0.6,
    ...overrides,
  };
}

describe("resolveFieldWithGraph", () => {
  it("is exported as a function", () => {
    assert.equal(typeof resolveFieldWithGraph, "function");
  });

  it("returns null when graphQueryClient is unavailable", async () => {
    const unavailableClient = { isAvailable: () => false, search: async () => [] };
    const result = await resolveFieldWithGraph(makeField(), [], unavailableClient);
    assert.equal(result, null);
  });

  it("returns null when no search hits meet confidence threshold", async () => {
    const lowScoreClient = {
      isAvailable: () => true,
      search: async () => [{ score: 0.3, excerpt: "SP Entity ID: zoom.us", url: "https://okta.com/zoom" }],
    };
    const result = await resolveFieldWithGraph(makeField(), [], lowScoreClient);
    assert.equal(result, null);
  });

  it("returns null when high-confidence hit excerpt yields no extractable value", async () => {
    const noValueClient = {
      isAvailable: () => true,
      search: async () => [{ score: 0.85, excerpt: "Configure your SAML integration.", url: "https://okta.com/zoom" }],
    };
    const result = await resolveFieldWithGraph(makeField(), [], noValueClient);
    assert.equal(result, null);
  });

  it("resolves a value when high-confidence hit excerpt contains an alias match", async () => {
    const goodClient = {
      isAvailable: () => true,
      search: async () => [{
        score: 0.9,
        excerpt: "Service Provider (SP) Entity ID | zoom.us\nACS URL | https://zoom.us/saml",
        url: "https://okta.com/zoom",
      }],
    };
    const result = await resolveFieldWithGraph(makeField(), [], goodClient);
    assert.ok(result !== null, "expected a non-null result");
    assert.equal(result.value, "zoom.us");
    assert.ok(result.confidence >= 0.6, `confidence too low: ${result.confidence}`);
    assert.deepEqual(result.evidenceUrls, ["https://okta.com/zoom"]);
  });

  it("uses the first hit that meets threshold and yields a value", async () => {
    let callCount = 0;
    const multiHitClient = {
      isAvailable: () => true,
      search: async () => {
        callCount++;
        return [
          { score: 0.4, excerpt: "no useful content", url: "https://okta.com/a" },
          { score: 0.95, excerpt: "SP Entity ID | myapp.example.com", url: "https://okta.com/b" },
        ];
      },
    };
    const result = await resolveFieldWithGraph(makeField(), [], multiHitClient);
    assert.equal(callCount, 1, "search called once");
    assert.ok(result !== null);
    assert.equal(result.value, "myapp.example.com");
    assert.deepEqual(result.evidenceUrls, ["https://okta.com/b"]);
  });
});
