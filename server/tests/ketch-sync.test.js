import assert from "node:assert/strict";
import test from "node:test";

import { applySeenUrlsForVendor, isEnglishContentUrl, mapKetchResultToRow } from "../src/ketchSync.js";

test("mapKetchResultToRow preserves quality and derives competitor metadata", () => {
  const mapped = mapKetchResultToRow({
    url: "https://learn.microsoft.com/en-us/entra/identity/saas-apps/tutorial-list",
    status: "new",
    page: {
      url: "https://learn.microsoft.com/en-us/entra/identity/saas-apps/tutorial-list",
      title: "SaaS App configuration guides for Microsoft Entra ID",
      summary: "Overview page for configuration guides.",
      last_modified: "Mon, 02 Mar 2026 23:45:11 GMT",
      content_hash: "abc123",
      quality: {
        indexable: true,
        content_type: "hub",
        navigation_heavy: true,
      },
    },
  });

  assert.equal(mapped.row.vendor, "Entra");
  assert.equal(mapped.row.category, "competitor_docs");
  assert.equal(mapped.row.quality.contentType, "hub");
  assert.equal(mapped.row.quality.navigationHeavy, true);
  assert.equal(mapped.row.pageLastUpdated, "2026-03-02");
});

test("applySeenUrlsForVendor deactivates unseen rows only for the completed vendor", () => {
  const store = {
    content: [
      { url: "https://docs.pingidentity.com/a", active: true },
      { url: "https://docs.pingidentity.com/b", active: true },
      { url: "https://duo.com/docs/admin", active: true },
    ],
  };

  applySeenUrlsForVendor(
    store,
    { matchesUrl: (url) => /docs\.pingidentity\.com/i.test(String(url || "")) },
    new Set(["https://docs.pingidentity.com/b"])
  );

  assert.equal(store.content[0].active, false);
  assert.equal(store.content[1].active, true);
  assert.equal(store.content[2].active, true);
});

test("isEnglishContentUrl rejects nested non-English locale paths", () => {
  assert.equal(isEnglishContentUrl("https://help.okta.com/oie/ja-jp/content/topics/example.htm"), false);
  assert.equal(isEnglishContentUrl("https://docs.pingidentity.com/r/en-us/pingfederate-120/example"), true);
  assert.equal(isEnglishContentUrl("https://saml-doc.okta.com/SAML_Docs/How-to-Configure-SAML-2.0-for-Cisco-ASA-VPN.html"), true);
});