import {
  BLUEPRINT_FAMILIES,
  FIELD_STATUS,
  REVIEW_DECISION_STATE,
  buildReviewDraftSummary,
  classifyBlueprintFamily,
  createFieldState,
  createStableId,
  getBlueprintSections,
  getRequiredFields,
  nowIso,
} from "./cloneDuoSchemas.js";
import { enhanceCloneDuoDraft } from "./cloneDuoGeneration.js";

const URL_PATTERN = /https?:\/\/[^\s)]+/gi;

export async function buildCloneDuoDraft({ sourceItems = [], sourceBundle, blueprintFamily }) {
  const resolvedBlueprintFamily =
    blueprintFamily || classifyBlueprintFamily(sourceItems.length ? sourceItems : sourceBundle?.sourcePages || []);
  const sections = getBlueprintSections(resolvedBlueprintFamily);
  const fieldDefinitions = getRequiredFields(resolvedBlueprintFamily);
  const evidence = Array.isArray(sourceBundle?.evidence) ? sourceBundle.evidence : [];

  const fieldStates = fieldDefinitions.map((field) => resolveFieldState(field, evidence));
  const screenshotAttachments = mapScreenshotAttachments(sections, evidence);
  const sectionDrafts = sections.map((section) => buildSectionDraft(section, fieldStates, evidence, screenshotAttachments, sourceBundle));
  const issues = buildTransformIssues(fieldStates, sectionDrafts, screenshotAttachments);
  const summary = buildReviewDraftSummary({ fields: fieldStates, issues });

  const baseDraft = {
    schemaVersion: 1,
    draftId: createStableId("clone_draft", Date.now(), resolvedBlueprintFamily),
    createdAt: nowIso(),
    updatedAt: nowIso(),
    protocol: "saml",
    blueprintFamily: resolvedBlueprintFamily,
    sourceBundle,
    sections: sectionDrafts,
    fields: fieldStates,
    screenshotAttachments,
    issues,
    reviewDecisions: [],
    summary,
  };

  return enhanceCloneDuoDraft(baseDraft);
}

function resolveFieldState(field, evidence) {
  const state = createFieldState(field);
  const candidates = collectCandidates(field, evidence);

  if (!candidates.length) {
    return applyUnresolvedState(state, field, evidence);
  }

  const uniqueValues = uniqueCandidateValues(candidates);
  if (uniqueValues.length > 1 && field.cardinality !== "multiple") {
    state.status = FIELD_STATUS.UNRESOLVED_AMBIGUOUS;
    state.evidenceIds = candidates.map((candidate) => candidate.evidenceId);
    state.unresolved = {
      fieldId: field.id,
      status: FIELD_STATUS.UNRESOLVED_AMBIGUOUS,
      rationale: "Multiple conflicting values were extracted from source evidence.",
      recommendedValueOrPattern: null,
      recommendationConfidence: "low",
      fillPrompt: `Choose the correct value for ${field.label}.`,
      evidenceIds: state.evidenceIds,
      reviewerEnteredValue: "",
      reviewerDecisionState: REVIEW_DECISION_STATE.PENDING,
    };
    return state;
  }

  state.status = FIELD_STATUS.RESOLVED;
  state.evidenceIds = candidates.map((candidate) => candidate.evidenceId);
  state.value = field.cardinality === "multiple" ? uniqueValues : uniqueValues[0];
  return state;
}

function applyUnresolvedState(state, field, evidence) {
  const unresolvedStatus = /idp_|sp_|certificate|entity|acs|nameid/i.test(field.id)
    ? FIELD_STATUS.UNRESOLVED_NEEDS_USER_INPUT
    : FIELD_STATUS.UNRESOLVED_MISSING;
  const hintDetails = collectHintDetails(field, evidence);
  const recommendation = buildRecommendation(field, hintDetails.placeholderHint);
  const evidenceIds = hintDetails.evidenceIds;

  state.status = unresolvedStatus;
  state.unresolved = {
    fieldId: field.id,
    status: unresolvedStatus,
    rationale:
      unresolvedStatus === FIELD_STATUS.UNRESOLVED_NEEDS_USER_INPUT
        ? hintDetails.placeholderHint || "The public source documentation references this value but does not expose the tenant-specific value directly."
        : "No clear value was extracted from the selected source pages.",
    recommendedValueOrPattern: recommendation.value,
    recommendationConfidence: recommendation.confidence,
    fillPrompt: `Enter ${field.label.toLowerCase()} (${field.expectedFormatHint})`,
    evidenceIds,
    reviewerEnteredValue: "",
    reviewerDecisionState: REVIEW_DECISION_STATE.PENDING,
  };
  state.evidenceIds = evidenceIds;
  return state;
}

