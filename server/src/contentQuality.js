function normalizeText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function resolveUrl(value, currentUrl) {
  try {
    return new URL(String(value || ""), currentUrl).toString();
  } catch {
    return "";
  }
}

function extractMetaRefreshTarget($, currentUrl) {
  const refresh = $("meta[http-equiv]")
    .toArray()
    .find((node) => normalizeText($(node).attr("http-equiv")).toLowerCase() === "refresh");
  if (!refresh) return "";

  const content = normalizeText($(refresh).attr("content"));
  const match = content.match(/url\s*=\s*(.+)$/i);
  return match ? resolveUrl(match[1], currentUrl) : "";
}

function extractBodyTarget(bodyText, currentUrl) {
  const explicitMatch = bodyText.match(/(?:relocated|moved|redirect(?:ed|ing)?)\s+to\s+(https?:\/\/[^\s)]+)/i);
  if (explicitMatch) return resolveUrl(explicitMatch[1], currentUrl);

  const fallbackMatch = bodyText.match(/https?:\/\/[^\s)]+/i);
  return fallbackMatch ? resolveUrl(fallbackMatch[0], currentUrl) : "";
}

function extractAnchorTarget($, currentUrl) {
  const anchors = $("main a[href], article a[href], body a[href]").toArray();
  for (const anchor of anchors) {
    const href = normalizeText($(anchor).attr("href"));
    if (!href || href.startsWith("#") || /^javascript:/i.test(href)) continue;
    const resolved = resolveUrl(href, currentUrl);
    if (!resolved || resolved === currentUrl) continue;
    return resolved;
  }
  return "";
}

export function detectSoftRedirectPage($, currentUrl) {
  const title = normalizeText($("title").first().text() || $("h1").first().text());
  const bodyText = normalizeText($("main, article, body").first().text());
  const metaRefreshTarget = extractMetaRefreshTarget($, currentUrl);
  const titleSignal = /^(redirect notice|page moved|page relocated)$/i.test(title);
  const relocationSignal = /page you requested has been relocated to|has been relocated to|has moved to|redirecting to|redirected to/i.test(bodyText);
  const targetUrl = metaRefreshTarget || extractBodyTarget(bodyText, currentUrl) || extractAnchorTarget($, currentUrl);

  if (metaRefreshTarget) {
    return {
      isSoftRedirect: true,
      targetUrl,
      title,
    };
  }

  if (titleSignal && relocationSignal && targetUrl) {
    return {
      isSoftRedirect: true,
      targetUrl,
      title,
    };
  }

  return {
    isSoftRedirect: false,
    targetUrl: "",
    title,
  };
}

export function isSoftRedirectRow(row) {
  const title = normalizeText(row?.title);
  const summary = normalizeText(row?.summary);
  return /^redirect notice$/i.test(title) && /relocated to|has moved to|redirect(?:ed|ing)? to/i.test(summary);
}