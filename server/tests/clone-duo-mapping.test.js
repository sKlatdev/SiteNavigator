import assert from "node:assert/strict";
import test from "node:test";

import { buildCloneDuoDraft } from "../src/cloneDuoMapping.js";

function makeSourceBundle() {
  return {
    schemaVersion: 1,
    createdAt: "2026-03-26T00:00:00.000Z",
    sourcePages: [
      {
        id: "source_page_1",
        title: "How to Configure SAML 2.0 for Zoom",
        url: "https://saml-doc.okta.com/SAML_Docs/How-to-Configure-SAML-2.0-for-Zoom.us.html",
        vendor: "Okta",
        category: "competitor_docs",
        summary: "Zoom SAML configuration steps.",
      },
    ],
    evidence: [
      {
        id: "ev_1_heading",
        sourcePageId: "source_page_1",
        type: "heading_block",
        headingPath: ["Configuration Steps"],
        ordinal: 1,
        text: "Configuration Steps",
        extractedFields: [],
        sourceUrl: "https://example.test/zoom",
        citationLabel: "Configuration Steps · block 1",
      },
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
      {
        id: "ev_4_screenshot",
        sourcePageId: "source_page_1",
        type: "screenshot_block",
        headingPath: ["Configuration Steps"],
        ordinal: 4,
        text: "Enter SAML config values",
        extractedFields: [],
        sourceUrl: "https://example.test/zoom",
        citationLabel: "Configuration Steps · block 4",
        screenshotUrl: "https://example.test/zoom.png",
        screenshotAltOrCaption: "Zoom configuration screen",
      },
    ],
  };
}

test("buildCloneDuoDraft resolves extracted SAML values and attaches screenshots to sections", async () => {
  const draft = await buildCloneDuoDraft({
    sourceItems: [{ title: "How to Configure SAML 2.0 for Zoom" }],
    sourceBundle: makeSourceBundle(),
  });

  const ssoUrl = draft.fields.find((field) => field.fieldId === "idp_sso_url");
  const spEntityId = draft.fields.find((field) => field.fieldId === "sp_entity_id");
  const signatureAlgorithm = draft.fields.find((field) => field.fieldId === "signature_algorithm");
  const supportedFlows = draft.fields.find((field) => field.fieldId === "supported_flows");

  assert.equal(ssoUrl.status, "resolved");
  assert.equal(ssoUrl.value, "https://example.okta.com/app/sso/saml");
  assert.equal(spEntityId.status, "resolved");
  assert.equal(spEntityId.value, "zoom.us");
  assert.equal(signatureAlgorithm.status, "resolved");
  assert.equal(signatureAlgorithm.value, "SHA-256");
  assert.equal(supportedFlows.status, "resolved");
  assert.deepEqual(supportedFlows.value, ["SP-initiated SSO", "IdP-initiated SSO", "JIT Provisioning"]);

  const screenshotAttachment = draft.screenshotAttachments.find((attachment) => attachment.evidenceId === "ev_4_screenshot");
  assert.ok(screenshotAttachment, "expected screenshot attachment");
  assert.equal(screenshotAttachment.sectionId, "configure_single_sign_on");
});

test("buildCloneDuoDraft marks missing org-specific values unresolved with recommendations", async () => {
  const draft = await buildCloneDuoDraft({
    sourceItems: [{ title: "How to Configure SAML 2.0 for Zoom" }],
    sourceBundle: makeSourceBundle(),
  });

  const acsField = draft.fields.find((field) => field.fieldId === "sp_acs_url");
  assert.equal(acsField.status, "unresolved_needs_user_input");
  assert.match(acsField.unresolved.recommendedValueOrPattern, /Assertion Consumer Service URL/i);

  const blockingIssue = draft.issues.find((issue) => issue.fieldId === "sp_acs_url");
  assert.ok(blockingIssue, "expected blocking issue for unresolved ACS field");
  assert.equal(blockingIssue.blocking, true);
});