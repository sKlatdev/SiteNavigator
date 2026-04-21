import assert from "node:assert/strict";
import { describe, it, afterEach } from "node:test";

describe("syncEngine — shouldUseGitNexusSearch / getSelectedSearchEngine", () => {
  const origEngine = process.env.SITENAVIGATOR_SEARCH_ENGINE;

  afterEach(() => {
    if (origEngine === undefined) {
      delete process.env.SITENAVIGATOR_SEARCH_ENGINE;
    } else {
      process.env.SITENAVIGATOR_SEARCH_ENGINE = origEngine;
    }
  });

  it("defaults to auto when env var is unset", async () => {
    delete process.env.SITENAVIGATOR_SEARCH_ENGINE;
    const { getSelectedSearchEngine } = await import("../src/syncEngine.js");
    assert.equal(getSelectedSearchEngine(), "auto");
  });

  it("returns legacy when SITENAVIGATOR_SEARCH_ENGINE=legacy", async () => {
    process.env.SITENAVIGATOR_SEARCH_ENGINE = "legacy";
    const { getSelectedSearchEngine } = await import("../src/syncEngine.js");
    assert.equal(getSelectedSearchEngine(), "legacy");
  });

  it("returns gitnexus when SITENAVIGATOR_SEARCH_ENGINE=gitnexus", async () => {
    process.env.SITENAVIGATOR_SEARCH_ENGINE = "gitnexus";
    const { getSelectedSearchEngine } = await import("../src/syncEngine.js");
    assert.equal(getSelectedSearchEngine(), "gitnexus");
  });

  it("shouldUseGitNexusSearch returns false when engine is legacy", async () => {
    process.env.SITENAVIGATOR_SEARCH_ENGINE = "legacy";
    const { shouldUseGitNexusSearch } = await import("../src/syncEngine.js");
    assert.equal(shouldUseGitNexusSearch(), false);
  });

  it("shouldUseGitNexusSearch returns true when engine is gitnexus", async () => {
    process.env.SITENAVIGATOR_SEARCH_ENGINE = "gitnexus";
    const { shouldUseGitNexusSearch } = await import("../src/syncEngine.js");
    assert.equal(shouldUseGitNexusSearch(), true);
  });

  it("shouldUseGitNexusSearch returns true when engine is auto", async () => {
    delete process.env.SITENAVIGATOR_SEARCH_ENGINE;
    const { shouldUseGitNexusSearch } = await import("../src/syncEngine.js");
    assert.equal(shouldUseGitNexusSearch(), true);
  });
});
