import assert from "node:assert/strict";
import test from "node:test";

import { buildCloneDuoExport } from "../src/cloneDuoExport.js";

test("buildCloneDuoExport packages markdown and sidecar metadata together", () => {
  const payload = buildCloneDuoExport({
    blueprintFamily: "generic_saml",
    sourceBundle: {
      sourcePages: [{ title: "Zoom", url: "https://example.test/zoom" }],
    },
    sections: [
      {
        sectionId: "overview",
        title: "Overview",
        order: 10,
        markdown: "## Overview\n\nDraft overview content.",
        evidenceIds: ["ev_1"],
      },
      {
        sectionId: "update_application_in_duo",
        title: "Update Your Cloud Application in Duo",
        order: 20,
        markdown: "## Update Your Cloud Application in Duo\n\n- Identity Provider SSO URL: https://example.okta.com/app/sso/saml",
        evidenceIds: ["ev_2"],
      },
    ],
    fields: [
      { fieldId: "idp_sso_url", status: "resolved" },
      { fieldId: "sp_acs_url", status: "unresolved_needs_user_input" },
    ],
    issues: [
      { id: "issue_1", blocking: true, status: "open" },
    ],
    screenshotAttachments: [
      {
        sectionId: "update_application_in_duo",
        reviewState: "replace_later",
        exportDisposition: "include_placeholder_note",
        evidenceId: "ev_shot_1",
      },
    ],
    reviewDecisions: [],
  });

  assert.match(payload.markdown, /## Overview/);
  assert.match(payload.markdown, /## Update Your Cloud Application in Duo/);
  assert.equal(payload.sidecar.blueprintFamily, "generic_saml");
  assert.equal(payload.sidecar.unresolvedFieldCount, 1);
  assert.equal(payload.sidecar.blockingIssueCount, 1);
  assert.deepEqual(payload.sidecar.citationIndex, {
    overview: ["ev_1"],
    update_application_in_duo: ["ev_2"],
  });
  assert.equal(payload.sidecar.screenshotAttachments[0].sectionId, "update_application_in_duo");
});