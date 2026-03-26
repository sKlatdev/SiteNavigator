export const CLONE_DUO_SCHEMA_VERSION = 1;

export const BLUEPRINT_FAMILIES = {
  GENERIC_SAML: "generic_saml",
  INTEGRATION_RUNBOOK_SAML: "integration_runbook_saml",
};

export const FIELD_STATUS = {
  RESOLVED: "resolved",
  UNRESOLVED_MISSING: "unresolved_missing",
  UNRESOLVED_AMBIGUOUS: "unresolved_ambiguous",
  UNRESOLVED_NEEDS_USER_INPUT: "unresolved_needs_user_input",
};

export const REVIEW_DECISION_STATE = {
  PENDING: "pending",
  ACCEPTED_OVERRIDE: "accepted_override",
  LEFT_UNRESOLVED: "left_unresolved",
};

const SHARED_SECTIONS = [
  {
    id: "overview",
    title: "Overview",
    order: 10,
    required: true,
    sourceSectionHints: ["overview", "contents", "supported features"],
    requiredFieldIds: ["supported_flows"],
    allowedEvidenceTypes: ["heading_block", "paragraph_block", "table_block", "note_or_warning_block"],
    narrativeGoal: "Summarize the target integration, protocol support, and notable prerequisites.",
    screenshotPolicy: "optional",
    exportHeadingDepth: 2,
  },
  {
    id: "about_duo_sso",
    title: "About Duo Single Sign-On",
    order: 20,
    required: true,
    sourceSectionHints: ["about duo single sign-on"],
    requiredFieldIds: [],
    allowedEvidenceTypes: ["paragraph_block", "note_or_warning_block"],
    narrativeGoal: "Explain how Duo Single Sign-On fits into the integration.",
    screenshotPolicy: "excluded",
    exportHeadingDepth: 2,
  },
  {
    id: "configure_single_sign_on",
    title: "Configure Single Sign-On",
    order: 30,
    required: true,
    sourceSectionHints: ["configure saml", "configuration steps", "configure single sign-on"],
    requiredFieldIds: [],
    allowedEvidenceTypes: ["ordered_step_block", "paragraph_block", "note_or_warning_block", "config_field_block", "table_block"],
    narrativeGoal: "Describe prerequisite setup steps before entering Duo-specific values.",
    screenshotPolicy: "recommended",
    exportHeadingDepth: 2,
  },
  {
    id: "create_application_in_duo",
    title: "Create Your Cloud Application in Duo",
    order: 40,
    required: true,
    sourceSectionHints: ["create your cloud application in duo", "application catalog"],
    requiredFieldIds: [],
    allowedEvidenceTypes: ["paragraph_block", "note_or_warning_block"],
    narrativeGoal: "Tell the reviewer to create the corresponding Duo SSO application and note which source values will be needed.",
    screenshotPolicy: "excluded",
    exportHeadingDepth: 2,
  },
  {
    id: "update_application_in_duo",
    title: "Update Your Cloud Application in Duo",
    order: 60,
    required: true,
    sourceSectionHints: ["update your cloud application in duo", "sign on", "advanced sign-on settings"],
    requiredFieldIds: [
      "idp_entity_id",
      "idp_sso_url",
      "idp_slo_url",
      "idp_metadata_url_or_xml",
      "idp_certificate_or_fingerprint",
      "sp_entity_id",
      "sp_acs_url",
      "sp_slo_url",
      "default_relay_state",
      "nameid_format",
      "nameid_source_attribute",
      "signature_algorithm",
      "sign_response",
      "sign_assertion",
      "assertion_encryption",
      "required_attribute_mappings",
      "role_or_group_attribute_mappings",
    ],
    allowedEvidenceTypes: ["ordered_step_block", "config_field_block", "table_block", "paragraph_block", "code_block", "note_or_warning_block"],
    narrativeGoal: "Map source IdP and SP values into the Duo SAML configuration sections, preserving unresolved placeholders when needed.",
    screenshotPolicy: "required_if_available",
    exportHeadingDepth: 2,
  },
  {
    id: "verify_sso",
    title: "Verify SSO",
    order: 70,
    required: true,
    sourceSectionHints: ["verify sso", "test it out", "notes"],
    requiredFieldIds: [],
    allowedEvidenceTypes: ["ordered_step_block", "paragraph_block", "note_or_warning_block", "screenshot_block"],
    narrativeGoal: "Describe how the reviewer or admin should validate the finished setup.",
    screenshotPolicy: "recommended",
    exportHeadingDepth: 2,
  },
  {
    id: "automated_provisioning",
    title: "Automated Provisioning",
    order: 80,
    required: false,
    sourceSectionHints: ["automated provisioning", "jit", "provisioning"],
    requiredFieldIds: [],
    allowedEvidenceTypes: ["paragraph_block", "table_block", "note_or_warning_block"],
    narrativeGoal: "Capture whether provisioning or JIT behavior is mentioned.",
    screenshotPolicy: "excluded",
    exportHeadingDepth: 2,
  },
  {
    id: "troubleshooting",
    title: "Troubleshooting",
    order: 90,
    required: false,
    sourceSectionHints: ["troubleshooting", "notes"],
    requiredFieldIds: [],
    allowedEvidenceTypes: ["paragraph_block", "note_or_warning_block", "ordered_step_block"],
    narrativeGoal: "Capture source notes, caveats, and common failure points.",
    screenshotPolicy: "optional",
    exportHeadingDepth: 2,
  },
];

