import { MODULE_TYPES } from "./constants.js";

export const isArray = Array.isArray;
export const nowIso = () => new Date().toISOString();

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function readStorage(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

export function createTemplateModule(type = MODULE_TYPES.ADDON, name = "New module") {
  return {
    id: `mod_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    name: name.trim() || "New module",
    type: type === MODULE_TYPES.CORE ? MODULE_TYPES.CORE : MODULE_TYPES.ADDON,
    items: [],
  };
}

export function getFocusableElements(container) {
  if (!container) return [];
  return Array.from(container.querySelectorAll(FOCUSABLE_SELECTOR)).filter(
    (el) => !el.hasAttribute("disabled") && el.getAttribute("aria-hidden") !== "true"
  );
}

export function mergeById(current, incoming) {
  const map = new Map();
  current.forEach((i) => map.set(i.id, i));
  incoming.forEach((i) => map.set(i.id, i));
  return Array.from(map.values());
}

export function daysSince(iso) {
  if (!iso) return 9999;
  const then = new Date(iso).getTime();
  const now = Date.now();
  return Math.floor((now - then) / (1000 * 60 * 60 * 24));
}

export function downloadJson(filename, object) {
  const blob = new Blob([JSON.stringify(object, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function selectCls() {
  return "glass-control text-slate-900 dark:text-slate-100";
}

export function normalizeLabel(label) {
  return (label || "").trim().toLowerCase();
}

export function getTemplateItemKey(item) {
  if (item?.sourceRefId) return `ref:${item.sourceRefId}`;
  return `lbl:${normalizeLabel(item?.label)}`;
}

export function toTemplateItemFromContent(content, sourceType = "catalog") {
  return {
    id: `ti_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    label: content.title,
    sourceType,
    sourceRefId: content.id || null,
    sourceUrl: content.url || "",
  };
}

export function normalizeQualityMetadata(rawQuality) {
  return rawQuality && typeof rawQuality === "object"
    ? {
        indexable: rawQuality.indexable !== false,
        contentType: String(rawQuality.contentType || rawQuality.content_type || "article") || "article",
        navigationHeavy: Boolean(rawQuality.navigationHeavy ?? rawQuality.navigation_heavy),
        redirectTarget: String(rawQuality.redirectTarget || rawQuality.redirect_target || ""),
      }
    : {
        indexable: true,
        contentType: "article",
        navigationHeavy: false,
        redirectTarget: "",
      };
}

export function getQualityPresentation(rawQuality) {
  const quality = normalizeQualityMetadata(rawQuality);
  const isSoftRedirect = quality.contentType === "soft_redirect" || quality.indexable === false;
  const isHub = quality.contentType === "hub";

  if (isSoftRedirect) {
    return {
      quality,
      label: "Soft redirect",
      tone: "amber",
      helper:
        quality.redirectTarget
          ? "Redirect-style page; follow the canonical target for substantive content."
          : "Redirect-style or placeholder page with low standalone value.",
      badges: [{ key: "soft_redirect", label: "Soft redirect", tone: "amber" }],
      redirectTarget: quality.redirectTarget,
    };
  }

  if (isHub || quality.navigationHeavy) {
    return {
      quality,
      label: "Hub page",
      tone: "sky",
      helper: "Navigation-heavy overview page; useful for discovery, weaker as a direct match.",
      badges: [{ key: "hub", label: "Hub page", tone: "sky" }],
      redirectTarget: quality.redirectTarget,
    };
  }

  return {
    quality,
    label: "Article",
    tone: "emerald",
    helper: "Article-quality content; preferred for direct topic coverage and comparison.",
    badges: [{ key: "article", label: "Article", tone: "emerald" }],
    redirectTarget: quality.redirectTarget,
  };
}

export function mapIndexedToCatalogItem(item) {
  const rawUrl = String(item.url || "");
  const isOkta = /https?:\/\/(?:[^/]*\.)?(?:help|saml-doc)\.okta\.com\//i.test(rawUrl);
  const isPing = rawUrl.includes("docs.pingidentity.com");
  const isEntra = /learn\.microsoft\.com\/(?:[a-z]{2}-[a-z]{2}\/)?entra\/identity\/saas-apps/i.test(rawUrl);
  const vendor = item.vendor || (isOkta ? "Okta" : isPing ? "Ping Identity" : isEntra ? "Entra" : "Duo");
  const baseTags = Array.isArray(item.tags) && item.tags.length ? item.tags : [vendor];
  const derivedTags = [];

  try {
    const urlObj = new URL(String(item.url || ""));
    const path = urlObj.pathname.toLowerCase();
    if (vendor === "Okta" && (path === "/wf" || path.startsWith("/wf/"))) {
      derivedTags.push("Workflow");
    }
  } catch {
    // Keep mapping resilient to malformed URLs.
  }

  const tags = Array.from(new Set([...baseTags, vendor, ...derivedTags, item.category || "other"]));
  const quality = normalizeQualityMetadata(item?.quality);

  return {
    id: item.id,
    title: item.title || "Untitled",
    summary: item.summary || item.pathSummary || "No summary available yet.",
    updated: item.pageLastUpdated || item.updatedAt?.slice(0, 10) || "",
    pageLastUpdated:
      item.pageLastUpdated || item.updatedAt?.slice(0, 10) || "",
    url: item.url || "https://duo.com",
    category: item.category || "other",
    pathSummary: item.pathSummary || "",
    recentlyUpdated: !!item.recentlyUpdated,
    recentReason: item.recentReason || "none",
    author: vendor,
    vendor,
    tags,
    quality,
  };
}

export function categoryLabel(cat) {
  if (cat === "blog") return "Blog";
  if (cat === "docs") return "Docs";
  if (cat === "release_notes") return "Release Notes";
  if (cat === "guides") return "Guides";
  if (cat === "resources") return "Resources";
  if (cat === "help_kb") return "Help/KB Articles";
  if (cat === "demos") return "Demos";
  if (cat === "ecosystem_marketplace") return "Ecosystem/Marketplace";
  if (cat === "competitor_docs") return "Competitor Documentation";
  return "Other";
}

export function normalizeTemplateModules(template) {
  const incomingModules = isArray(template?.modules) ? template.modules : [];
  const fallbackItems = isArray(template?.items) ? template.items : [];
  const cleanedModules = incomingModules
    .map((module, idx) => ({
      id: module?.id || `mod_${idx}_${Date.now()}`,
      name: (module?.name || (module?.type === MODULE_TYPES.CORE ? "Core" : "Add-on")).trim(),
      type: module?.type === MODULE_TYPES.CORE ? MODULE_TYPES.CORE : MODULE_TYPES.ADDON,
      items: isArray(module?.items) ? module.items : [],
    }))
    .filter((module) => module.name);

  const hasCore = cleanedModules.some((module) => module.type === MODULE_TYPES.CORE);
  if (!hasCore) {
    cleanedModules.unshift({
      id: "mod_core",
      name: "Core",
      type: MODULE_TYPES.CORE,
      items: fallbackItems,
    });
  } else if (fallbackItems.length) {
    const coreIndex = cleanedModules.findIndex((module) => module.type === MODULE_TYPES.CORE);
    if (coreIndex >= 0 && !(cleanedModules[coreIndex].items || []).length) {
      cleanedModules[coreIndex] = { ...cleanedModules[coreIndex], items: fallbackItems };
    }
  }

  return cleanedModules;
}

export function getTemplateItemsWithModule(template) {
  return normalizeTemplateModules(template).flatMap((module) =>
    (module.items || []).map((item) => ({
      ...item,
      moduleId: module.id,
      moduleName: module.name,
      moduleType: module.type,
    }))
  );
}

export function flattenTemplateItems(template) {
  return getTemplateItemsWithModule(template).map((entry) => {
    const item = { ...entry };
    delete item.moduleId;
    delete item.moduleName;
    delete item.moduleType;
    return item;
  });
}

export function ensureTemplateShape(template) {
  const modules = normalizeTemplateModules(template);
  return {
    ...template,
    modules,
    items: flattenTemplateItems({ ...template, modules }),
  };
}

export function ensureCustomerShape(customer) {
  return {
    ...customer,
    owner: customer?.owner || "",
    watchers: isArray(customer?.watchers) ? customer.watchers : [],
    comments: isArray(customer?.comments) ? customer.comments : [],
    assignedTemplates: customer?.assignedTemplates || {},
  };
}

export function addTemplateItemToModule(template, item) {
  const modules = normalizeTemplateModules(template);
  const coreIndex = modules.findIndex((module) => module.type === MODULE_TYPES.CORE);
  const insertIndex = coreIndex >= 0 ? coreIndex : 0;
  const target = modules[insertIndex] || createTemplateModule(MODULE_TYPES.CORE, "Core");
  const nextModules = [...modules];
  nextModules[insertIndex] = {
    ...target,
    items: [...(target.items || []), item],
  };
  return ensureTemplateShape({ ...template, modules: nextModules });
}
