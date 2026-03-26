export function summarizeDraftState(fields = [], issues = []) {
  const unresolvedFieldCount = fields.filter((field) => field.status !== "resolved").length;
  const blockingIssueCount = issues.filter((issue) => issue.blocking && issue.status !== "resolved").length;
  return {
    unresolvedFieldCount,
    blockingIssueCount,
    readyToExport: unresolvedFieldCount === 0 && blockingIssueCount === 0,
  };
}

export function applyFieldOverride(currentDraft, fieldId) {
  if (!currentDraft) return currentDraft;

  const fields = currentDraft.fields.map((field) => {
    if (field.fieldId !== fieldId) return field;
    const overrideValue = field.unresolved?.reviewerEnteredValue;
    if (!String(overrideValue || "").trim()) return field;
    return {
      ...field,
      status: "resolved",
      value: overrideValue,
      unresolved: {
        ...field.unresolved,
        reviewerDecisionState: "accepted_override",
      },
    };
  });

  return {
    ...currentDraft,
    fields,
    reviewDecisions: [
      ...(currentDraft.reviewDecisions || []),
      {
        id: `decision_${Date.now()}_${fieldId}`,
        targetType: "field",
        targetId: fieldId,
        action: "accept_override",
        beforeValue: null,
        afterValue: fields.find((field) => field.fieldId === fieldId)?.value || "",
        note: "Reviewer accepted manual override.",
        decidedAt: new Date().toISOString(),
      },
    ],
    summary: summarizeDraftState(fields, currentDraft.issues || []),
  };
}

export function markIssueResolved(currentDraft, issueId) {
  if (!currentDraft) return currentDraft;
  const issues = currentDraft.issues.map((issue) =>
    issue.id === issueId ? { ...issue, status: "resolved" } : issue
  );
  return {
    ...currentDraft,
    issues,
    summary: summarizeDraftState(currentDraft.fields || [], issues),
  };
}