function collectCandidates(field, evidence) {
  const aliasMatchers = field.extractionAliases.map((alias) => String(alias || "").toLowerCase());
  const candidates = [];

  evidence.forEach((block) => {
    if (Array.isArray(block.extractedFields) && block.extractedFields.length) {
      block.extractedFields.forEach((entry) => {
        const label = String(entry.label || "").toLowerCase();
        if (aliasMatchers.some((alias) => label.includes(alias) || alias.includes(label))) {
          candidates.push({ value: normalizeFieldValue(field, entry.value), evidenceId: block.id });
        }
      });
    }

    const text = String(block.text || "");
    if (!text) return;

    if (field.id === "supported_flows") {
      const flows = [];
      if (/sp-initiated/i.test(text)) flows.push("SP-initiated SSO");
      if (/idp-initiated/i.test(text)) flows.push("IdP-initiated SSO");
      if (/single logout|slo/i.test(text)) flows.push("Single Logout");
      if (/jit/i.test(text)) flows.push("JIT Provisioning");
      if (/force authentication|force re-authentication/i.test(text)) flows.push("Force Authentication");
      if (flows.length) {
        candidates.push({ value: flows, evidenceId: block.id });
      }
      return;
    }

    if (["idp_sso_url", "idp_slo_url", "sp_acs_url", "sp_slo_url", "sp_login_url"].includes(field.id)) {
      const urls = text.match(URL_PATTERN) || [];
      if (urls.length && aliasMatchers.some((alias) => text.toLowerCase().includes(alias))) {
        urls.forEach((url) => candidates.push({ value: url, evidenceId: block.id }));
      }
    }

    if (field.id === "signature_algorithm") {
      const match = text.match(/sha-?256|sha-?1/i);
      if (match && aliasMatchers.some((alias) => text.toLowerCase().includes(alias))) {
        candidates.push({ value: match[0].toUpperCase().replace(/-/, "-"), evidenceId: block.id });
      }
    }

    if (["sign_response", "sign_assertion"].includes(field.id) && aliasMatchers.some((alias) => text.toLowerCase().includes(alias))) {
      if (/checked by default|enable|yes|true/i.test(text)) {
        candidates.push({ value: true, evidenceId: block.id });
      }
      if (/disable|uncheck|false|no/i.test(text)) {
        candidates.push({ value: false, evidenceId: block.id });
      }
    }

    if (field.id === "required_attribute_mappings" || field.id === "role_or_group_attribute_mappings") {
      if (/attribute|mapping|group|role/i.test(text)) {
        const mappingLines = text
          .split(/\n+/)
          .map((line) => line.trim())
          .filter((line) => /[:|]/.test(line));
        if (mappingLines.length) {
          candidates.push({ value: mappingLines, evidenceId: block.id });
        }
      }
    }
  });

  return candidates.filter((candidate) => !isEmptyCandidate(candidate.value));
}