const RUNBOOK_ONLY_SECTIONS = [
  {
    id: "configure_service_provider",
    title: "Configure the Service Provider",
    order: 50,
    required: true,
    sourceSectionHints: ["configure cisco", "configuration steps", "configure your service provider", "add okta", "single sign-on"],
    requiredFieldIds: ["sp_login_url"],
    allowedEvidenceTypes: ["ordered_step_block", "code_block", "config_field_block", "table_block", "paragraph_block", "note_or_warning_block"],
    narrativeGoal: "Explain the target platform or service provider steps that must be completed before returning to Duo.",
    screenshotPolicy: "required_if_available",
    exportHeadingDepth: 2,
  },
];

const REQUIRED_FIELDS = [
  createRequiredField({
    id: "supported_flows",
    label: "Supported SAML flows",
    group: "capabilities",
    valueType: "string_array",
    cardinality: "multiple",
    targetSectionId: "overview",
    extractionAliases: ["supported features", "sp-initiated", "idp-initiated", "single logout", "jit", "force authentication"],
    expectedFormatHint: "List supported behaviors like SP-initiated SSO, IdP-initiated SSO, Single Logout, JIT, or Force Authentication.",
    reviewerHelpText: "Capture all supported SAML login and logout behaviors described by the source.",
    recommendationPolicy: "source_derived",
    exportRequired: true,
  }),
  createRequiredField({
    id: "idp_entity_id",
    label: "Identity Provider Entity ID",
    group: "identity_provider",
    valueType: "string",
    cardinality: "single",
    targetSectionId: "update_application_in_duo",
    extractionAliases: ["issuer", "idp entity id", "identity provider entity id", "entity id"],
    expectedFormatHint: "Usually an entity URI or generated IdP issuer string.",
    reviewerHelpText: "The IdP issuer value the target service provider expects.",
    recommendationPolicy: "source_derived",
    exportRequired: true,
  }),
  createRequiredField({
    id: "idp_sso_url",
    label: "Identity Provider SSO URL",
    group: "identity_provider",
    valueType: "url",
    cardinality: "single",
    targetSectionId: "update_application_in_duo",
    extractionAliases: ["identity provider login url", "sign-in page url", "sso url", "sign on url", "single sign-on url"],
    expectedFormatHint: "HTTPS sign-in URL generated by the IdP.",
    reviewerHelpText: "The URL where the service provider redirects users for SAML authentication.",
    recommendationPolicy: "source_derived",
    exportRequired: true,
  }),
  createRequiredField({
    id: "idp_slo_url",
    label: "Identity Provider Single Logout URL",
    group: "identity_provider",
    valueType: "url",
    cardinality: "single",
    targetSectionId: "update_application_in_duo",
    extractionAliases: ["identity provider single logout url", "sign-out page url", "logout url", "single logout"],
    expectedFormatHint: "Optional HTTPS logout endpoint if SLO is enabled.",
    reviewerHelpText: "The IdP logout endpoint used for SP-initiated or IdP-initiated logout flows.",
    recommendationPolicy: "source_derived",
    exportRequired: false,
  }),
  createRequiredField({
    id: "idp_metadata_url_or_xml",
    label: "Identity Provider Metadata URL or XML",
    group: "identity_provider",
    valueType: "string",
    cardinality: "single",
    targetSectionId: "update_application_in_duo",
    extractionAliases: ["metadata url", "metadata xml", "download metadata", "saml metadata"],
    expectedFormatHint: "Metadata URL or XML payload used to import IdP settings.",
    reviewerHelpText: "Metadata that can populate SAML settings automatically.",
    recommendationPolicy: "source_derived",
    exportRequired: false,
  }),
  createRequiredField({
    id: "idp_certificate_or_fingerprint",
    label: "Identity Provider Certificate or Fingerprint",
    group: "identity_provider",
    valueType: "string",
    cardinality: "single",
    targetSectionId: "update_application_in_duo",
    extractionAliases: ["identity provider certificate", "signature certificate", "certificate", "fingerprint", "sha-1 fingerprint", "sha-256 fingerprint"],
    expectedFormatHint: "PEM certificate text, uploaded certificate, or certificate fingerprint.",
    reviewerHelpText: "Certificate material used to verify the IdP signature.",
    recommendationPolicy: "source_derived",
    exportRequired: true,
  }),
  createRequiredField({
    id: "sp_entity_id",
    label: "Service Provider Entity ID",
    group: "service_provider",
    valueType: "string",
    cardinality: "single",
    targetSectionId: "update_application_in_duo",
    extractionAliases: ["service provider (sp) entity id", "sp entity id", "audience uri", "entityid", "entity id"],
    expectedFormatHint: "The service provider identifier or audience URI.",
    reviewerHelpText: "The Entity ID or audience value the SP publishes for SAML.",
    recommendationPolicy: "source_derived",
    exportRequired: true,
  }),
  createRequiredField({
    id: "sp_acs_url",
    label: "Assertion Consumer Service (ACS) URL",
    group: "service_provider",
    valueType: "url",
    cardinality: "multiple",
    targetSectionId: "update_application_in_duo",
    extractionAliases: ["assertion consumer service url", "acs url", "assertionconsumerservice"],
    expectedFormatHint: "HTTPS ACS endpoint published by the service provider.",
    reviewerHelpText: "The URL where the service provider receives SAML assertions.",
    recommendationPolicy: "source_derived",
    exportRequired: true,
  }),
  createRequiredField({
    id: "sp_slo_url",
    label: "Service Provider Single Logout URL",
    group: "service_provider",
    valueType: "url",
    cardinality: "single",
    targetSectionId: "update_application_in_duo",
    extractionAliases: ["single logout url", "singlelogoutservice", "custom logout url", "logout url"],
    expectedFormatHint: "Optional HTTPS logout endpoint published by the SP.",
    reviewerHelpText: "The URL where the service provider receives SAML logout responses or requests.",
    recommendationPolicy: "source_derived",
    exportRequired: false,
  }),
  createRequiredField({
    id: "sp_login_url",
    label: "Service Provider Login URL",
    group: "service_provider",
    valueType: "url",
    cardinality: "single",
    targetSectionId: "configure_service_provider",
    extractionAliases: ["service provider login url", "base url", "login url", "domain url"],
    expectedFormatHint: "The target application's direct login URL or base URL.",
    reviewerHelpText: "The SP URL used for verification or IdP-initiated access.",
    recommendationPolicy: "source_derived",
    exportRequired: false,
  }),
  createRequiredField({
    id: "default_relay_state",
    label: "Default Relay State",
    group: "service_provider",
    valueType: "string",
    cardinality: "single",
    targetSectionId: "update_application_in_duo",
    extractionAliases: ["relaystate", "relay state", "default relay state"],
    expectedFormatHint: "RelayState value required by the SP for IdP-initiated launches.",
    reviewerHelpText: "Optional RelayState or target application value.",
    recommendationPolicy: "pattern_hint",
    exportRequired: false,
  }),
  createRequiredField({
    id: "nameid_format",
    label: "NameID Format",
    group: "saml_response",
    valueType: "string",
    cardinality: "single",
    targetSectionId: "update_application_in_duo",
    extractionAliases: ["nameid format"],
    expectedFormatHint: "Common values include emailAddress, persistent, unspecified.",
    reviewerHelpText: "The SAML NameID format expected by the service provider.",
    recommendationPolicy: "pattern_hint",
    exportRequired: true,
  }),
  createRequiredField({
    id: "nameid_source_attribute",
    label: "NameID Source Attribute",
    group: "saml_response",
    valueType: "string",
    cardinality: "single",
    targetSectionId: "update_application_in_duo",
    extractionAliases: ["nameid attribute", "nameid", "username", "email"],
    expectedFormatHint: "Usually an email, username, or immutable identifier attribute.",
    reviewerHelpText: "The user attribute sent as NameID in the SAML response.",
    recommendationPolicy: "source_derived",
    exportRequired: true,
  }),
  createRequiredField({
    id: "signature_algorithm",
    label: "Signature Algorithm",
    group: "security",
    valueType: "string",
    cardinality: "single",
    targetSectionId: "update_application_in_duo",
    extractionAliases: ["signature hash algorithm", "signature algorithm"],
    expectedFormatHint: "Often SHA-256.",
    reviewerHelpText: "The signing algorithm supported by the service provider.",
    recommendationPolicy: "source_derived",
    exportRequired: false,
  }),
  createRequiredField({
    id: "sign_response",
    label: "Sign SAML Response",
    group: "security",
    valueType: "boolean",
    cardinality: "single",
    targetSectionId: "update_application_in_duo",
    extractionAliases: ["sign response"],
    expectedFormatHint: "true or false based on SP support.",
    reviewerHelpText: "Whether the overall SAML response should be signed.",
    recommendationPolicy: "pattern_hint",
    exportRequired: false,
  }),
  createRequiredField({
    id: "sign_assertion",
    label: "Sign Assertion",
    group: "security",
    valueType: "boolean",
    cardinality: "single",
    targetSectionId: "update_application_in_duo",
    extractionAliases: ["sign assertion"],
    expectedFormatHint: "true or false based on SP support.",
    reviewerHelpText: "Whether the SAML assertion itself should be signed.",
    recommendationPolicy: "pattern_hint",
    exportRequired: false,
  }),
  createRequiredField({
    id: "assertion_encryption",
    label: "Assertion Encryption",
    group: "security",
    valueType: "string",
    cardinality: "single",
    targetSectionId: "update_application_in_duo",
    extractionAliases: ["assertion encryption", "encrypt the saml assertion", "encryption certificate"],
    expectedFormatHint: "Describe whether encrypted assertions are required and which certificate/algorithms are needed.",
    reviewerHelpText: "Assertion encryption settings or notes.",
    recommendationPolicy: "source_derived",
    exportRequired: false,
  }),
  createRequiredField({
    id: "required_attribute_mappings",
    label: "Required Attribute Mappings",
    group: "attributes",
    valueType: "mapping_list",
    cardinality: "multiple",
    targetSectionId: "update_application_in_duo",
    extractionAliases: ["attribute statements", "saml response mapping", "attributes", "display name", "variable name"],
    expectedFormatHint: "List attribute names and their mapped values.",
    reviewerHelpText: "Attributes that must be sent in the SAML assertion and what source values they map to.",
    recommendationPolicy: "source_derived",
    exportRequired: true,
  }),
  createRequiredField({
    id: "role_or_group_attribute_mappings",
    label: "Role or Group Attribute Mappings",
    group: "attributes",
    valueType: "mapping_list",
    cardinality: "multiple",
    targetSectionId: "update_application_in_duo",
    extractionAliases: ["group attribute", "user group", "role attributes", "imgroup", "role management"],
    expectedFormatHint: "Describe role or group attributes and how they map to target groups or roles.",
    reviewerHelpText: "Any group, role, or entitlement mappings required by the service provider.",
    recommendationPolicy: "source_derived",
    exportRequired: false,
  }),
];

