import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveAmbiguityWithGraph } from "../src/cloneDuoGraphResolver.js";

describe("resolveAmbiguityWithGraph module", () => {
  it("resolveAmbiguityWithGraph is a function", () => {
    assert.equal(typeof resolveAmbiguityWithGraph, "function");
  });
});

describe("resolveAmbiguityWithGraph logic", () => {
  it("returns null when graphQueryClient is unavailable", async () => {
    const field = { id: "sp_entity_id", label: "SP Entity ID" };
    const unavailableClient = { isAvailable: () => false, search: async () => [] };
    const result = await resolveAmbiguityWithGraph(
      field,
      ["https://a.com/sp", "https://b.com/sp"],
      { fieldId: "sp_entity_id" },
      unavailableClient
    );
    assert.equal(result, null);
  });

  it("returns resolvedValue for the higher-scored candidate", async () => {
    const field = { id: "sp_entity_id", label: "SP Entity ID" };
    let callCount = 0;
    const mockClient = {
      isAvailable: () => true,
      search: async (query) => {
        callCount++;
        if (query.includes("https://okta.com/sp")) return [{ score: 0.85, url: "https://duo.com/okta-sp" }];
        return [{ score: 0.30, url: "https://duo.com/other" }];
      },
    };

    const result = await resolveAmbiguityWithGraph(
      field,
      ["https://okta.com/sp", "https://pingid.com/sp"],
      { fieldId: "sp_entity_id" },
      mockClient
    );

    assert.ok(result !== null, "expected non-null result");
    assert.equal(result.resolvedValue, "https://okta.com/sp");
    assert.ok(result.confidence >= 0.6, `confidence too low: ${result.confidence}`);
    assert.ok(Array.isArray(result.evidenceUrls));
    assert.equal(callCount, 2);
  });

  it("returns null when margin between top two candidates is below 0.15", async () => {
    const field = { id: "sp_entity_id", label: "SP Entity ID" };
    const mockClient = {
      isAvailable: () => true,
      search: async () => [{ score: 0.72, url: "https://duo.com/x" }],
    };
    const result = await resolveAmbiguityWithGraph(
      field,
      ["https://okta.com/sp", "https://pingid.com/sp"],
      { fieldId: "sp_entity_id" },
      mockClient
    );
    assert.equal(result, null);
  });

  it("returns null when top confidence is below 0.6", async () => {
    const field = { id: "acs_url", label: "ACS URL" };
    let queries = [];
    const mockClient = {
      isAvailable: () => true,
      search: async (query) => { queries.push(query); return [{ score: 0.30, url: "" }]; },
    };
    const result = await resolveAmbiguityWithGraph(
      field,
      ["https://a.com/acs", "https://b.com/acs"],
      { fieldId: "acs_url" },
      mockClient
    );
    assert.equal(result, null);
    assert.equal(queries.length, 2);
  });
});
