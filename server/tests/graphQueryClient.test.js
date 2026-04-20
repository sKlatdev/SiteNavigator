import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { graphQueryClient } from "../src/graphQueryClient.js";

describe("graphQueryClient", () => {
  it("search returns empty array when GitNexus is unavailable", async () => {
    const results = await graphQueryClient.search("saml configuration", {});
    assert(Array.isArray(results), "expected array");
  });

  it("cypher returns empty array when GitNexus is unavailable", async () => {
    const results = await graphQueryClient.cypher("MATCH (n) RETURN n LIMIT 1");
    assert(Array.isArray(results), "expected array");
  });

  it("isAvailable returns false when not started", () => {
    assert.equal(graphQueryClient.isAvailable(), false);
  });
});