export function createRequiredField(config) {
  return {
    requiredForBlueprintFamilies: [BLUEPRINT_FAMILIES.GENERIC_SAML, BLUEPRINT_FAMILIES.INTEGRATION_RUNBOOK_SAML],
    requiredForSourceProtocols: ["saml"],
    ...config,
  };
}

export function classifyBlueprintFamily(sourceItems = []) {
  const haystack = sourceItems
    .map((item) => [item?.title, item?.summary, item?.url].join(" "))
    .join(" ")
    .toLowerCase();

  if (/(cisco|vpn|firepower|asa|fmc|ftd)/.test(haystack)) {
    return BLUEPRINT_FAMILIES.INTEGRATION_RUNBOOK_SAML;
  }

  return BLUEPRINT_FAMILIES.GENERIC_SAML;
}

export function getBlueprintSections(blueprintFamily) {
  const shared = SHARED_SECTIONS.map((section) => ({ ...section, blueprintFamily }));
  if (blueprintFamily === BLUEPRINT_FAMILIES.INTEGRATION_RUNBOOK_SAML) {
    return [...shared, ...RUNBOOK_ONLY_SECTIONS.map((section) => ({ ...section, blueprintFamily }))]
      .sort((left, right) => left.order - right.order);
  }

  return shared.sort((left, right) => left.order - right.order);
}

