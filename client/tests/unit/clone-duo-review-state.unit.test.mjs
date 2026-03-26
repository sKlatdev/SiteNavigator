import test from "node:test";
import assert from "node:assert/strict";

import {
  applyFieldOverride,
  markIssueResolved,
  summarizeDraftState,
} from "../../src/features/sitenavigator/cloneDuo/cloneDuoReviewState.js";

test("summarizeDraftState counts unresolved fields and blocking issues", () => {
  const summary = summarizeDraftState(
    [
      { fieldId: "idp_sso_url", status: "resolved" },
      { fieldId: "sp_acs_url", status: "unresolved_needs_user_input" },
    ],
    [
      { id: "issue_1", blocking: true, status: "open" },
      { id: "issue_2", blocking: false, status: "open" },
    ]
  );

  assert.deepEqual(summary, {
    unresolvedFieldCount: 1,
    blockingIssueCount: 1,
    readyToExport: false,
  });
});

test("applyFieldOverride resolves the field and appends a review decision", () => {
  const next = applyFieldOverride(
    {
      fields: [
        {
          fieldId: "sp_acs_url",
          status: "unresolved_needs_user_input",
          unresolved: {
            reviewerEnteredValue: "https://service.example.com/saml/acs",
            reviewerDecisionState: "pending",
          },
        },
      ],
      issues: [],
      reviewDecisions: [],
    },
    "sp_acs_url"
  );

  assert.equal(next.fields[0].status, "resolved");
  assert.equal(next.fields[0].value, "https://service.example.com/saml/acs");
  assert.equal(next.fields[0].unresolved.reviewerDecisionState, "accepted_override");
  assert.equal(next.reviewDecisions.length, 1);
  assert.equal(next.summary.readyToExport, true);
});

test("markIssueResolved updates issue state and summary", () => {
  const next = markIssueResolved(
    {
      fields: [{ fieldId: "idp_sso_url", status: "resolved" }],
      issues: [{ id: "issue_1", blocking: true, status: "open" }],
    },
    "issue_1"
  );

  assert.equal(next.issues[0].status, "resolved");
  assert.equal(next.summary.blockingIssueCount, 0);
  assert.equal(next.summary.readyToExport, true);
});