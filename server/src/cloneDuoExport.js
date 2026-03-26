import { buildReviewDraftSummary, nowIso } from "./cloneDuoSchemas.js";

export function buildCloneDuoExport(draft) {
  const summary = buildReviewDraftSummary(draft);
  const sectionMap = Array.isArray(draft?.sections) ? draft.sections.slice().sort((left, right) => left.order - right.order) : [];
  const markdown = sectionMap.map((section) => section.markdown).filter(Boolean).join("\n\n").trim();
  const sidecar = {
    exportId: `clone_duo_export_${Date.now()}`,
    createdAt: nowIso(),
    blueprintFamily: draft?.blueprintFamily || "generic_saml",
    sourcePages: (draft?.sourceBundle?.sourcePages || []).map((page) => ({ title: page.title, url: page.url })),
    markdownFileName: `${slugifyDraftName(draft)}.md`,
    sidecarFileName: `${slugifyDraftName(draft)}.sidecar.json`,
    unresolvedFieldCount: summary.unresolvedFieldCount,
    blockingIssueCount: summary.blockingIssueCount,
    includedSectionIds: sectionMap.map((section) => section.sectionId),
    screenshotAttachments: (draft?.screenshotAttachments || []).map((attachment) => ({
      sectionId: attachment.sectionId,
      reviewState: attachment.reviewState,
      exportDisposition: attachment.exportDisposition,
      evidenceId: attachment.evidenceId,
    })),
    citationIndex: sectionMap.reduce((accumulator, section) => {
      accumulator[section.sectionId] = section.evidenceIds;
      return accumulator;
    }, {}),
    fields: draft?.fields || [],
    issues: draft?.issues || [],
    reviewDecisions: draft?.reviewDecisions || [],
  };

  return { markdown, sidecar };
}

function slugifyDraftName(draft) {
  const base = (draft?.sourceBundle?.sourcePages || [])
    .map((page) => page.title)
    .filter(Boolean)
    .slice(0, 2)
    .join("-") || "clone-duo-draft";
  return String(base)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}