export function getRequiredFields(blueprintFamily) {
  const sectionIds = new Set(getBlueprintSections(blueprintFamily).map((section) => section.id));
  return REQUIRED_FIELDS.filter((field) => sectionIds.has(field.targetSectionId));
}

export function createFieldState(field) {
  return {
    fieldId: field.id,
    label: field.label,
    group: field.group,
    targetSectionId: field.targetSectionId,
    valueType: field.valueType,
    value: field.cardinality === "multiple" ? [] : "",
    status: FIELD_STATUS.UNRESOLVED_MISSING,
    evidenceIds: [],
    expectedFormatHint: field.expectedFormatHint,
    reviewerHelpText: field.reviewerHelpText,
    unresolved: null,
  };
}

export function isBlankValue(value) {
  if (Array.isArray(value)) return value.length === 0;
  return !String(value || "").trim();
}

export function buildReviewDraftSummary(draft) {
  const fields = Array.isArray(draft?.fields) ? draft.fields : [];
  const issues = Array.isArray(draft?.issues) ? draft.issues : [];
  const unresolvedFieldCount = fields.filter((field) => field.status !== FIELD_STATUS.RESOLVED).length;
  const blockingIssueCount = issues.filter((issue) => issue.blocking && issue.status !== "resolved").length;

  return {
    unresolvedFieldCount,
    blockingIssueCount,
    readyToExport: unresolvedFieldCount === 0 && blockingIssueCount === 0,
  };
}

export function nowIso() {
  return new Date().toISOString();
}

export function createStableId(prefix, index, suffix = "") {
  const cleanSuffix = String(suffix || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
  return `${prefix}_${index}${cleanSuffix ? `_${cleanSuffix}` : ""}`;
}