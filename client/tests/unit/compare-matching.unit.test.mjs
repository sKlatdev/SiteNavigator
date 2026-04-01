import test from "node:test";
import assert from "node:assert/strict";

import {
  buildRelatedMatchDiagnostics,
  buildRelatedVendorBuckets,
  findRelatedCompareItems,
  relationScore,
} from "../../src/features/sitenavigator/compareMatching.js";

test("relationScore rejects generic SSO docs when anchor tokens do not overlap", () => {
  const seed = {
    title: "Single Sign-On for Cisco ASA with Secure Client | Cisco Duo",
    summary: "Duo can provide two-factor authentication for Cisco Adaptive Security Appliance (ASA) Secure Client single sign-on logins.",
    pathSummary: "duo.com/docs/sso-ciscoasa",
    url: "https://duo.com/docs/sso-ciscoasa",
    category: "docs",
    vendor: "Duo",
  };

  const genericCandidate = {
    title: "Configure AWS IAM Identity Center (successor to AWS Single Sign-On) for Single sign-on with Microsoft Entra ID",
    summary: "Learn how to configure single sign-on between Microsoft Entra ID and AWS IAM Identity Center.",
    pathSummary: "learn.microsoft.com/en-us/entra/identity",
    url: "https://learn.microsoft.com/en-us/entra/identity/saas-apps/aws-single-sign-on-tutorial",
    category: "competitor_docs",
    vendor: "Entra",
  };

  const result = relationScore(seed, genericCandidate);
  assert.equal(result.score, 0);
});

test("findRelatedCompareItems prioritizes Cisco-specific competitor docs and removes duplicates", () => {
  const seed = {
    id: "seed",
    title: "Single Sign-On for Cisco ASA with Secure Client | Cisco Duo",
    summary: "Duo can provide two-factor authentication for Cisco Adaptive Security Appliance (ASA) Secure Client single sign-on logins.",
    pathSummary: "duo.com/docs/sso-ciscoasa",
    url: "https://duo.com/docs/sso-ciscoasa",
    category: "docs",
    vendor: "Duo",
    quality: { indexable: true, contentType: "article", navigationHeavy: false },
  };

  const candidates = [
    {
      id: "entra-cisco",
      title: "Configure Cisco Secure Firewall - Secure Client for Single sign-on with Microsoft Entra ID",
      summary: "Learn how to configure single sign-on between Microsoft Entra ID and Cisco Secure Firewall - Secure Client.",
      pathSummary: "learn.microsoft.com/en-us/entra/identity",
      url: "https://learn.microsoft.com/en-us/entra/identity/saas-apps/cisco-secure-firewall-secure-client",
      category: "competitor_docs",
      vendor: "Entra",
      quality: { indexable: true, contentType: "article", navigationHeavy: false },
    },
    {
      id: "okta-cisco",
      title: "How to Configure SAML 2.0 for Cisco ASA VPN",
      summary: "Okta SAML configuration for Cisco ASA VPN.",
      pathSummary: "saml-doc.okta.com/SAML_Docs/How-to-Configure-SAML-2.0-for-Cisco-ASA-VPN.html",
      url: "https://saml-doc.okta.com/SAML_Docs/How-to-Configure-SAML-2.0-for-Cisco-ASA-VPN.html",
      category: "competitor_docs",
      vendor: "Okta",
      quality: { indexable: true, contentType: "article", navigationHeavy: false },
    },
    {
      id: "entra-aws",
      title: "Configure AWS IAM Identity Center (successor to AWS Single Sign-On) for Single sign-on with Microsoft Entra ID",
      summary: "Learn how to configure single sign-on between Microsoft Entra ID and AWS IAM Identity Center.",
      pathSummary: "learn.microsoft.com/en-us/entra/identity",
      url: "https://learn.microsoft.com/en-us/entra/identity/saas-apps/aws-single-sign-on-tutorial",
      category: "competitor_docs",
      vendor: "Entra",
      quality: { indexable: true, contentType: "article", navigationHeavy: false },
    },
    {
      id: "okta-cisco-dup-1",
      title: "How to Configure SAML 2.0 for Cisco ASA VPN",
      summary: "Alternate Okta page for Cisco ASA VPN setup.",
      pathSummary: "help.okta.com/en-us/content/topics/network/cisco-asa-vpn",
      url: "https://help.okta.com/en-us/content/topics/network/cisco-asa-vpn.htm",
      category: "competitor_docs",
      vendor: "Okta",
      quality: { indexable: true, contentType: "article", navigationHeavy: false },
    },
    {
      id: "okta-cisco-dup-2",
      title: "How to Configure SAML 2.0 for Cisco ASA VPN",
      summary: "Duplicate title on another Okta Cisco page.",
      pathSummary: "help.okta.com/en-us/content/topics/network/cisco-asa-vpn-advanced",
      url: "https://help.okta.com/en-us/content/topics/network/cisco-asa-vpn-advanced.htm",
      category: "competitor_docs",
      vendor: "Okta",
      quality: { indexable: true, contentType: "article", navigationHeavy: false },
    },
  ];

  const related = findRelatedCompareItems(seed, [seed, ...candidates], 4);

  assert.equal(related[0].id, "entra-cisco");
  assert.equal(related[1].id, "okta-cisco");
  assert.equal(related.some((item) => item.id === "entra-aws"), false);
  assert.equal(related.filter((item) => item.title === "How to Configure SAML 2.0 for Cisco ASA VPN").length, 1);
});

