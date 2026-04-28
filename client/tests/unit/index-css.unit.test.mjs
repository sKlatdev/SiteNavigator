import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "fs";
import { join } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = join(__filename, "..");

test("index.css exists and can be read", () => {
  const indexCssPath = join(__dirname, "../../src/index.css");
  const content = readFileSync(indexCssPath, "utf-8");
  assert.ok(content.length > 0, "index.css should contain content");
});

test("index.css does not import Google Fonts CDN", () => {
  const indexCssPath = join(__dirname, "../../src/index.css");
  const content = readFileSync(indexCssPath, "utf-8");

  assert.doesNotMatch(
    content,
    /fonts\.googleapis\.com/,
    "index.css should not import Google Fonts CDN"
  );
});

test("index.css includes Tailwind directives", () => {
  const indexCssPath = join(__dirname, "../../src/index.css");
  const content = readFileSync(indexCssPath, "utf-8");

  const tailwindDirectives = ["@tailwind base", "@tailwind components", "@tailwind utilities"];

  for (const directive of tailwindDirectives) {
    assert.match(
      content,
      new RegExp(directive),
      `index.css should include ${directive}`
    );
  }
});

test("index.css includes glass escape hatch classes", () => {
  const indexCssPath = join(__dirname, "../../src/index.css");
  const content = readFileSync(indexCssPath, "utf-8");

  const glassClasses = [
    ".glass-surface",
    ".glass-control",
    ".glass-nav-item",
    ".glass-nav-item-active",
  ];

  for (const glassClass of glassClasses) {
    assert.match(
      content,
      new RegExp(glassClass),
      `index.css should include ${glassClass} escape hatch`
    );
  }
});

test("index.css maps .glass-surface to .panel via @apply", () => {
  const indexCssPath = join(__dirname, "../../src/index.css");
  const content = readFileSync(indexCssPath, "utf-8");

  assert.match(
    content,
    /\.glass-surface\s*{\s*@apply panel/,
    "index.css should map .glass-surface to .panel via @apply"
  );
});

test("index.css maps .glass-control to .control via @apply", () => {
  const indexCssPath = join(__dirname, "../../src/index.css");
  const content = readFileSync(indexCssPath, "utf-8");

  assert.match(
    content,
    /\.glass-control\s*{\s*@apply control/,
    "index.css should map .glass-control to .control via @apply"
  );
});

test("index.css maps .glass-nav-item to .nav-item via @apply", () => {
  const indexCssPath = join(__dirname, "../../src/index.css");
  const content = readFileSync(indexCssPath, "utf-8");

  assert.match(
    content,
    /\.glass-nav-item\s*{\s*@apply nav-item/,
    "index.css should map .glass-nav-item to .nav-item via @apply"
  );
});

test("index.css includes .glass-surface-static with no backdrop-filter", () => {
  const indexCssPath = join(__dirname, "../../src/index.css");
  const content = readFileSync(indexCssPath, "utf-8");

  assert.match(
    content,
    /\.glass-surface-static\s*{\s*background.*backdrop-filter:\s*none/s,
    "index.css should define .glass-surface-static without backdrop-filter"
  );
});

test("index.css includes type utility classes", () => {
  const indexCssPath = join(__dirname, "../../src/index.css");
  const content = readFileSync(indexCssPath, "utf-8");

  const typeClasses = [
    ".type-display",
    ".type-title",
    ".type-card-title",
    ".type-label",
    ".type-micro",
  ];

  for (const typeClass of typeClasses) {
    assert.match(
      content,
      new RegExp(typeClass),
      `index.css should include ${typeClass}`
    );
  }
});

test("index.css includes text color utility classes", () => {
  const indexCssPath = join(__dirname, "../../src/index.css");
  const content = readFileSync(indexCssPath, "utf-8");

  const colorClasses = [
    ".text-glass-primary",
    ".text-glass-secondary",
  ];

  for (const colorClass of colorClasses) {
    assert.match(
      content,
      new RegExp(colorClass),
      `index.css should include ${colorClass}`
    );
  }
});

test("index.css includes background and text accent classes", () => {
  const indexCssPath = join(__dirname, "../../src/index.css");
  const content = readFileSync(indexCssPath, "utf-8");

  assert.match(content, /\.bg-accent/, "index.css should include .bg-accent");
  assert.match(content, /\.text-accent/, "index.css should include .text-accent");
});
