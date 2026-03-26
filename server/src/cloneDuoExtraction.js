import * as cheerio from "cheerio";

import { createStableId, nowIso } from "./cloneDuoSchemas.js";

const MAX_BLOCKS_PER_PAGE = 220;

export async function buildSourceBundle(sourceItems = []) {
  const pages = [];
  const evidence = [];

  for (let index = 0; index < sourceItems.length; index += 1) {
    const item = sourceItems[index];
    const sourcePage = await extractSourcePage(item, index);
    pages.push(sourcePage.page);
    evidence.push(...sourcePage.evidence);
  }

  return {
    schemaVersion: 1,
    createdAt: nowIso(),
    sourcePages: pages,
    evidence,
  };
}

async function extractSourcePage(item, pageIndex) {
  const pageId = createStableId("source_page", pageIndex + 1, item?.id || item?.title || "page");
  const fetched = await fetchPageHtml(item?.url);
  if (!fetched.ok) {
    return buildFallbackPage(item, pageId, pageIndex, fetched.error);
  }

  const $ = cheerio.load(fetched.html);
  const container = $("main, article, .content, .main-content, body").first();
  const root = container.length ? container : $("body");
  const blocks = [];
  const headingPath = [];

  root.find("h1, h2, h3, h4, p, ol, ul, table, pre, code, img").each((nodeIndex, node) => {
    if (blocks.length >= MAX_BLOCKS_PER_PAGE) return false;

    const tagName = String(node.tagName || "").toLowerCase();
    const text = normalizeWhitespace($(node).text());

    if (tagName === "h1" || tagName === "h2" || tagName === "h3" || tagName === "h4") {
      const level = Number(tagName.slice(1));
      headingPath.splice(level - 1);
      headingPath[level - 1] = text;
      blocks.push(createBlock({
        id: createStableId("ev", nodeIndex + 1, tagName),
        sourcePageId: pageId,
        type: "heading_block",
        headingPath,
        ordinal: blocks.length + 1,
        text,
        sourceUrl: item?.url,
      }));
      return;
    }

    if (!text && tagName !== "img") return;

    if (tagName === "p") {
      blocks.push(createBlock({
        id: createStableId("ev", nodeIndex + 1, "paragraph"),
        sourcePageId: pageId,
        type: /^note:|^important:|^warning:/i.test(text) ? "note_or_warning_block" : "paragraph_block",
        headingPath,
        ordinal: blocks.length + 1,
        text,
        sourceUrl: item?.url,
      }));
      return;
    }

    if (tagName === "ol" || tagName === "ul") {
      const items = extractListItems($, node, tagName === "ol" ? [] : ["-"])
        .map((entry) => entry.text)
        .filter(Boolean);
      if (!items.length) return;

      blocks.push(createBlock({
        id: createStableId("ev", nodeIndex + 1, tagName),
        sourcePageId: pageId,
        type: tagName === "ol" ? "ordered_step_block" : "paragraph_block",
        headingPath,
        ordinal: blocks.length + 1,
        text: items.join("\n"),
        extractedFields: extractConfigFieldsFromLines(items),
        sourceUrl: item?.url,
      }));
      return;
    }

    if (tagName === "table") {
      const rows = $(node)
        .find("tr")
        .toArray()
        .map((row) =>
          $(row)
            .find("th, td")
            .toArray()
            .map((cell) => normalizeWhitespace($(cell).text()))
            .filter(Boolean)
        )
        .filter((row) => row.length);

      const extractedFields = rows
        .filter((row) => row.length >= 2)
        .map((row) => enrichExtractedField({ label: row[0], value: row.slice(1).join(" | ") }));

      blocks.push(createBlock({
        id: createStableId("ev", nodeIndex + 1, "table"),
        sourcePageId: pageId,
        type: "table_block",
        headingPath,
        ordinal: blocks.length + 1,
        text: rows.map((row) => row.join(" | ")).join("\n"),
        extractedFields,
        sourceUrl: item?.url,
      }));
      return;
    }

    if (tagName === "pre" || tagName === "code") {
      blocks.push(createBlock({
        id: createStableId("ev", nodeIndex + 1, "code"),
        sourcePageId: pageId,
        type: "code_block",
        headingPath,
        ordinal: blocks.length + 1,
        text,
        codeLanguage: tagName === "code" ? "text" : "shell",
        sourceUrl: item?.url,
      }));
      return;
    }

    if (tagName === "img") {
      const screenshotUrl = resolveUrl(item?.url, $(node).attr("src"));
      if (!screenshotUrl) return;
      const screenshotContext = normalizeWhitespace($(node).closest("figure, p, div").text() || $(node).parent().text() || "Screenshot");
      blocks.push(createBlock({
        id: createStableId("ev", nodeIndex + 1, "screenshot"),
        sourcePageId: pageId,
        type: "screenshot_block",
        headingPath,
        ordinal: blocks.length + 1,
        text: normalizeWhitespace($(node).attr("alt") || screenshotContext || "Screenshot"),
        screenshotUrl,
        screenshotAltOrCaption: normalizeWhitespace($(node).attr("alt") || ""),
        sourceUrl: item?.url,
      }));
    }
  });

  blocks.push(...extractConfigBlocksFromParagraphs(blocks, pageId, item?.url));

  return {
    page: {
      id: pageId,
      title: normalizeWhitespace($("h1").first().text()) || item?.title || "Untitled source page",
      url: item?.url || "",
      vendor: item?.vendor || "Unknown",
      category: item?.category || "competitor_docs",
      summary: normalizeWhitespace(item?.summary || $("meta[name='description']").attr("content") || ""),
      fetchedAt: nowIso(),
      extractionStatus: "fetched",
      extractionError: null,
    },
    evidence: blocks,
  };
}

