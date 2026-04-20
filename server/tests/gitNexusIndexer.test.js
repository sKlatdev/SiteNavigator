// server/tests/gitNexusIndexer.test.js
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import path from "node:path";
import os from "node:os";
import fs from "node:fs";
import { isIndexed, getIndexProgress } from "../src/gitNexusIndexer.js";

describe("gitNexusIndexer", () => {
  it("isIndexed returns false when .gitnexus dir does not exist", () => {
    const docsDir = path.join(os.tmpdir(), "gitnexus-test-" + Date.now());
    assert.equal(isIndexed(docsDir), false);
  });

  it("isIndexed returns true when .gitnexus dir exists", () => {
    const docsDir = path.join(os.tmpdir(), "gitnexus-test-" + Date.now());
    fs.mkdirSync(path.join(docsDir, ".gitnexus"), { recursive: true });
    assert.equal(isIndexed(docsDir), true);
    fs.rmSync(docsDir, { recursive: true });
  });

  it("getIndexProgress returns idle state initially", () => {
    const state = getIndexProgress();
    assert.equal(state.phase, "idle");
    assert.equal(state.inProgress, false);
  });
});
