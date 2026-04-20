import assert from "node:assert/strict";
import { describe, it } from "node:test";
import express from "express";
import { createServer } from "node:http";

describe("POST /api/gap/analyze", () => {
  it("returns fallback:true when graphQueryClient is unavailable", async () => {
    const app = express();
    app.use(express.json());
    const mockClient = { isAvailable: () => false, search: async () => [] };

    app.post("/api/gap/analyze", async (req, res) => {
      if (!mockClient.isAvailable()) {
        if (process.env.DEBUG_GITNEXUS) {
          console.debug(`[gap/analyze] fallback: GitNexus unavailable. items=${(req.body?.competitorItems || []).length}`);
        }
        return res.status(503).json({ ok: false, fallback: true, message: "GitNexus unavailable" });
      }
    });

    const server = createServer(app);
    await new Promise((r) => server.listen(0, r));
    const port = server.address().port;

    const response = await fetch(`http://localhost:${port}/api/gap/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ competitorItems: [{ id: "1", title: "SAML SSO", summary: "Single sign-on", vendor: "Okta", url: "https://okta.com/saml" }], limit: 3 }),
    });
    const data = await response.json();

    assert.equal(response.status, 503);
    assert.equal(data.ok, false);
    assert.equal(data.fallback, true);
    assert.ok(data.message.includes("unavailable"));

    await new Promise((r) => server.close(r));
  });

  it("returns findings array with correct shape when client is available", async () => {
    const app = express();
    app.use(express.json());

    const mockClient = {
      isAvailable: () => true,
      search: async () => [
        { id: "duo_1", title: "Duo SSO Guide", url: "https://duo.com/sso", vendor: "Duo", score: 0.82, excerpt: "Configure SSO" },
      ],
    };

    app.post("/api/gap/analyze", async (req, res) => {
      if (!mockClient.isAvailable()) {
        return res.status(503).json({ ok: false, fallback: true, message: "GitNexus unavailable" });
      }
      const competitorItems = Array.isArray(req.body?.competitorItems) ? req.body.competitorItems : [];
      const limit = Math.min(10, Math.max(1, Number(req.body?.limit || 3)));

      try {
        const findings = await Promise.all(
          competitorItems.map(async (item) => {
            const query = `${item.title || ""} ${item.summary || ""}`.trim();
            const hits = await mockClient.search(query, { limit });
            const relatedDuo = hits[0] || null;
            const relationScore = relatedDuo ? Number(relatedDuo.score || 0) : 0;
            const recencyScore = item.recencyScore || 0;
            const evidenceCount = item.evidenceCount || 0;
            const spreadScore = Math.min(4, evidenceCount);
            const severityScore = spreadScore + recencyScore + Math.max(0, 6 - relationScore);
            const severity = severityScore >= 9 ? "high" : severityScore >= 6 ? "medium" : "low";
            const gapType = item.gapType || "feature_gap";
            const whyFlagged = relatedDuo
              ? `Weak Duo alignment (${relationScore.toFixed(2)}). Best match: '${relatedDuo.title}'.`
              : `No Duo counterpart found. evidence vendors: ${evidenceCount}.`;

            return {
              id: `gap_${item.id}`,
              title: `${item.vendor || "Competitor"} ${(item.title || "").split(" ").slice(0, 6).join(" ")}`,
              summary: relatedDuo
                ? `Potential ${gapType.replace("_", " ")} gap. Closest Duo topic: '${relatedDuo.title}'.`
                : `Likely ${gapType.replace("_", " ")} gap with no reliable Duo equivalent.`,
              vendor: item.vendor || "",
              url: item.url || "",
              relatedDuoTitle: relatedDuo?.title || "",
              relationScore,
              severity,
              severityScore,
              gapType,
              whyFlagged,
              evidenceCount,
              feedbackState: item.feedbackState || "none",
              tags: [
                ...(Array.isArray(item.tags) ? item.tags : []),
                !relatedDuo ? "strong_gap" : "partial_gap",
                `gap_${gapType}`,
                `severity_${severity}`,
              ],
            };
          })
        );
        res.json({ ok: true, findings });
      } catch (err) {
        res.status(500).json({ ok: false, message: err.message });
      }
    });

    const server = createServer(app);
    await new Promise((r) => server.listen(0, r));
    const port = server.address().port;

    const response = await fetch(`http://localhost:${port}/api/gap/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        competitorItems: [{ id: "okta_1", title: "SAML SSO", summary: "single sign-on", vendor: "Okta", url: "https://okta.com/saml", evidenceCount: 2, recencyScore: 1, gapType: "feature_gap" }],
        limit: 3,
      }),
    });
    const data = await response.json();

    assert.equal(data.ok, true);
    assert.ok(Array.isArray(data.findings));
    assert.equal(data.findings.length, 1);
    const f = data.findings[0];
    assert.equal(f.id, "gap_okta_1");
    assert.ok(["high", "medium", "low"].includes(f.severity), `unexpected severity: ${f.severity}`);
    assert.ok(typeof f.severityScore === "number");
    assert.ok(typeof f.relatedDuoTitle === "string");
    assert.ok(Array.isArray(f.tags));

    await new Promise((r) => server.close(r));
  });
});