function buildSectionDraft(section, fieldStates, evidence, screenshotAttachments, sourceBundle) {
  const sectionEvidence = filterEvidenceForSection(section, evidence);
  const sectionFields = fieldStates.filter((field) => field.targetSectionId === section.id);
  const sectionScreenshots = screenshotAttachments.filter((attachment) => attachment.sectionId === section.id);
  const markdownLines = [`## ${section.title}`, ""];

  if (section.id === "overview") {
    const sourceTitles = (sourceBundle?.sourcePages || []).map((page) => page.title).filter(Boolean);
    if (sourceTitles.length) {
      markdownLines.push(`This draft adapts the selected source documentation for ${sourceTitles.join(", ")} into a Duo Single Sign-On SAML integration guide.`);
      markdownLines.push("");
    }
  }

  if (section.id === "about_duo_sso") {
    markdownLines.push("Duo Single Sign-On acts as the SAML identity provider for this integration. Use this section to explain how Duo will broker authentication and where reviewers must confirm tenant-specific settings.");
    markdownLines.push("");
  }

  if (section.id === "create_application_in_duo") {
    markdownLines.push("Create a new Duo Single Sign-On application that matches this SAML integration. During review, confirm whether the Generic SAML Service Provider application is sufficient or whether a product-specific Duo integration exists.");
    markdownLines.push("");
  }

  if (["configure_single_sign_on", "configure_service_provider", "verify_sso", "troubleshooting", "automated_provisioning"].includes(section.id)) {
    appendEvidenceNarrative(markdownLines, sectionEvidence);
  }

  if (section.id === "update_application_in_duo") {
    markdownLines.push("Use the following SAML values when updating the Duo application. Values left unresolved should be filled during review before publication.");
    markdownLines.push("");
  }

  if (sectionFields.length) {
    markdownLines.push("### Required Fields", "");
    sectionFields.forEach((field) => {
      markdownLines.push(`- ${field.label}: ${formatFieldValue(field)}`);
      if (field.unresolved?.recommendedValueOrPattern) {
        markdownLines.push(`  Recommendation: ${field.unresolved.recommendedValueOrPattern}`);
      }
      if (field.unresolved?.rationale) {
        markdownLines.push(`  Note: ${field.unresolved.rationale}`);
      }
    });
    markdownLines.push("");
  }

  if (sectionScreenshots.length) {
    markdownLines.push("### Section Screenshots", "");
    sectionScreenshots.forEach((attachment) => {
      markdownLines.push(`- ${attachment.attachmentReason}: review state is ${attachment.reviewState}.`);
    });
    markdownLines.push("");
  }

  if (markdownLines[markdownLines.length - 1] !== "") {
    markdownLines.push("");
  }

  return {
    sectionId: section.id,
    title: section.title,
    order: section.order,
    markdown: markdownLines.join("\n").trim(),
    evidenceIds: sectionEvidence.map((block) => block.id),
    unresolvedFieldIds: sectionFields.filter((field) => field.status !== FIELD_STATUS.RESOLVED).map((field) => field.fieldId),
    screenshotAttachmentIds: sectionScreenshots.map((attachment) => attachment.id),
  };
}

function mapScreenshotAttachments(sections, evidence) {
  const hints = sections.map((section) => ({
    sectionId: section.id,
    matchers: section.sourceSectionHints.map((hint) => hint.toLowerCase()),
  }));

  return evidence
    .filter((block) => block.type === "screenshot_block")
    .map((block, index) => {
      const headingValue = block.headingPath.join(" ").toLowerCase();
      const matchedSection = hints.find((section) => section.matchers.some((hint) => headingValue.includes(hint)));
      const sectionId = matchedSection?.sectionId || "overview";
      return {
        id: createStableId("shot", index + 1, sectionId),
        sectionId,
        evidenceId: block.id,
        attachmentReason: inferAttachmentReason(block),
        reviewState: "pending",
        reviewerNote: "",
        exportDisposition: "include_placeholder_note",
      };
    });
}

function buildTransformIssues(fieldStates, sectionDrafts, screenshotAttachments) {
  const issues = [];
  fieldStates.forEach((field, index) => {
    if (field.status === FIELD_STATUS.RESOLVED) return;
    issues.push({
      id: createStableId("issue", index + 1, field.fieldId),
      severity: field.status === FIELD_STATUS.UNRESOLVED_AMBIGUOUS ? "high" : "critical",
      type: field.status === FIELD_STATUS.UNRESOLVED_AMBIGUOUS ? "ambiguous_mapping" : "missing_required_field",
      fieldId: field.fieldId,
      sectionId: field.targetSectionId,
      evidenceIds: field.evidenceIds,
      summary: `${field.label} needs reviewer attention.`,
      recommendation: field.unresolved?.recommendedValueOrPattern || field.expectedFormatHint,
      blocking: true,
      status: "open",
    });
  });

  screenshotAttachments.forEach((attachment, index) => {
    issues.push({
      id: createStableId("issue_shot", index + 1, attachment.sectionId),
      severity: "low",
      type: "screenshot_review_needed",
      fieldId: null,
      sectionId: attachment.sectionId,
      evidenceIds: [attachment.evidenceId],
      summary: `Screenshot for section ${attachment.sectionId} requires review.`,
      recommendation: "Confirm whether to keep this screenshot internal, replace it later, or exclude it from export.",
      blocking: false,
      status: "open",
    });
  });

  sectionDrafts.forEach((section, index) => {
    if (!section.markdown.trim()) {
      issues.push({
        id: createStableId("issue_section", index + 1, section.sectionId),
        severity: "medium",
        type: "citation_gap",
        fieldId: null,
        sectionId: section.sectionId,
        evidenceIds: [],
        summary: `Section ${section.title} has no generated content yet.`,
        recommendation: "Review source evidence and add section narrative manually if this section is required.",
        blocking: false,
        status: "open",
      });
    }
  });

  return issues;
}

function filterEvidenceForSection(section, evidence) {
  return evidence.filter((block) => {
    const headingValue = block.headingPath.join(" ").toLowerCase();
    return section.sourceSectionHints.some((hint) => headingValue.includes(hint.toLowerCase()));
  }).slice(0, 12);
}