function buildFallbackPage(item, pageId, pageIndex, error) {
  const blocks = [];
  const baseHeading = item?.title || `Source Page ${pageIndex + 1}`;
  blocks.push(createBlock({
    id: createStableId("ev", 1, "heading"),
    sourcePageId: pageId,
    type: "heading_block",
    headingPath: [baseHeading],
    ordinal: 1,
    text: baseHeading,
    sourceUrl: item?.url,
  }));
  if (item?.summary) {
    blocks.push(createBlock({
      id: createStableId("ev", 2, "paragraph"),
      sourcePageId: pageId,
      type: "paragraph_block",
      headingPath: [baseHeading],
      ordinal: 2,
      text: normalizeWhitespace(item.summary),
      sourceUrl: item?.url,
    }));
  }
  if (item?.pathSummary) {
    blocks.push(createBlock({
      id: createStableId("ev", 3, "paragraph"),
      sourcePageId: pageId,
      type: "paragraph_block",
      headingPath: [baseHeading],
      ordinal: 3,
      text: normalizeWhitespace(item.pathSummary),
      sourceUrl: item?.url,
    }));
  }
  blocks.push(createBlock({
    id: createStableId("ev", 4, "note"),
    sourcePageId: pageId,
    type: "note_or_warning_block",
    headingPath: [baseHeading],
    ordinal: 4,
    text: `Source fetch failed during extraction. ${String(error || "Unknown extraction error")}`,
    sourceUrl: item?.url,
  }));

  return {
    page: {
      id: pageId,
      title: item?.title || "Untitled source page",
      url: item?.url || "",
      vendor: item?.vendor || "Unknown",
      category: item?.category || "competitor_docs",
      summary: normalizeWhitespace(item?.summary || item?.pathSummary || ""),
      fetchedAt: nowIso(),
      extractionStatus: "fallback",
      extractionError: String(error || "Unknown extraction error"),
    },
    evidence: blocks,
  };
}

async function fetchPageHtml(url) {
  if (!url) {
    return { ok: false, error: "Missing URL" };
  }

  try {
    const response = await fetch(url, {
      headers: {
        "user-agent": "SiteNavigator CloneToDuo/1.0 (+https://duo.com)",
      },
      redirect: "follow",
    });
    if (!response.ok) {
      return { ok: false, error: `HTTP ${response.status}` };
    }
    return { ok: true, html: await response.text() };
  } catch (error) {
    return { ok: false, error: error?.message || "Fetch failed" };
  }
}