test("findRelatedCompareItems includes multiple vendor buckets when strong matches exist", () => {
  const seed = {
    id: "seed",
    title: "Single Sign-On for Cisco ASA with Secure Client | Cisco Duo",
    summary: "Duo can provide two-factor authentication for Cisco Adaptive Security Appliance (ASA) Secure Client single sign-on logins.",
    pathSummary: "duo.com/docs/sso-ciscoasa",
    url: "https://duo.com/docs/sso-ciscoasa",
    category: "docs",
    vendor: "Duo",
    quality: { indexable: true, contentType: "article", navigationHeavy: false },
  };

  const candidates = [
    {
      id: "entra-cisco",
      title: "Configure Cisco Secure Firewall - Secure Client for Single sign-on with Microsoft Entra ID",
      summary: "Learn how to configure single sign-on between Microsoft Entra ID and Cisco Secure Firewall - Secure Client.",
      pathSummary: "learn.microsoft.com/en-us/entra/identity",
      url: "https://learn.microsoft.com/en-us/entra/identity/saas-apps/cisco-secure-firewall-secure-client",
      category: "competitor_docs",
      vendor: "Entra",
      quality: { indexable: true, contentType: "article", navigationHeavy: false },
    },
    {
      id: "okta-cisco",
      title: "How to Configure SAML 2.0 for Cisco ASA VPN",
      summary: "Okta SAML configuration for Cisco ASA VPN.",
      pathSummary: "saml-doc.okta.com/SAML_Docs/How-to-Configure-SAML-2.0-for-Cisco-ASA-VPN.html",
      url: "https://saml-doc.okta.com/SAML_Docs/How-to-Configure-SAML-2.0-for-Cisco-ASA-VPN.html",
      category: "competitor_docs",
      vendor: "Okta",
      quality: { indexable: true, contentType: "article", navigationHeavy: false },
    },
    {
      id: "ping-cisco",
      title: "Configure Cisco ASA IKEv2 VPN",
      summary: "Ping Identity guidance for Cisco ASA IKEv2 VPN and secure client integration.",
      pathSummary: "docs.pingidentity.com/integrations/cisco-asa",
      url: "https://docs.pingidentity.com/integrations/cisco-asa/ping-cisco-ikev2.html",
      category: "competitor_docs",
      vendor: "Ping Identity",
      quality: { indexable: true, contentType: "article", navigationHeavy: false },
    },
    {
      id: "okta-cisco-secondary",
      title: "Test the Cisco RADIUS ASA VPN integration",
      summary: "Okta testing workflow for Cisco ASA VPN and RADIUS.",
      pathSummary: "help.okta.com/en-us/content/topics/network/cisco-radius-asa",
      url: "https://help.okta.com/en-us/content/topics/network/test-cisco-radius-asa.htm",
      category: "competitor_docs",
      vendor: "Okta",
      quality: { indexable: true, contentType: "article", navigationHeavy: false },
    },
  ];

  const related = findRelatedCompareItems(seed, [seed, ...candidates], 6);
  const firstThreeVendors = related.slice(0, 3).map((item) => item.vendor);

  assert.equal(firstThreeVendors[0], "Entra");
  assert.deepEqual(new Set(firstThreeVendors), new Set(["Entra", "Okta", "Ping Identity"]));
});

test("buildRelatedVendorBuckets groups matches by vendor and keeps strongest vendor first", () => {
  const buckets = buildRelatedVendorBuckets([
    { id: "okta-top", vendor: "Okta", title: "Okta Cisco", relationScore: 27, pinned: false },
    { id: "ping-top", vendor: "Ping Identity", title: "Ping Cisco", relationScore: 25, pinned: false },
    { id: "okta-pinned", vendor: "Okta", title: "Okta Pinned", relationScore: 21, pinned: true },
  ]);

  assert.equal(buckets[0].vendor, "Okta");
  assert.equal(buckets[0].matches[0].id, "okta-pinned");
  assert.equal(buckets[1].vendor, "Ping Identity");
});

test("buildRelatedMatchDiagnostics reports vendor counts and active filter state", () => {
  const diagnostics = buildRelatedMatchDiagnostics([
    { id: "entra-top", vendor: "Entra", title: "Entra Cisco", relationScore: 25, pinned: false },
    { id: "okta-top", vendor: "Okta", title: "Okta Cisco", relationScore: 24, pinned: true },
    { id: "ping-top", vendor: "Ping Identity", title: "Ping Cisco", relationScore: 22, pinned: false },
  ], "Ping Identity");

  assert.equal(diagnostics.totalMatches, 3);
  assert.equal(diagnostics.activeVendor, "Ping Identity");
  assert.equal(diagnostics.visibleMatches.length, 1);
  assert.equal(diagnostics.topScore, 25);
  assert.equal(diagnostics.pinnedCount, 1);
  assert.deepEqual(
    diagnostics.vendorBuckets.map((bucket) => ({ vendor: bucket.vendor, count: bucket.count, visible: bucket.visible })),
    [
      { vendor: "Entra", count: 1, visible: false },
      { vendor: "Okta", count: 1, visible: false },
      { vendor: "Ping Identity", count: 1, visible: true },
    ]
  );
});

test("buildRelatedMatchDiagnostics resolves single-vendor match sets without an all tab", () => {
  const diagnostics = buildRelatedMatchDiagnostics([
    { id: "ping-top", vendor: "Ping Identity", title: "Ping Cisco", relationScore: 22, pinned: false },
  ], "all");

  assert.equal(diagnostics.hasAllTab, false);
  assert.equal(diagnostics.activeVendor, "Ping Identity");
  assert.equal(diagnostics.visibleMatches.length, 1);
});