function appendEvidenceNarrative(lines, evidence) {
  const orderedSteps = evidence.filter((block) => block.type === "ordered_step_block");
  if (orderedSteps.length) {
    lines.push("### Procedure", "");
    orderedSteps.slice(0, 2).forEach((block) => {
      block.text
        .split(/\n+/)
        .map((line) => line.trim())
        .filter(Boolean)
        .forEach((line) => lines.push(`1. ${line}`));
    });
    lines.push("");
  }

  const paragraphs = evidence.filter((block) => ["paragraph_block", "note_or_warning_block"].includes(block.type));
  paragraphs.slice(0, 3).forEach((block) => {
    lines.push(block.text);
    lines.push("");
  });
}

function uniqueCandidateValues(candidates) {
  const values = candidates.flatMap((candidate) => Array.isArray(candidate.value) ? candidate.value : [candidate.value]);
  return Array.from(new Set(values.map((value) => JSON.stringify(value)))).map((value) => JSON.parse(value));
}

function normalizeFieldValue(field, value) {
  if (field.valueType === "boolean") {
    if (typeof value === "boolean") return value;
    return /true|yes|enable|checked/i.test(String(value || ""));
  }
  if (field.valueType === "mapping_list") {
    if (Array.isArray(value)) return value;
    return String(value || "")
      .split(/\n+/)
      .map((line) => line.trim())
      .filter(Boolean);
  }
  if (field.cardinality === "multiple") {
    return Array.isArray(value) ? value : [String(value || "").trim()].filter(Boolean);
  }
  return String(value || "").trim();
}

function isEmptyCandidate(value) {
  if (Array.isArray(value)) return value.length === 0;
  return !String(value || "").trim();
}

function collectHintDetails(field, evidence) {
  const aliasMatchers = field.extractionAliases.map((alias) => String(alias || "").toLowerCase());
  const matched = evidence
    .filter((block) => {
      const text = [block.text, ...(block.extractedFields || []).map((entry) => entry.label)].join(" ").toLowerCase();
      return aliasMatchers.some((alias) => text.includes(alias));
    })
    .slice(0, 3);

  const placeholderEntry = matched
    .flatMap((block) => block.extractedFields || [])
    .find((entry) => entry.placeholderHint);

  return {
    evidenceIds: matched.map((block) => block.id),
    placeholderHint: placeholderEntry?.placeholderHint || "",
  };
}

function buildRecommendation(field, placeholderHint = "") {
  const fieldHints = {
    idp_entity_id: { value: "Look for the generated Okta or IdP issuer in the Sign On tab or metadata file.", confidence: "medium" },
    idp_sso_url: { value: "Use the IdP-generated Sign On or Identity Provider Login URL from the admin console.", confidence: "medium" },
    idp_slo_url: { value: "Only fill this if Single Logout is enabled; use the IdP logout endpoint from metadata or the admin console.", confidence: "medium" },
    idp_certificate_or_fingerprint: { value: "Upload or paste the signing certificate from the IdP metadata or admin console.", confidence: "medium" },
    sp_entity_id: { value: "Use the service provider's SAML Entity ID or audience URI from its admin or metadata view.", confidence: "high" },
    sp_acs_url: { value: "Use the Assertion Consumer Service URL published by the service provider or shown in its SAML metadata.", confidence: "high" },
    default_relay_state: { value: "Only fill this if the service provider requires RelayState or target app routing.", confidence: "low" },
    nameid_format: { value: "Most SaaS apps use emailAddress or unspecified. Confirm in the service provider's SAML guide.", confidence: "low" },
  };

  if (placeholderHint) {
    return { value: `${placeholderHint} Confirm the exact tenant-specific value in the admin console before publishing.`, confidence: "medium" };
  }
  return fieldHints[field.id] || { value: field.expectedFormatHint, confidence: "low" };
}

function inferAttachmentReason(block) {
  const text = [block.text, ...block.headingPath].join(" ").toLowerCase();
  if (/verify|test|login/.test(text)) return "verification_screen";
  if (/setting|config|mapping|sign on/.test(text)) return "settings_panel";
  if (/warning|important|note/.test(text)) return "warning_context";
  return "step_visual";
}

function formatFieldValue(field) {
  if (field.status !== FIELD_STATUS.RESOLVED) {
    return `UNRESOLVED (${field.status.replace(/_/g, " ")})`;
  }
  if (Array.isArray(field.value)) {
    return field.value.join(", ");
  }
  return String(field.value || "");
}