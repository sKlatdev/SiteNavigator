import test from "node:test";
import assert from "node:assert/strict";

import {
  getQualityPresentation,
  normalizeQualityMetadata,
} from "../../src/features/sitenavigator/utils.js";

test("normalizeQualityMetadata defaults missing quality to indexable article", () => {
  assert.deepEqual(normalizeQualityMetadata(undefined), {
    indexable: true,
    contentType: "article",
    navigationHeavy: false,
    redirectTarget: "",
  });
});

test("getQualityPresentation classifies hub pages consistently", () => {
  const presentation = getQualityPresentation({
    indexable: true,
    contentType: "hub",
    navigationHeavy: true,
  });

  assert.equal(presentation.label, "Hub page");
  assert.equal(presentation.tone, "sky");
  assert.equal(presentation.badges[0].label, "Hub page");
  assert.match(presentation.helper, /Navigation-heavy overview page/i);
});

test("getQualityPresentation preserves redirect target context for soft redirects", () => {
  const presentation = getQualityPresentation({
    indexable: false,
    contentType: "soft_redirect",
    navigationHeavy: false,
    redirectTarget: "https://example.com/docs/canonical",
  });

  assert.equal(presentation.label, "Soft redirect");
  assert.equal(presentation.redirectTarget, "https://example.com/docs/canonical");
  assert.match(presentation.helper, /canonical target/i);
});