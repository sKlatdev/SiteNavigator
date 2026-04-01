import assert from "node:assert/strict";
import test from "node:test";

import * as cheerio from "cheerio";

import { detectSoftRedirectPage, isSoftRedirectRow, normalizeContentQuality } from "../src/contentQuality.js";

test("detectSoftRedirectPage recognizes Ping-style relocation notices", () => {
  const html = `
    <html>
      <head><title>Redirect Notice</title></head>
      <body>
        <main>
          <h1>Redirect Notice</h1>
          <p>The page you requested has been relocated to https://docs.pingidentity.com/integrations/zscaler/pf_is_overview_of_zscaler.html</p>
          <a href="/integrations/zscaler/pf_is_overview_of_zscaler.html">New page</a>
        </main>
      </body>
    </html>
  `;

  const $ = cheerio.load(html);
  const result = detectSoftRedirectPage($, "https://docs.pingidentity.com/integrations/zscaler/index.html");

  assert.equal(result.isSoftRedirect, true);
  assert.equal(result.targetUrl, "https://docs.pingidentity.com/integrations/zscaler/pf_is_overview_of_zscaler.html");
});

test("isSoftRedirectRow only flags stored redirect notice rows", () => {
  assert.equal(
    isSoftRedirectRow({
      title: "Redirect Notice",
      summary: "The page you requested has been relocated to https://docs.pingidentity.com/integrations/x509/pf_is_overview_of_x509_i.html",
    }),
    true
  );

  assert.equal(
    isSoftRedirectRow({
      title: "X509 Connector",
      summary: "Configure X509 integration settings.",
    }),
    false
  );
});

test("normalizeContentQuality defaults legacy rows to indexable articles", () => {
  assert.deepEqual(normalizeContentQuality({ title: "Guide", summary: "Useful content" }), {
    indexable: true,
    contentType: "article",
    navigationHeavy: false,
    redirectTarget: "",
  });
});

test("normalizeContentQuality preserves explicit quality metadata", () => {
  assert.deepEqual(normalizeContentQuality({
    quality: {
      indexable: true,
      contentType: "hub",
      navigationHeavy: true,
    },
  }), {
    indexable: true,
    contentType: "hub",
    navigationHeavy: true,
    redirectTarget: "",
  });
});