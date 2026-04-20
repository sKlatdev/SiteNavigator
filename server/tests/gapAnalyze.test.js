import assert from "node:assert/strict";
import { describe, it } from "node:test";
import express from "express";
import { createServer } from "node:http";
import { createGapAnalyzeHandler } from "../src/server.js";

describe("POST /api/gap/analyze — createGapAnalyzeHandler", () => {
  function buildApp(mockClient) {
    const app = express();
    app.use(express.json());
    app.post("/api/gap/analyze", createGapAnalyzeHandler(mockClient));
    return app;
  }

  async function post(app, body) {
    const server = createServer(app);
    await new Promise((r) => server.listen(0, r));
    const port = server.address().port;
    const response = await fetch(`http://localhost:${port}/api/gap/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await response.json();
    await new Promise((r) => server.close(r));
    return { response, data };
  }

  it("returns 503 fallback:true when graphQueryClient is unavailable", async () => {
    const { response, data } = await post(
      buildApp({ isAvailable: () => false, search: async () => [] }),
      { competitorItems: [{ id: "1", title: "SAML SSO", summary: "Single sign-on", vendor: "Okta", url: "https://okta.com/saml" }] }
    );
    assert.equal(response.status, 503);
    assert.equal(data.ok, false);
    assert.equal(data.fallback, true);
    assert.ok(data.message.includes("unavailable"));
  });

  it("returns { ok: true, findings } with correct shape and exact severity", async () => {
    const mockClient = {
      isAvailable: () => true,
      search: async () => [{ id: "duo_1", title: "Duo SSO Guide", url: "https://duo.com/sso", vendor: "Duo", score: 0.82 }],
    };
    // evidenceCount=2, recencyScore=1, relationScore=0.82
    // severityScore = min(4,2) + 1 + max(0, 6-0.82) = 2 + 1 + 5.18 = 8.18 → "medium"
    const { data } = await post(buildApp(mockClient), {
      competitorItems: [{ id: "okta_1", title: "SAML SSO", summary: "single sign-on", vendor: "Okta", url: "https://okta.com/saml", evidenceCount: 2, recencyScore: 1, gapType: "feature_gap" }],
      limit: 3,
    });

    assert.equal(data.ok, true);
    assert.ok(Array.isArray(data.findings));
    assert.equal(data.findings.length, 1);
    const f = data.findings[0];
    assert.equal(f.id, "gap_okta_1");
    assert.equal(f.severity, "medium");
    assert.ok(Math.abs(f.severityScore - 8.18) < 0.01, `unexpected severityScore: ${f.severityScore}`);
    assert.equal(f.relatedDuoTitle, "Duo SSO Guide");
    assert.ok(Array.isArray(f.tags));
    assert.ok(f.tags.includes("partial_gap"));
    assert.ok(f.tags.includes("gap_feature_gap"));
    assert.ok(f.tags.includes("severity_medium"));
    assert.ok(f.whyFlagged.includes("0.82"));
    assert.ok(!f.whyFlagged.startsWith("Weak"), `whyFlagged should not hardcode 'Weak': ${f.whyFlagged}`);
  });

  it("returns empty findings array for empty competitorItems", async () => {
    const { data } = await post(
      buildApp({ isAvailable: () => true, search: async () => [] }),
      { competitorItems: [] }
    );
    assert.equal(data.ok, true);
    assert.deepEqual(data.findings, []);
  });

  it("falls back to gap_<url> id when item.id is missing", async () => {
    const mockClient = { isAvailable: () => true, search: async () => [] };
    const { data } = await post(buildApp(mockClient), {
      competitorItems: [{ title: "No ID item", summary: "test", vendor: "Okta", url: "https://okta.com/page" }],
    });
    assert.equal(data.ok, true);
    assert.ok(data.findings[0].id !== "gap_undefined", `id should not be 'gap_undefined': ${data.findings[0].id}`);
  });

  it("returns 500 when search throws", async () => {
    const mockClient = {
      isAvailable: () => true,
      search: async () => { throw new Error("search failed"); },
    };
    const { response, data } = await post(buildApp(mockClient), {
      competitorItems: [{ id: "x", title: "T", summary: "S", vendor: "V", url: "https://v.com" }],
    });
    assert.equal(response.status, 500);
    assert.equal(data.ok, false);
  });
});