function extractConfigBlocksFromParagraphs(existingBlocks, sourcePageId, sourceUrl) {
  return existingBlocks
    .filter((block) => ["paragraph_block", "ordered_step_block"].includes(block.type))
    .flatMap((block, index) => {
      const lines = String(block.text || "")
        .split(/\n+/)
        .map((line) => normalizeWhitespace(line))
        .filter(Boolean);
      const extractedFields = extractConfigFieldsFromLines(lines);
      if (!extractedFields.length) return [];
      return [createBlock({
        id: createStableId("evcfg", index + 1, sourcePageId),
        sourcePageId,
        type: "config_field_block",
        headingPath: block.headingPath,
        ordinal: existingBlocks.length + index + 1,
        text: extractedFields.map((entry) => `${entry.label}: ${entry.value}`).join("\n"),
        extractedFields,
        sourceUrl,
      })];
    });
}

function extractConfigFieldsFromLines(lines) {
  const fields = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = String(lines[index] || "");
    const nextLine = String(lines[index + 1] || "");
    const match = line.match(/^([^:]{2,120}):\s*(.*)$/);
    if (!match) continue;

    const label = normalizeWhitespace(match[1]);
    const immediateValue = normalizeWhitespace(match[2]);
    const placeholderHint = detectOrgSpecificPlaceholder([immediateValue, nextLine]);
    const value = immediateValue || (placeholderHint ? "" : normalizeWhitespace(nextLine));

    fields.push(enrichExtractedField({
      label,
      value,
      placeholderHint,
    }));

    if (!immediateValue && nextLine) {
      index += 1;
    }
  }

  return fields;
}

function enrichExtractedField(entry) {
  return {
    label: normalizeWhitespace(entry.label),
    value: normalizeWhitespace(entry.value),
    placeholderHint: detectOrgSpecificPlaceholder([entry.placeholderHint, entry.value]),
  };
}

function detectOrgSpecificPlaceholder(values) {
  const combined = values
    .map((value) => normalizeWhitespace(value))
    .filter(Boolean)
    .join(" ");
  if (!combined) return "";
  if (/sign in to the okta admin|sign into the okta admin|generated for you|specific for your organization|admin dashboard/i.test(combined)) {
    return combined;
  }
  return "";
}

function extractListItems($, node, prefixParts) {
  const results = [];
  $(node)
    .children("li")
    .each((index, element) => {
      const ownText = normalizeWhitespace(
        $(element)
          .clone()
          .children("ol, ul")
          .remove()
          .end()
          .text()
      );
      const marker = node.tagName === "ol" ? `${prefixParts.length ? `${prefixParts.join("")}.` : ""}${index + 1}.` : "-";
      if (ownText) {
        results.push({ text: `${marker} ${ownText}`.trim() });
      }

      $(element)
        .children("ol, ul")
        .each((_, childList) => {
          const childPrefix = node.tagName === "ol" ? [...prefixParts, String(index + 1)] : [...prefixParts, "-"];
          results.push(...extractListItems($, childList, childPrefix));
        });
    });
  return results;
}

function createBlock(block) {
  return {
    rawHtmlSnippet: "",
    extractedFields: [],
    codeLanguage: null,
    screenshotUrl: null,
    screenshotAltOrCaption: "",
    citationLabel: createCitationLabel(block.headingPath, block.ordinal),
    ...block,
    headingPath: Array.isArray(block.headingPath) ? [...block.headingPath].filter(Boolean) : [],
  };
}

function createCitationLabel(headingPath, ordinal) {
  const lastHeading = Array.isArray(headingPath) && headingPath.length ? headingPath[headingPath.length - 1] : "Source";
  return `${lastHeading} · block ${ordinal}`;
}

function resolveUrl(baseUrl, maybeRelative) {
  if (!maybeRelative) return "";
  try {
    return new URL(maybeRelative, baseUrl).toString();
  } catch {
    return "";
  }
}

function normalizeWhitespace(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}