import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { graphQueryClient, searchWithTimeout } from "../src/graphQueryClient.js";

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

describe("searchWithTimeout", () => {
  it("returns results from client.search when it resolves quickly", async () => {
    const mockClient = {
      search: async () => [{ score: 0.9, excerpt: "hello" }],
    };
    const results = await searchWithTimeout("query", { limit: 3 }, mockClient);
    assert.deepEqual(results, [{ score: 0.9, excerpt: "hello" }]);
  });

  it("returns empty array when client.search rejects", async () => {
    const mockClient = {
      search: async () => { throw new Error("network error"); },
    };
    const results = await searchWithTimeout("query", {}, mockClient);
    assert.deepEqual(results, []);
  });
});
