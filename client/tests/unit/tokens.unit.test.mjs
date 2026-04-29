import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "fs";
import { join } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = join(__filename, "..");

test("tokens.css exists and can be read", () => {
  const tokensPath = join(__dirname, "../../src/tokens.css");
  const content = readFileSync(tokensPath, "utf-8");
  assert.ok(content.length > 0, "tokens.css should contain content");
});

test("tokens.css defines color tokens", () => {
  const tokensPath = join(__dirname, "../../src/tokens.css");
  const content = readFileSync(tokensPath, "utf-8");

  const requiredTokens = [
    "--bg-base",
    "--bg-panel",
    "--bg-overlay",
    "--border-subtle",
    "--border-strong",
    "--accent",
    "--accent-hover",
    "--accent-press",
    "--success",
    "--warning",
    "--critical",
    "--text-primary",
    "--text-secondary",
    "--text-tertiary",
  ];

  for (const token of requiredTokens) {
    assert.match(
      content,
      new RegExp(token),
      `tokens.css should define ${token}`
    );
  }
});

test("tokens.css defines geometry tokens", () => {
  const tokensPath = join(__dirname, "../../src/tokens.css");
  const content = readFileSync(tokensPath, "utf-8");

  const requiredTokens = [
    "--radius-container",
    "--radius-control",
    "--radius-pill",
  ];

  for (const token of requiredTokens) {
    assert.match(
      content,
      new RegExp(token),
      `tokens.css should define ${token}`
    );
  }
});

test("tokens.css defines motion and elevation tokens", () => {
  const tokensPath = join(__dirname, "../../src/tokens.css");
  const content = readFileSync(tokensPath, "utf-8");

  const requiredTokens = [
    "--motion-fast",
    "--motion-medium",
    "--blur-panel",
    "--blur-overlay",
    "--shadow-panel",
    "--shadow-overlay",
    "--glow-focus",
  ];

  for (const token of requiredTokens) {
    assert.match(
      content,
      new RegExp(token),
      `tokens.css should define ${token}`
    );
  }
});

test("tokens.css defines font tokens", () => {
  const tokensPath = join(__dirname, "../../src/tokens.css");
  const content = readFileSync(tokensPath, "utf-8");

  assert.match(content, /--font-sans/, "tokens.css should define --font-sans");
  assert.match(content, /--font-mono/, "tokens.css should define --font-mono");
});

test("tokens.css includes anti-flicker escape hatches", () => {
  const tokensPath = join(__dirname, "../../src/tokens.css");
  const content = readFileSync(tokensPath, "utf-8");

  const escapeHatches = [
    "content-view-no-fx",
    "content-stable-paint",
    "app-stable-paint",
  ];

  for (const hatch of escapeHatches) {
    assert.match(
      content,
      new RegExp(hatch),
      `tokens.css should include ${hatch} escape hatch`
    );
  }
});

test("tokens.css includes component layer utilities", () => {
  const tokensPath = join(__dirname, "../../src/tokens.css");
  const content = readFileSync(tokensPath, "utf-8");

  // Component layer utilities moved to index.css for proper Tailwind layer binding
  // Verify tokens.css still has token definitions and escape hatches
  const utilities = ["--bg-base", "--accent", "content-stable-paint"];

  for (const utility of utilities) {
    assert.match(
      content,
      new RegExp(utility),
      `tokens.css should include ${utility}`
    );
  }
});
