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

import { buildCloneDuoDraft } from "../src/cloneDuoMapping.js";

describe("Phase 4 regression — existing fixtures must still resolve", () => {
  function makeSourceBundle() {
    return {
      schemaVersion: 1,
      createdAt: "2026-03-26T00:00:00.000Z",
      sourcePages: [{
        id: "source_page_1",
        title: "How to Configure SAML 2.0 for Zoom",
        url: "https://saml-doc.okta.com/SAML_Docs/How-to-Configure-SAML-2.0-for-Zoom.us.html",
        vendor: "Okta",
        category: "competitor_docs",
        summary: "Zoom SAML configuration steps.",
      }],
      evidence: [
        {
          id: "ev_2_table",
          sourcePageId: "source_page_1",
          type: "table_block",
          headingPath: ["Configuration Steps"],
          ordinal: 2,
          text: "Sign-in Page URL | https://example.okta.com/app/sso/saml\nService Provider (SP) Entity ID | zoom.us\nSignature Hash Algorithm | SHA-256",
          extractedFields: [
            { label: "Sign-in Page URL", value: "https://example.okta.com/app/sso/saml" },
            { label: "Service Provider (SP) Entity ID", value: "zoom.us" },
            { label: "Signature Hash Algorithm", value: "SHA-256" },
          ],
          sourceUrl: "https://example.test/zoom",
          citationLabel: "Configuration Steps · block 2",
        },
        {
          id: "ev_3_steps",
          sourcePageId: "source_page_1",
          type: "ordered_step_block",
          headingPath: ["Configuration Steps"],
          ordinal: 3,
          text: "SP-initiated SSO\nIdP-initiated SSO\nJIT (Just In Time) Provisioning",
          extractedFields: [],
          sourceUrl: "https://example.test/zoom",
          citationLabel: "Configuration Steps · block 3",
        },
      ],
    };
  }

  it("fields resolved before Phase 4 are still resolved after Phase 4 (fallback path)", async () => {
    const draft = await buildCloneDuoDraft({
      sourceItems: [{ title: "How to Configure SAML 2.0 for Zoom" }],
      sourceBundle: makeSourceBundle(),
    });

    const ssoUrl = draft.fields.find((f) => f.fieldId === "idp_sso_url");
    const spEntityId = draft.fields.find((f) => f.fieldId === "sp_entity_id");
    const sigAlg = draft.fields.find((f) => f.fieldId === "signature_algorithm");

    assert.equal(ssoUrl.status, "resolved", "idp_sso_url must still resolve");
    assert.equal(ssoUrl.value, "https://example.okta.com/app/sso/saml");
    assert.equal(spEntityId.status, "resolved", "sp_entity_id must still resolve");
    assert.equal(spEntityId.value, "zoom.us");
    assert.equal(sigAlg.status, "resolved", "signature_algorithm must still resolve");
    assert.equal(sigAlg.value, "SHA-256");
  });

  it("fields with no evidence fall through to UNRESOLVED (graph unavailable in test)", async () => {
    const draft = await buildCloneDuoDraft({
      sourceItems: [{ title: "How to Configure SAML 2.0 for Zoom" }],
      sourceBundle: { ...makeSourceBundle(), evidence: [] },
    });

    const allStatuses = draft.fields.map((f) => f.status);
    assert.ok(
      allStatuses.every((s) => s !== "resolved"),
      `Expected all unresolved, got: ${allStatuses.join(", ")}`
    );
    assert.ok(draft.fields.length > 0);
  });
});
