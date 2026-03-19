import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  LayoutDashboard,
  Puzzle,
  PlugZap,
  BookOpen,
  FileText,
  Search,
  CheckCircle2,
  Tag,
  ClipboardList,
  Building2,
  Download,
  Upload,
  AlertTriangle,
  History,
  ExternalLink,
  X,
  Plus,
  BookMarked,
  FolderOpen,
  Menu,
  Pin,
  Settings,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import {
  apiGetContent,
  apiGetSyncStatus,
  apiRunSync,
  apiGetSyncProgress,
  apiGetIndexPathInfo,
  apiLoadIndexFromPath,
  apiSaveIndexToPath,
} from "./lib/api";
import {
  APP_SCHEMA_VERSION,
  CATALOG_TABS,
  CONTENT_VIEWS,
  MODULE_TYPES,
  STATUS,
  STATUS_OPTIONS,
  STORAGE_KEYS,
  TEMPLATE_EXPORT_SCHEMA_VERSION,
  defaultAudit,
  defaultCustomers,
  defaultIndexedContent,
  defaultTemplates,
  statusMeta,
} from "./features/sitenavigator/constants";
import {
  addTemplateItemToModule,
  categoryLabel,
  createTemplateModule,
  daysSince,
  downloadJson,
  ensureCustomerShape,
  ensureTemplateShape,
  flattenTemplateItems,
  getFocusableElements,
  getTemplateItemKey,
  getTemplateItemsWithModule,
  isArray,
  mapIndexedToCatalogItem,
  mergeById,
  normalizeTemplateModules,
  nowIso,
  readStorage,
  selectCls,
  toTemplateItemFromContent,
} from "./features/sitenavigator/utils";
import { buildDiscoveredVendorSections } from "./features/sitenavigator/vendorSections";
import {
  applyFacetModes,
  createPresetFacetTagDefinitions,
  withFacetTagCounts,
} from "./features/sitenavigator/facets";
import {
  getSearchMatchExplanation,
  getSearchPriorityBadges,
  isIncludesOnlyMatch,
  sortItemsBySearchPriority,
} from "./features/sitenavigator/searchRanking";

/** =========================================================
 * Reusable UI
 * ========================================================= */
function EmptyState({ title, text }) {
  return (
    <div className="glass-surface p-8 text-center">
      <p className="font-semibold">{title}</p>
      <p className="text-sm text-slate-500 mt-1">{text}</p>
    </div>
  );
}

function ConfirmModal({
  open,
  title,
  body,
  confirmText = "Confirm",
  onConfirm,
  onCancel,
}) {
  if (!open) return null;
  return (
    <BaseModal open={open} onClose={onCancel} title={title} widthClass="max-w-md">
      <p className="text-sm text-slate-600 dark:text-slate-300 mt-2">{body}</p>
      <div className="mt-5 flex justify-end gap-2">
        <button onClick={onCancel} className="px-3 py-2 rounded-lg border">
          Cancel
        </button>
        <button
          onClick={onConfirm}
          className="px-3 py-2 rounded-lg bg-rose-600 text-white"
        >
          {confirmText}
        </button>
      </div>
    </BaseModal>
  );
}

function BaseModal({ open, title, onClose, children, widthClass = "max-w-4xl" }) {
  const panelRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;

    const previouslyFocused = document.activeElement;
    const panel = panelRef.current;
    const focusables = getFocusableElements(panel);
    (focusables[0] || panel)?.focus();

    const onKeyDown = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== "Tab") return;

      const tabbables = getFocusableElements(panel);
      if (!tabbables.length) {
        e.preventDefault();
        panel?.focus();
        return;
      }

      const first = tabbables[0];
      const last = tabbables[tabbables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    panel?.addEventListener("keydown", onKeyDown);
    return () => {
      panel?.removeEventListener("keydown", onKeyDown);
      if (previouslyFocused && typeof previouslyFocused.focus === "function") {
        previouslyFocused.focus();
      }
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-black/40 z-50 p-4 overflow-auto flex items-center justify-center" role="presentation">
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        style={{
          background: 'var(--glass-bg)',
          border: '1.5px solid var(--glass-border)',
          boxShadow: 'var(--glass-shadow)',
          backdropFilter: 'blur(var(--glass-blur))',
          borderRadius: 'var(--glass-radius)',
          padding: 'var(--glass-card-padding)',
          transition: 'box-shadow var(--glass-motion-fast), background var(--glass-motion-slow)',
        }}
        className={`${widthClass} mx-auto focus:outline-none`}
      >
        <div className="flex items-start justify-between gap-2 mb-3">
          <h3 className="text-xl font-semibold">{title}</h3>
          <button onClick={onClose} className="p-2 rounded-lg border" aria-label="Close dialog">
            <X size={16} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function BadgeRecentlyUpdated({ recentlyUpdated, recentReason }) {
  if (!recentlyUpdated) return null;
  let label = "Page recently updated";
  if (recentReason === "new_page") label = "New page";
  if (recentReason === "changed_content") label = "Changed content";

  return (
    <span className="inline-flex shrink-0 whitespace-nowrap rounded-full bg-amber-100 px-2 py-0.5 text-[10px] text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
      {label}
    </span>
  );
}

function searchBadgeToneClass(tone) {
  if (tone === "exact_phrase") {
    return "border border-emerald-300/70 bg-emerald-100/80 text-emerald-900 dark:border-emerald-700/80 dark:bg-emerald-900/35 dark:text-emerald-200";
  }
  if (tone === "exact_token") {
    return "border border-blue-300/70 bg-blue-100/80 text-blue-900 dark:border-blue-700/80 dark:bg-blue-900/35 dark:text-blue-200";
  }
  if (tone === "partial") {
    return "border border-violet-300/70 bg-violet-100/80 text-violet-900 dark:border-violet-700/80 dark:bg-violet-900/35 dark:text-violet-200";
  }
  if (tone === "includes") {
    return "border border-amber-300/70 bg-amber-100/80 text-amber-900 dark:border-amber-700/80 dark:bg-amber-900/35 dark:text-amber-200";
  }
  if (tone === "full_match") {
    return "border border-teal-300/70 bg-teal-100/80 text-teal-900 dark:border-teal-700/80 dark:bg-teal-900/35 dark:text-teal-200";
  }
  return "border border-slate-300/70 bg-slate-100/80 text-slate-800 dark:border-slate-700/80 dark:bg-slate-900/45 dark:text-slate-200";
}

function SearchBadgePopover({ id, title, explanation, onClose, anchorRect }) {
  if (!explanation) return null;

  const top = anchorRect ? anchorRect.bottom + 8 : 0;
  const rawLeft = anchorRect ? anchorRect.left : 0;
  const left = Math.min(rawLeft, Math.max(0, window.innerWidth - 320 - 12));

  return (
    <div
      id={id}
      role="dialog"
      aria-modal="false"
      aria-label={title}
      style={{ position: "fixed", top, left, zIndex: 9999, width: 320 }}
      className="rounded-xl border border-slate-200 bg-white p-3 shadow-xl dark:border-slate-700 dark:bg-slate-950"
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <div>
          <p className="text-xs font-semibold text-slate-900 dark:text-slate-100">{title}</p>
          <p className="mt-0.5 text-[11px] text-slate-600 dark:text-slate-300">{explanation.headline}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded border border-slate-300 p-1 text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-900"
          aria-label="Close match context"
        >
          <X size={12} />
        </button>
      </div>

      <div className="mb-2 flex flex-wrap items-center gap-1.5">
        {explanation.groups.map((group) => (
          <span
            key={group.field}
            className="rounded-full border border-slate-300/80 bg-slate-100/90 px-1.5 py-0.5 text-[10px] font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-200"
          >
            {group.fieldLabel}: {group.count}
          </span>
        ))}
      </div>

      {!explanation.matches.length ? (
        <p className="text-[11px] text-slate-600 dark:text-slate-300">No additional context was captured for this badge.</p>
      ) : (
        <ul className="max-h-64 space-y-1.5 overflow-auto pr-1">
          {explanation.matches.map((match, idx) => {
            const before = match.snippet.slice(0, match.snippetMatchStart);
            const hit = match.snippet.slice(match.snippetMatchStart, match.snippetMatchEnd);
            const after = match.snippet.slice(match.snippetMatchEnd);
            return (
              <li
                key={`${match.field}-${match.term}-${match.start}-${idx}`}
                className="rounded-lg border border-slate-200 bg-slate-50 p-2 text-[11px] text-slate-700 dark:border-slate-800 dark:bg-slate-900/70 dark:text-slate-200"
              >
                <p className="mb-1 font-semibold text-slate-900 dark:text-slate-100">{match.fieldLabel}</p>
                <p className="font-mono leading-snug">
                  <span>{before}</span>
                  <mark className="rounded bg-yellow-200 px-0.5 text-slate-900 dark:bg-yellow-500/40 dark:text-yellow-100">{hit}</mark>
                  <span>{after}</span>
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function StatusSelect({ value, onChange }) {
  return (
    <select className={selectCls()} value={value} onChange={(e) => onChange(e.target.value)}>
      {STATUS_OPTIONS.map((s) => (
        <option key={s} value={s}>
          {statusMeta[s].label}
        </option>
      ))}
    </select>
  );
}

function Toast({ show, message, onClose }) {
  if (!show) return null;
  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[60]">
      <div className="rounded-lg px-4 py-2 bg-emerald-600 text-white text-sm shadow-lg flex items-center gap-3">
        <span>{message}</span>
        <button onClick={onClose} className="text-white/90 hover:text-white">
          <X size={14} />
        </button>
      </div>
    </div>
  );
}

function CriticalWarningBanner({ warning, onClose }) {
  if (!warning) return null;
  return (
    <div className="fixed top-4 left-1/2 z-[61] flex -translate-x-1/2 items-center gap-2 rounded-lg border border-amber-300 bg-amber-100 px-3 py-2 text-xs font-medium text-amber-900 shadow-md dark:border-amber-700 dark:bg-amber-900/75 dark:text-amber-100">
      <AlertTriangle size={14} />
      <span>{warning.message}</span>
      <button
        type="button"
        onClick={onClose}
        className="rounded border border-amber-400 px-1 py-0.5 text-[10px] leading-none dark:border-amber-600"
        aria-label="Close warning banner"
      >
        <X size={12} />
      </button>
    </div>
  );
}

function ToolComputeStatus({ label, progress, lastComputedAt }) {
  const pct = Math.max(0, Math.min(100, Number(progress) || 0));
  const computedText = lastComputedAt
    ? new Date(lastComputedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })
    : null;
  return (
    <div className="glass-surface mb-3 p-3">
      <div className="flex items-center justify-between gap-2 text-xs text-slate-600 dark:text-slate-300">
        <span>{label}</span>
        <span>{pct}%</span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/40 dark:bg-slate-700/70">
        <div className="h-2 bg-gradient-to-r from-cyan-500 to-emerald-500 transition-all" style={{ width: `${pct}%` }} />
      </div>
      {computedText && <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">Last computed: {computedText}</p>}
    </div>
  );
}

function ToolDetailsDisclosure({ title, overview, steps = [], features = [] }) {
  return (
    <details className="glass-surface p-3">
      <summary className="cursor-pointer list-none text-sm font-semibold text-slate-700 dark:text-slate-100">
        {title}
      </summary>
      <div className="mt-2 space-y-2 text-xs text-slate-600 dark:text-slate-300">
        <p>{overview}</p>
        {!!steps.length && (
          <div>
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">How it works</p>
            <ul className="list-disc space-y-1 pl-4">
              {steps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ul>
          </div>
        )}
        {!!features.length && (
          <div>
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">Features</p>
            <ul className="list-disc space-y-1 pl-4">
              {features.map((feature) => (
                <li key={feature}>{feature}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </details>
  );
}

function PageInfoButton({ title, body }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-cyan-300/80 bg-cyan-100/70 text-xs font-semibold text-cyan-900 dark:border-cyan-700 dark:bg-cyan-900/35 dark:text-cyan-200"
        aria-label={`About ${title}`}
        title={`About ${title}`}
      >
        ?
      </button>
      <BaseModal open={open} onClose={() => setOpen(false)} title={title} widthClass="max-w-2xl">
        <p className="text-sm text-slate-600 dark:text-slate-300">{body}</p>
      </BaseModal>
    </>
  );
}

/** =========================================================
 * Top-level components
 * ========================================================= */
function Sidebar({
  active,
  setActive,
  counts,
  competitorNavItems,
  mobileOpen,
  setMobileOpen,
  settingsOpen,
  onOpenSettings,
  onOpenFilteredExplorer,
  onClearNavigationFilters,
}) {
  const drawerRef = useRef(null);

  useEffect(() => {
    if (!mobileOpen || window.innerWidth >= 768) return undefined;

    const previouslyFocused = document.activeElement;
    const drawer = drawerRef.current;
    const focusables = getFocusableElements(drawer);
    (focusables[0] || drawer)?.focus();

    const onKeyDown = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setMobileOpen(false);
        return;
      }
      if (e.key !== "Tab") return;

      const tabbables = getFocusableElements(drawer);
      if (!tabbables.length) {
        e.preventDefault();
        drawer?.focus();
        return;
      }

      const first = tabbables[0];
      const last = tabbables[tabbables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    drawer?.addEventListener("keydown", onKeyDown);
    return () => {
      drawer?.removeEventListener("keydown", onKeyDown);
      if (previouslyFocused && typeof previouslyFocused.focus === "function") {
        previouslyFocused.focus();
      }
    };
  }, [mobileOpen, setMobileOpen]);

  const topLevelItems = useMemo(
    () => [
      { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
      { key: "explorer", label: "Explorer", icon: Search },
    ],
    []
  );

  const duoItems = useMemo(
    () => [
      { key: "other", label: "Other", icon: Puzzle },
      { key: "docs", label: "Docs", icon: FileText },
      { key: "release_notes", label: "Release Notes", icon: BookMarked },
      { key: "guides", label: "Guides", icon: BookMarked },
      { key: "blog", label: "Blog", icon: BookOpen },
      { key: "resources", label: "Resources", icon: FolderOpen },
      { key: "help_kb", label: "Help/KB Articles", icon: FileText },
      { key: "demos", label: "Demos", icon: PlugZap },
      { key: "ecosystem_marketplace", label: "Ecosystem/Marketplace", icon: PlugZap },
    ],
    []
  );

  const competitorItems = useMemo(
    () =>
      competitorNavItems?.length
        ? competitorNavItems
        : [{ key: "competitor_docs", label: "General Docs", icon: FileText }],
    [competitorNavItems]
  );

  const managementItems = useMemo(
    () => [{ key: "manage_customers", label: "Manage Customers", icon: Building2 }],
    []
  );

  const toolsItems = useMemo(
    () => [
      { key: "compare_mode", label: "Compare Mode", icon: Search },
      { key: "change_heatmap", label: "Change Heatmap", icon: LayoutDashboard },
      { key: "smart_gap_finder", label: "Smart Gap Finder", icon: Puzzle },
      { key: "clone_to_duo_template", label: "Clone to Duo Template", icon: ClipboardList },
      { key: "watchlist", label: "Watchlist", icon: Tag },
      { key: "relationship_graph", label: "Relationship Graph", icon: PlugZap },
      { key: "evidence_trails", label: "Evidence Trails", icon: History },
    ],
    []
  );

  const [navEditMode, setNavEditMode] = useState(false);
  const [draggingNavItem, setDraggingNavItem] = useState(null);
  const [dragOverTarget, setDragOverTarget] = useState(null);
  const [pendingCrossSectionMove, setPendingCrossSectionMove] = useState(null);
  const [navLayout, setNavLayout] = useState(() =>
    readStorage(STORAGE_KEYS.navMenuOrder, {
      top: ["dashboard", "explorer"],
      duo: ["other", "docs", "release_notes", "guides", "blog", "resources", "help_kb", "demos"],
      competitor: [],
      management: ["manage_customers"],
      tools: ["compare_mode", "change_heatmap", "smart_gap_finder", "clone_to_duo_template", "watchlist", "relationship_graph", "evidence_trails"],
    })
  );
  const defaultSectionKeys = useMemo(
    () => ({
      top: topLevelItems.map((item) => item.key),
      duo: duoItems.map((item) => item.key),
      competitor: competitorItems.map((item) => item.key),
      management: managementItems.map((item) => item.key),
      tools: toolsItems.map((item) => item.key),
    }),
    [topLevelItems, duoItems, competitorItems, managementItems, toolsItems]
  );

  const allNavItemsByKey = useMemo(() => {
    const all = [...topLevelItems, ...duoItems, ...competitorItems, ...managementItems, ...toolsItems];
    return new Map(all.map((item) => [item.key, item]));
  }, [topLevelItems, duoItems, competitorItems, managementItems, toolsItems]);

  const normalizeSectionLayout = useCallback((layout) => {
    const sectionIds = ["top", "duo", "competitor", "management", "tools"];
    const normalized = {
      top: Array.isArray(layout?.top) ? [...layout.top] : [],
      duo: Array.isArray(layout?.duo) ? [...layout.duo] : [],
      competitor: Array.isArray(layout?.competitor) ? [...layout.competitor] : [],
      management: Array.isArray(layout?.management) ? [...layout.management] : [],
      tools: Array.isArray(layout?.tools) ? [...layout.tools] : [],
    };

    sectionIds.forEach((sectionId) => {
      normalized[sectionId] = normalized[sectionId].filter((key) => allNavItemsByKey.has(key));
    });

    const seen = new Set();
    sectionIds.forEach((sectionId) => {
      normalized[sectionId] = normalized[sectionId].filter((key) => {
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    });

    sectionIds.forEach((sectionId) => {
      defaultSectionKeys[sectionId].forEach((key) => {
        if (!seen.has(key)) {
          normalized[sectionId].push(key);
          seen.add(key);
        }
      });
    });

    return normalized;
  }, [defaultSectionKeys, allNavItemsByKey]);

  const resolvedNavLayout = useMemo(() => normalizeSectionLayout(navLayout), [navLayout, normalizeSectionLayout]);

  const orderedTopLevelItems = useMemo(
    () => resolvedNavLayout.top.map((key) => allNavItemsByKey.get(key)).filter(Boolean),
    [resolvedNavLayout.top, allNavItemsByKey]
  );
  const orderedDuoItems = useMemo(
    () => resolvedNavLayout.duo.map((key) => allNavItemsByKey.get(key)).filter(Boolean),
    [resolvedNavLayout.duo, allNavItemsByKey]
  );
  const orderedCompetitorItems = useMemo(
    () => resolvedNavLayout.competitor.map((key) => allNavItemsByKey.get(key)).filter(Boolean),
    [resolvedNavLayout.competitor, allNavItemsByKey]
  );
  const orderedManagementItems = useMemo(
    () => resolvedNavLayout.management.map((key) => allNavItemsByKey.get(key)).filter(Boolean),
    [resolvedNavLayout.management, allNavItemsByKey]
  );
  const orderedToolsItems = useMemo(
    () => resolvedNavLayout.tools.map((key) => allNavItemsByKey.get(key)).filter(Boolean),
    [resolvedNavLayout.tools, allNavItemsByKey]
  );

  const applyMoveAcrossSections = (sourceSection, targetSection, itemKey, beforeKey = null) => {
    if (!sourceSection || !targetSection || !itemKey) return;
    setNavLayout((prev) => {
      const next = normalizeSectionLayout(prev);
      const sections = ["top", "duo", "competitor", "management", "tools"];
      sections.forEach((sectionId) => {
        next[sectionId] = next[sectionId].filter((key) => key !== itemKey);
      });
      const targetList = [...next[targetSection]];
      const insertIndex = beforeKey && targetList.includes(beforeKey) ? targetList.indexOf(beforeKey) : targetList.length;
      targetList.splice(insertIndex, 0, itemKey);
      next[targetSection] = targetList;
      return normalizeSectionLayout(next);
    });
  };

  const onDragStartNavItem = (e, section, itemKey) => {
    setDraggingNavItem({ section, itemKey });
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", `${section}:${itemKey}`);
  };

  const onDragOverNavItem = (e, section, itemKey) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverTarget({ section, itemKey });
  };

  const onDropNavItem = (e, section, itemKey) => {
    e.preventDefault();
    const dragged = draggingNavItem;
    setDragOverTarget(null);
    if (!dragged || dragged.itemKey === itemKey) return;
    if (dragged.section !== section) {
      setPendingCrossSectionMove({
        sourceSection: dragged.section,
        targetSection: section,
        itemKey: dragged.itemKey,
        beforeKey: itemKey,
      });
      return;
    }
    applyMoveAcrossSections(dragged.section, section, dragged.itemKey, itemKey);
  };

  const onDropSectionEnd = (e, section) => {
    e.preventDefault();
    const dragged = draggingNavItem;
    setDragOverTarget(null);
    if (!dragged) return;
    if (dragged.section !== section) {
      setPendingCrossSectionMove({
        sourceSection: dragged.section,
        targetSection: section,
        itemKey: dragged.itemKey,
        beforeKey: null,
      });
      return;
    }
    applyMoveAcrossSections(dragged.section, section, dragged.itemKey, null);
  };

  const onDragEndNavItem = () => {
    setDraggingNavItem(null);
    setDragOverTarget(null);
  };

  const sectionLabel = (sectionId) => {
    if (sectionId === "top") return "Top";
    if (sectionId === "duo") return "Duo";
    if (sectionId === "competitor") return "Competitor";
    if (sectionId === "management") return "Management";
    if (sectionId === "tools") return "Tools";
    return "Unknown";
  };

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.navMenuOrder, JSON.stringify(resolvedNavLayout));
  }, [resolvedNavLayout]);

  const [duoExpanded, setDuoExpanded] = useState(false);
  const [competitorExpanded, setCompetitorExpanded] = useState(false);
  const [toolsExpanded, setToolsExpanded] = useState(false);
  const [competitorFolderExpanded, setCompetitorFolderExpanded] = useState({});

  const sumCompetitorCounts = (item) => {
    if (item.children?.length) {
      return item.children.reduce((sum, child) => sum + sumCompetitorCounts(child), 0);
    }
    return Number(counts[item.key]) || 0;
  };

  const settingsItem = { key: "settings", label: "Settings", icon: Settings };
  const SettingsIcon = settingsItem.icon;
  const duoGroupCount = duoItems.reduce((sum, item) => sum + (Number(counts[item.key]) || 0), 0);
  const competitorGroupCount = orderedCompetitorItems.reduce((sum, item) => sum + sumCompetitorCounts(item), 0);

  const navigateTo = (viewKey) => {
    onClearNavigationFilters?.();
    setActive(viewKey);
    setMobileOpen(false);
  };

  const competitorTagForKey = (key) => {
    const normalized = String(key || "").toLowerCase();
    if (normalized.startsWith("okta_")) return "okta";
    if (normalized.startsWith("entra_")) return "entra";
    if (normalized.startsWith("ping_")) return "ping_identity";
    return null;
  };

  const renderCompetitorItems = (items, depth = 0, pathLabel = "") =>
    items.map((item) => {
      const Icon = item.icon;
      const hasChildren = Array.isArray(item.children) && item.children.length > 0;
      const selected = active === item.key;
      const count = hasChildren
        ? (typeof counts[item.key] === "number" ? counts[item.key] : sumCompetitorCounts(item))
        : counts[item.key];
      const marginClass = depth === 0 ? "ml-3" : depth === 1 ? "ml-6" : "ml-9";
      const fullLabel = pathLabel ? `${pathLabel} ${item.label}` : item.label;

      if (hasChildren) {
        const isFolderExpanded = competitorFolderExpanded[item.key] ?? false;
        const competitorFacetTag = competitorTagForKey(item.key);
        return (
          <div key={item.key} className="space-y-1">
            <button
              onClick={() => {
                const nextExpanded = !(competitorFolderExpanded[item.key] ?? false);
                setCompetitorFolderExpanded((prev) => ({
                  ...prev,
                  [item.key]: nextExpanded,
                }));
                if (nextExpanded && competitorFacetTag) {
                  onOpenFilteredExplorer?.({ facetTagId: competitorFacetTag });
                  setMobileOpen(false);
                }
              }}
              aria-expanded={isFolderExpanded}
              aria-controls={`nav-subgroup-${item.key}`}
              className={`glass-nav-item ${marginClass} flex items-center justify-between text-slate-800 dark:text-slate-100 ${
                isFolderExpanded ? "border-cyan-300/70 bg-cyan-100/55 dark:border-cyan-700/70 dark:bg-cyan-900/30" : ""
              }`}
            >
              <span className="flex items-center gap-2">
                <Icon size={16} />
                {item.label}
              </span>
              <span className="flex items-center gap-1.5">
                {typeof count === "number" && (
                  <span className="rounded-full bg-white/40 px-2 py-0.5 text-xs dark:bg-slate-800/70">{count}</span>
                )}
                {isFolderExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </span>
            </button>
            {isFolderExpanded && (
              <div id={`nav-subgroup-${item.key}`} className="space-y-1">
                {renderCompetitorItems(item.children, depth + 1, fullLabel)}
              </div>
            )}
          </div>
        );
      }

      return (
        <button
          key={item.key}
          onClick={() => navigateTo(item.key)}
          aria-current={selected ? "page" : undefined}
          aria-label={`Open ${fullLabel}`}
          className={`glass-nav-item ${marginClass} flex items-center justify-between ${selected ? "glass-nav-item-active" : ""}`}
        >
          <span className="flex items-center gap-2">
            <Icon size={16} />
            {item.label}
          </span>
          {typeof count === "number" && (
            <span
              className={`rounded-full px-2 py-0.5 text-xs ${
                selected ? "bg-white/20" : "bg-white/40 dark:bg-slate-800/70"
              }`}
            >
              {count}
            </span>
          )}
        </button>
      );
    });

  return (
    <>
      {mobileOpen && (
        <button
          className="fixed inset-0 z-40 bg-black/40 md:hidden"
          onClick={() => setMobileOpen(false)}
          aria-label="Close navigation"
        />
      )}
      <aside
        ref={drawerRef}
        id="primary-navigation"
        tabIndex={-1}
        role="dialog"
        aria-modal={mobileOpen ? "true" : undefined}
        aria-label="Primary navigation"
        className={`fixed inset-y-0 left-0 z-50 w-72 shrink-0 border-r border-white/20 bg-white/40 backdrop-blur-xl transition-transform dark:bg-slate-900/35 md:relative md:inset-auto md:z-auto md:min-h-full md:translate-x-0 md:shadow-none ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex min-h-full flex-col">
        <div className="p-5">
          <h1 className="type-title">Doc Navigator</h1>
          <button
            type="button"
            onClick={() => setNavEditMode((prev) => !prev)}
            className="mt-2 rounded-md border border-cyan-300/70 bg-cyan-100/65 px-2 py-1 text-[11px] font-medium text-cyan-900 dark:border-cyan-700 dark:bg-cyan-900/35 dark:text-cyan-200"
          >
            {navEditMode ? "Done Rearranging" : "Rearrange Navigation"}
          </button>
        </div>
        {navEditMode && (
          <div className="glass-surface mx-3 mb-3 p-2">
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-600 dark:text-slate-200">Navigation Order</p>
            <p className="mb-2 text-[10px] text-slate-500 dark:text-slate-300">Drag items to reorder. Changes are saved automatically.</p>
            {[
              { id: "top", label: "Top", items: orderedTopLevelItems },
              { id: "duo", label: "Duo", items: orderedDuoItems },
              { id: "competitor", label: "Competitor", items: orderedCompetitorItems },
              { id: "management", label: "Management", items: orderedManagementItems },
              { id: "tools", label: "Tools", items: orderedToolsItems },
            ].map((section) => (
              <div
                key={section.id}
                className="mb-2 rounded-lg border border-white/35 bg-white/35 p-2 dark:border-slate-700/60 dark:bg-slate-900/50"
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "move";
                }}
                onDrop={(e) => onDropSectionEnd(e, section.id)}
              >
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-600 dark:text-slate-300">{section.label}</p>
                <div className="space-y-1">
                  {section.items.map((item) => (
                    <div
                      key={`${section.id}_${item.key}`}
                      draggable
                      onDragStart={(e) => onDragStartNavItem(e, section.id, item.key)}
                      onDragOver={(e) => onDragOverNavItem(e, section.id, item.key)}
                      onDrop={(e) => onDropNavItem(e, section.id, item.key)}
                      onDragEnd={onDragEndNavItem}
                      className={`flex cursor-move items-center justify-between gap-2 rounded border px-2 py-1 text-xs transition ${
                        draggingNavItem?.section === section.id && draggingNavItem?.itemKey === item.key
                          ? "border-cyan-400/70 bg-cyan-100/70 opacity-60 dark:border-cyan-700/80 dark:bg-cyan-900/35"
                          : dragOverTarget?.section === section.id && dragOverTarget?.itemKey === item.key
                            ? "border-emerald-400/80 bg-emerald-100/70 dark:border-emerald-700/80 dark:bg-emerald-900/35"
                            : "border-white/35 bg-white/40 dark:border-slate-700/70 dark:bg-slate-900/45"
                      }`}
                    >
                      <span className="truncate">{item.label}</span>
                      <span className="text-[10px] uppercase tracking-[0.08em] text-slate-500 dark:text-slate-300">Drag</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
        <nav className="space-y-3 px-3 pb-3">
          {[orderedTopLevelItems].map((itemList, sectionIndex) => (
            <div key={`section_${sectionIndex}`} className="space-y-1">
              {itemList.map((item) => {
                const Icon = item.icon;
                const selected = active === item.key;
                const count = counts[item.key];
                return (
                  <button
                    key={item.key}
                    onClick={() => navigateTo(item.key)}
                    aria-current={selected ? "page" : undefined}
                    aria-label={`Open ${item.label}`}
                    className={`glass-nav-item flex items-center justify-between ${selected ? "glass-nav-item-active" : ""}`}
                  >
                    <span className="flex items-center gap-2">
                      <Icon size={16} />
                      {item.label}
                    </span>
                    {typeof count === "number" && (
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs ${
                          selected ? "bg-white/20" : "bg-white/40 dark:bg-slate-800/70"
                        }`}
                      >
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}

          <div className="space-y-1">
            <button
              onClick={() => {
                const nextExpanded = !duoExpanded;
                setDuoExpanded(nextExpanded);
                if (nextExpanded) {
                  onOpenFilteredExplorer?.({ facetTagId: "duo" });
                  setMobileOpen(false);
                }
              }}
              aria-expanded={duoExpanded}
              aria-controls="nav-group-duo"
              className={`glass-nav-item flex items-center justify-between ${duoExpanded ? "border-cyan-300/70 bg-cyan-100/55 dark:border-cyan-700/70 dark:bg-cyan-900/30" : ""}`}
            >
              <span className="flex items-center gap-2 px-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-600 dark:text-slate-200">
                Duo
                <span className="rounded-full bg-white/40 px-2 py-0.5 text-xs dark:bg-slate-800/70">{duoGroupCount}</span>
              </span>
              {duoExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </button>
            {duoExpanded && (
              <div id="nav-group-duo" className="space-y-1">
                {orderedDuoItems.map((item) => {
                  const Icon = item.icon;
                  const selected = active === item.key;
                  const count = counts[item.key];
                  return (
                    <button
                      key={item.key}
                      onClick={() => navigateTo(item.key)}
                      aria-current={selected ? "page" : undefined}
                      aria-label={`Open ${item.label}`}
                      className={`glass-nav-item ml-3 flex items-center justify-between ${selected ? "glass-nav-item-active" : ""}`}
                    >
                      <span className="flex items-center gap-2">
                        <Icon size={16} />
                        {item.label}
                      </span>
                      {typeof count === "number" && (
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs ${
                            selected ? "bg-white/20" : "bg-white/40 dark:bg-slate-800/70"
                          }`}
                        >
                          {count}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="space-y-1">
            <button
              onClick={() => {
                const nextExpanded = !competitorExpanded;
                setCompetitorExpanded(nextExpanded);
                if (nextExpanded) {
                  onOpenFilteredExplorer?.({ facetTagId: "competitor_docs" });
                  setMobileOpen(false);
                }
              }}
              aria-expanded={competitorExpanded}
              aria-controls="nav-group-competitor"
              className={`glass-nav-item flex items-center justify-between ${competitorExpanded ? "border-cyan-300/70 bg-cyan-100/55 dark:border-cyan-700/70 dark:bg-cyan-900/30" : ""}`}
            >
              <span className="flex items-center gap-2 px-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-600 dark:text-slate-200">
                Competitor Documentation
                <span className="rounded-full bg-white/40 px-2 py-0.5 text-xs dark:bg-slate-800/70">{competitorGroupCount}</span>
              </span>
              {competitorExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </button>
            {competitorExpanded && (
              <div id="nav-group-competitor" className="space-y-1">
                {renderCompetitorItems(orderedCompetitorItems)}
              </div>
            )}
          </div>

          <div className="space-y-1">
            {orderedManagementItems.map((item) => {
              const Icon = item.icon;
              const selected = active === item.key;
              const count = counts[item.key];
              return (
                <button
                  key={item.key}
                  onClick={() => navigateTo(item.key)}
                  aria-current={selected ? "page" : undefined}
                  aria-label={`Open ${item.label}`}
                  className={`glass-nav-item flex items-center justify-between ${selected ? "glass-nav-item-active" : ""}`}
                >
                  <span className="flex items-center gap-2">
                    <Icon size={16} />
                    {item.label}
                  </span>
                  {typeof count === "number" && (
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs ${
                        selected ? "bg-white/20" : "bg-white/40 dark:bg-slate-800/70"
                      }`}
                    >
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="space-y-1">
            <button
              onClick={() => setToolsExpanded((prev) => !prev)}
              aria-expanded={toolsExpanded}
              aria-controls="nav-group-tools"
              className={`glass-nav-item flex items-center justify-between ${toolsExpanded ? "border-cyan-300/70 bg-cyan-100/55 dark:border-cyan-700/70 dark:bg-cyan-900/30" : ""}`}
            >
              <span className="flex items-center gap-2 px-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-600 dark:text-slate-200">
                Tools
              </span>
              {toolsExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </button>
            {toolsExpanded && (
              <div id="nav-group-tools" className="space-y-1">
                {orderedToolsItems.map((item) => {
                  const Icon = item.icon;
                  const selected = active === item.key;
                  const count = counts[item.key];
                  return (
                    <button
                      key={item.key}
                      onClick={() => navigateTo(item.key)}
                      aria-current={selected ? "page" : undefined}
                      aria-label={`Open ${item.label}`}
                      className={`glass-nav-item ml-3 flex items-center justify-between ${selected ? "glass-nav-item-active" : ""}`}
                    >
                      <span className="flex items-center gap-2">
                        <Icon size={16} />
                        {item.label}
                      </span>
                      {typeof count === "number" && (
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs ${
                            selected ? "bg-white/20" : "bg-white/40 dark:bg-slate-800/70"
                          }`}
                        >
                          {count}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </nav>
          <div className="mt-auto px-3 pb-4">
            <button
              onClick={() => {
                onClearNavigationFilters?.();
                onOpenSettings();
                setMobileOpen(false);
              }}
              aria-current={settingsOpen ? "page" : undefined}
              aria-label={`Open ${settingsItem.label}`}
              className={`glass-nav-item flex items-center justify-between ${settingsOpen ? "glass-nav-item-active" : ""}`}
            >
              <span className="flex items-center gap-2">
                <SettingsIcon size={16} />
                {settingsItem.label}
              </span>
            </button>
          </div>
        </div>
      </aside>
      <ConfirmModal
        open={!!pendingCrossSectionMove}
        title="Move Navigation Item Across Sections"
        body={pendingCrossSectionMove
          ? `Move '${allNavItemsByKey.get(pendingCrossSectionMove.itemKey)?.label || pendingCrossSectionMove.itemKey}' from ${sectionLabel(pendingCrossSectionMove.sourceSection)} to ${sectionLabel(pendingCrossSectionMove.targetSection)}?`
          : ""}
        confirmText="Move"
        onConfirm={() => {
          if (pendingCrossSectionMove) {
            applyMoveAcrossSections(
              pendingCrossSectionMove.sourceSection,
              pendingCrossSectionMove.targetSection,
              pendingCrossSectionMove.itemKey,
              pendingCrossSectionMove.beforeKey
            );
          }
          setPendingCrossSectionMove(null);
          onDragEndNavItem();
        }}
        onCancel={() => {
          setPendingCrossSectionMove(null);
          onDragEndNavItem();
        }}
      />
    </>
  );
}

function TopBar(props) {
  const {
    query,
    setQuery,
    recentDaysWindow,
    setRecentDaysWindow,
    onResync,
    syncState,
    onToggleNav,
    searchInputRef,
    isContentView,
    onPinSearchTag,
    activeFacetTags,
    activeFilterCount,
    onRemoveActiveTag,
    onUndoLastTag,
    lastAddedFacetId,
    navigationScopeLabel,
    showSearch,
    searchPlaceholder,
    isNavOpen,
  } = props;

  return (
    <header className="glass-surface mb-6 flex flex-wrap items-center gap-3 p-4 fade-in-up">
      <button
        onClick={onToggleNav}
        className="glass-control md:hidden"
        aria-label="Open navigation"
        aria-controls="primary-navigation"
        aria-expanded={isNavOpen}
      >
        <Menu size={18} />
      </button>

      {showSearch && (
        <div className="flex-1 min-w-[240px] flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2" size={16} />
            <input
              ref={searchInputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                }
              }}
              placeholder={searchPlaceholder}
              className="glass-control w-full py-2.5 pl-9 pr-3"
              aria-label="Search site content"
            />
          </div>
          {isContentView && activeFilterCount > 0 && (
            <span className="rounded-full border border-cyan-300 bg-cyan-100 px-2 py-0.5 text-[10px] font-semibold text-cyan-900 dark:border-cyan-700 dark:bg-cyan-900/35 dark:text-cyan-200">
              {activeFilterCount}
            </span>
          )}
          {isContentView && navigationScopeLabel && (
            <span className="rounded-full border border-emerald-300 bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-900 dark:border-emerald-700 dark:bg-emerald-900/35 dark:text-emerald-200">
              Scope: {navigationScopeLabel}
            </span>
          )}
          {isContentView && (
            <button
              onClick={(e) => {
                const mode = e.altKey ? "exclude" : e.shiftKey ? "or" : "and";
                onPinSearchTag(query, mode);
                setQuery("");
              }}
              className="glass-control px-2 py-1 text-xs disabled:opacity-50"
              disabled={!query.trim()}
              title="Pin search as tag"
              aria-label="Pin current search as tag"
            >
              <Pin size={14} />
            </button>
          )}
        </div>
      )}

      <div className="flex items-center gap-2">
        <span className="text-xs text-slate-500">Recently Updately Lookback (Days)</span>
        <input
          type="number"
          min={1}
          max={30}
          value={recentDaysWindow}
          onChange={(e) =>
            setRecentDaysWindow(Math.max(1, Math.min(30, Number(e.target.value) || 14)))
          }
          className="glass-control w-16 px-2"
        />
      </div>

      <button
        onClick={onResync}
        disabled={syncState?.loading || syncState?.inProgress}
        className="glass-control disabled:opacity-60"
      >
        {syncState?.loading || syncState?.inProgress ? "Resyncing..." : "Resync"}
      </button>

      {isContentView && !!activeFacetTags.length && (
        <div className="w-full mt-1 flex flex-wrap items-center gap-1.5">
          {activeFacetTags.map((tag) => (
            <span
              key={tag.id}
              className="inline-flex items-center gap-1 rounded-full border border-white/40 bg-white/45 px-1.5 py-0.5 text-[10px] leading-none dark:border-slate-700/80 dark:bg-slate-900/65"
            >
              <span className="font-medium">{tag.label}</span>
              <span className="text-[9px] uppercase text-slate-500">{tag.mode}</span>
              <button
                onClick={() => onRemoveActiveTag?.(tag.id)}
                className="text-rose-700"
                aria-label={`Remove ${tag.label} filter`}
                title={`Remove ${tag.label} filter`}
              >
                x
              </button>
            </span>
          ))}
          {!!lastAddedFacetId && (
            <button
              onClick={onUndoLastTag}
              className="rounded-full border border-rose-300 px-1.5 py-0.5 text-[10px] leading-none text-rose-700"
              title="Undo last added filter"
            >
              Undo Last
            </button>
          )}
        </div>
      )}

      {(syncState?.lastRun || syncState?.error) && (
        <div className="w-full mt-1 text-xs text-slate-500">
          {syncState?.error ? (
            <span className="text-rose-600 dark:text-rose-300">Sync error: {syncState.error}</span>
          ) : (
            <span>
              Last sync: {syncState.lastRun?.finishedAt || syncState.lastRun?.startedAt || "unknown"} ·
              scanned {syncState.lastRun?.scannedCount ?? 0} ·
              new {syncState.lastRun?.discoveredCount ?? 0} ·
              changed {syncState.lastRun?.changedCount ?? 0}
            </span>
          )}
        </div>
      )}

      {(syncState?.loading || syncState?.inProgress) && (
        <div className="w-full mt-2">
          <div className="h-2 rounded-full overflow-hidden bg-white/45 dark:bg-slate-700/70">
            <div
              className="h-2 bg-blue-600 transition-all"
              style={{ width: `${syncState?.progress?.percent ?? 0}%` }}
            />
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            {syncState?.progress?.percent ?? 0}% · processed{" "}
            {syncState?.progress?.processed ?? 0} / {syncState?.progress?.queued ?? 0}
            {syncState?.progress?.currentDepth !== undefined
              ? ` · depth ${syncState.progress.currentDepth}`
              : ""}
          </div>
        </div>
      )}
    </header>
  );
}

function Dashboard({ summary, backupStale, onQuickExport, onQuickFilterTag, onOpenExplorer, onHeatmapCellClick, customers, templates, heatmapCells, briefs }) {
  const total = summary?.total ?? 0;
  const newlyDiscovered = summary?.newlyDiscovered ?? 0;
  const recentlyUpdated = summary?.recentlyUpdated ?? 0;
  const activeTemplates = templates.filter((t) => !t.deletedAt).length;
  const customerCount = customers.length;
  const assignedTemplateRows = customers.flatMap((c) => Object.values(c.assignedTemplates || {}));
  const implemented = assignedTemplateRows.filter((r) => r.status === STATUS.IMPLEMENTED).length;
  const inProgress = assignedTemplateRows.filter((r) => r.status === STATUS.IN_PROGRESS).length;
  const stalled = customers.filter((c) => {
    const rows = Object.values(c.assignedTemplates || {});
    if (!rows.length) return false;
    return !rows.some((r) => r.status === STATUS.IMPLEMENTED || r.status === STATUS.IN_PROGRESS);
  }).length;
  const implementationRate = assignedTemplateRows.length
    ? Math.round((implemented / assignedTemplateRows.length) * 100)
    : 0;
  return (
    <div className="space-y-4">
      {backupStale && (
        <div style={{
          background: 'var(--glass-bg)',
          border: '1.5px solid var(--glass-border)',
          boxShadow: 'var(--glass-shadow)',
          backdropFilter: 'blur(var(--glass-blur))',
          borderRadius: 'var(--glass-radius)',
          padding: '1rem',
        }} className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm">
            <AlertTriangle size={16} />
            It’s been over 14 days since your last Full Backup export.
          </div>
          <button onClick={onQuickExport} className="text-xs px-2 py-1 rounded-md bg-amber-600 text-white">
            Export now
          </button>
        </div>
      )}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {[{
          label: 'Total Indexed Objects', value: total, helper: 'All indexed objects in the selected scope', action: 'open_explorer'
        }, {
          label: 'Newly Discovered', value: newlyDiscovered, helper: 'Detected as new in the recent window', action: 'tag:newly_discovered'
        }, {
          label: 'Recently Updated', value: recentlyUpdated, helper: 'Existing pages updated or changed in the recent window', action: 'tag:recently_updated'
        }].map((card) => (
          <button
            key={card.label}
            type="button"
            onClick={() => {
              if (card.action === 'open_explorer') {
                onOpenExplorer?.();
                return;
              }
              if (card.action?.startsWith('tag:')) {
                onQuickFilterTag?.(card.action.replace('tag:', ''));
              }
            }}
            className="text-left"
            title={card.action === 'open_explorer' ? 'Open Explorer' : 'Open Explorer and add this as a tag filter'}
            style={{
            background: 'var(--glass-bg)',
            border: '1.5px solid var(--glass-border)',
            boxShadow: 'var(--glass-shadow)',
            backdropFilter: 'blur(var(--glass-blur))',
            borderRadius: 'var(--glass-radius)',
            padding: 'var(--glass-card-padding)',
            color: 'var(--glass-fg, #0f172a)',
            transition: 'box-shadow var(--glass-motion-fast), background var(--glass-motion-slow)',
          }}>
            <p className="text-sm font-semibold tracking-tight text-glass-primary">{card.label}</p>
            <p className="mt-2 text-3xl font-bold text-glass-primary">{card.value}</p>
            <p className="mt-2 text-xs text-glass-secondary">{card.helper}</p>
          </button>
        ))}
      </div>

      <div className="grid xl:grid-cols-[1.5fr_1fr] gap-4">
        <section style={{
          background: 'var(--glass-bg)',
          border: '1.5px solid var(--glass-border)',
          boxShadow: 'var(--glass-shadow)',
          backdropFilter: 'blur(var(--glass-blur))',
          borderRadius: 'var(--glass-radius)',
          padding: 'var(--glass-card-padding)',
          transition: 'box-shadow var(--glass-motion-fast), background var(--glass-motion-slow)',
        }}>
          <p className="type-card-title">Customer Cockpit: Decision Metrics</p>
          <div className="mt-3 grid sm:grid-cols-2 xl:grid-cols-4 gap-3">
            {[{
              label: 'Customers', value: customerCount
            }, {
              label: 'Active Templates', value: activeTemplates
            }, {
              label: 'In Progress', value: inProgress
            }, {
              label: 'Stalled Customers', value: stalled
            }].map((metric) => (
              <div key={metric.label} style={{
                background: 'rgba(255,255,255,0.22)',
                borderRadius: '1rem',
                padding: '1rem',
                boxShadow: '0 2px 8px 0 rgba(31,38,135,0.08)',
              }}>
                <p className="type-label">{metric.label}</p>
                <p className="text-xl font-semibold mt-1">{metric.value}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 rounded-xl border border-slate-200 dark:border-slate-700 p-3" style={{
            background: 'rgba(255,255,255,0.18)',
            boxShadow: '0 2px 8px 0 rgba(31,38,135,0.08)',
          }}>
            <p className="type-label">Implementation Rate</p>
            <div className="mt-2 h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
              <div className="h-2 bg-emerald-600" style={{ width: `${implementationRate}%` }} />
            </div>
            <p className="mt-2 text-sm font-medium tracking-tight">{implementationRate}% implemented across assigned rollouts</p>
          </div>
        </section>

        <AutoBriefsPanel briefs={briefs} />
      </div>

      <div>
        <ChangeHeatmapPanel cells={heatmapCells} onCellClick={onHeatmapCellClick} />
      </div>
    </div>
  );
}

function CatalogCard({ item, query, onAdd, onTagClick, onCompare, onStageClone }) {
  const searchBadges = getSearchPriorityBadges(item, query);
  const isCompetitor = isCompetitorResultItem(item);
  const [openBadgeId, setOpenBadgeId] = useState(null);
  const [openBadgeExplanation, setOpenBadgeExplanation] = useState(null);
  const [badgeAnchorRect, setBadgeAnchorRect] = useState(null);
  const popoverRef = useRef(null);
  const triggerRef = useRef(null);

  const closeBadgeContext = useCallback(() => {
    setOpenBadgeId(null);
    setOpenBadgeExplanation(null);
    setBadgeAnchorRect(null);
    if (triggerRef.current && typeof triggerRef.current.focus === "function") {
      triggerRef.current.focus();
    }
  }, []);

  useEffect(() => {
    if (!openBadgeId) return undefined;

    const onPointerDown = (event) => {
      const target = event.target;
      if (popoverRef.current?.contains(target) || triggerRef.current?.contains(target)) return;
      setOpenBadgeId(null);
      setOpenBadgeExplanation(null);
      setBadgeAnchorRect(null);
    };

    const onKeyDown = (event) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      closeBadgeContext();
    };

    const onScroll = () => {
      setOpenBadgeId(null);
      setOpenBadgeExplanation(null);
      setBadgeAnchorRect(null);
    };

    window.addEventListener("mousedown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("scroll", onScroll, { passive: true, capture: true });
    return () => {
      window.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("scroll", onScroll, { capture: true });
    };
  }, [closeBadgeContext, openBadgeId]);

  const openBadgeContext = useCallback(
    (badge, event) => {
      const mode = badge.id === "partial" ? "partial" : "hits";
      const explanation = getSearchMatchExplanation(item, query, mode);
      if (!explanation) return;
      triggerRef.current = event.currentTarget;
      setBadgeAnchorRect(event.currentTarget.getBoundingClientRect());
      setOpenBadgeId(badge.id);
      setOpenBadgeExplanation(explanation);
    },
    [item, query]
  );

  return (
    <div className="glass-surface-static p-4">
      <div className="flex items-start justify-between gap-2">
        <h3 className="type-card-title text-glass-primary">{item.title}</h3>
        <BadgeRecentlyUpdated
          recentlyUpdated={item.recentlyUpdated}
          recentReason={item.recentReason}
        />
      </div>
      <div className="type-micro mt-1 flex flex-wrap items-center gap-2">
        {item.category !== "competitor_docs" && (
          <button
            type="button"
            onClick={(e) => {
              const mode = e.altKey ? "exclude" : e.shiftKey ? "or" : "and";
              onTagClick?.(categoryLabel(item.category), mode);
            }}
            title={`Filter by ${categoryLabel(item.category)}`}
            className="inline-flex items-center gap-1 rounded-full border border-white/40 bg-white/40 px-1.5 py-0.5 text-[10px] leading-none transition hover:bg-white/60 dark:border-slate-700/80 dark:bg-slate-900/60 dark:hover:bg-slate-900/80"
          >
            <Tag size={12} />
            {categoryLabel(item.category)}
          </button>
        )}
        {item.vendor ? (
          <button
            type="button"
            onClick={(e) => {
              const mode = e.altKey ? "exclude" : e.shiftKey ? "or" : "and";
              onTagClick?.(item.vendor, mode);
            }}
            title={`Filter by ${item.vendor}`}
            className="rounded-full border border-sky-300/70 bg-sky-100/65 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.08em] leading-none text-sky-900 transition hover:bg-sky-200/80 dark:border-sky-700 dark:bg-sky-900/35 dark:text-sky-200 dark:hover:bg-sky-900/55"
          >
            {item.vendor}
          </button>
        ) : null}
        {searchBadges.map((badge) => {
          const interactive = badge.id === "hits" || badge.id === "partial" || badge.id === "full_match";
          const badgeClass = `rounded-full px-1.5 py-0.5 text-[10px] font-medium leading-none ${searchBadgeToneClass(badge.tone)}`;
          if (!interactive) {
            return (
              <span key={badge.id} className={badgeClass}>
                {badge.label}
              </span>
            );
          }

          const isOpen = openBadgeId === badge.id;
          const popoverId = `badge-context-${item.id}-${badge.id}`;
          const popoverTitle =
            badge.id === "partial" ? "Partial match context" :
            badge.id === "full_match" ? "Full match context (body)" :
            "Hit context";

          return (
            <div key={badge.id} className="relative inline-flex">
              <button
                type="button"
                onClick={(event) => openBadgeContext(badge, event)}
                className={`${badgeClass} transition hover:brightness-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-cyan-500`}
                aria-expanded={isOpen}
                aria-controls={popoverId}
                aria-label={`${badge.label}. Show match context.`}
              >
                {badge.label}
              </button>
              {isOpen && badgeAnchorRect && createPortal(
                <div ref={popoverRef}>
                  <SearchBadgePopover
                    id={popoverId}
                    title={popoverTitle}
                    explanation={openBadgeExplanation}
                    onClose={closeBadgeContext}
                    anchorRect={badgeAnchorRect}
                  />
                </div>,
                document.body
              )}
            </div>
          );
        })}
        {item.pathSummary && <span>· {item.pathSummary}</span>}
      </div>
      <p className="text-glass-secondary mt-3 text-sm">{item.summary}</p>
      <div className="mt-4 flex gap-2">
        <button
          onClick={() => onAdd(item)}
          className="glass-control inline-flex items-center gap-1 px-2 py-1 text-xs"
        >
          <Plus size={12} /> Add to Template
        </button>
        <button
          onClick={() => onCompare?.(item)}
          className="glass-control inline-flex items-center gap-1 px-2 py-1 text-xs"
          title="Add this result to Compare Mode"
        >
          <Search size={12} /> Compare
        </button>
        {isCompetitor && (
          <button
            onClick={() => onStageClone?.(item)}
            className="glass-control inline-flex items-center gap-1 px-2 py-1 text-xs"
            title="Stage this competitor result for Duo clone templating"
          >
            <Plus size={12} /> Stage Clone
          </button>
        )}
        <a
          href={item.url || "https://duo.com"}
          target="_blank"
          rel="noreferrer"
          className="glass-control inline-flex items-center gap-1 px-2 py-1 text-xs"
        >
          Open <ExternalLink size={12} />
        </a>
      </div>
    </div>
  );
}

function CatalogView({ title, items, query, onAdd, onTagClick, onCompare, onStageClone }) {
  const [includesRevealCount, setIncludesRevealCount] = useState(0);
  const includesBatchSize = 25;
  const normalizedQuery = String(query || "").trim();

  const visibleItems = useMemo(() => {
    if (!normalizedQuery) return items;

    const highValue = [];
    const includesOnly = [];
    items.forEach((item) => {
      if (isIncludesOnlyMatch(item, normalizedQuery)) includesOnly.push(item);
      else highValue.push(item);
    });

    const revealCount = Math.max(0, includesRevealCount);
    const revealedIncludes = includesOnly.slice(0, revealCount);
    return [...highValue, ...revealedIncludes];
  }, [includesRevealCount, items, normalizedQuery]);

  const includesOnlyCount = useMemo(() => {
    if (!normalizedQuery) return 0;
    return items.reduce((sum, item) => sum + (isIncludesOnlyMatch(item, normalizedQuery) ? 1 : 0), 0);
  }, [items, normalizedQuery]);

  const hiddenIncludesCount = Math.max(0, includesOnlyCount - includesRevealCount);
  const hasRenderableItems = visibleItems.length > 0 || hiddenIncludesCount > 0;

  return (
    <div>
      <h2 className="type-display mb-4">{title}</h2>
      {!hasRenderableItems ? (
        <EmptyState title={`No ${title.toLowerCase()} matches`} text="Try another search term." />
      ) : (
        <div className="space-y-3">
          {!!visibleItems.length && (
            <div className="catalog-grid grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {visibleItems.map((item) => (
                <CatalogCard key={item.id} item={item} query={query} onAdd={onAdd} onTagClick={onTagClick} onCompare={onCompare} onStageClone={onStageClone} />
              ))}
            </div>
          )}
          {hiddenIncludesCount > 0 && (
            <div className="flex items-center justify-center">
              <button
                onClick={() => setIncludesRevealCount((prev) => prev + includesBatchSize)}
                className="glass-control px-3 py-1.5 text-xs"
              >
                Show more includes matches ({hiddenIncludesCount} remaining)
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function CompareModeView({
  items,
  onTagClick,
  onRemoveSeed,
  vendorPriority,
  onChangeVendorPriority,
  boostTerms,
  onAddBoost,
  onRemoveBoost,
  onSaveSnapshot,
  snapshots,
  onLoadSnapshot,
  onTogglePinnedMatch,
}) {
  const [boostDraft, setBoostDraft] = useState("");

  return (
    <div className="space-y-4">
      <ToolDetailsDisclosure
        title="Detailed Compare Mode Guide"
        overview="Compare Mode starts from your saved seed pages and finds related content across vendors using token overlap, category affinity, recency signals, and optional boost terms."
        steps={[
          "Add one or more seed pages with the Compare action from any result card.",
          "The tool computes related items per seed and scores confidence for each relationship.",
          "Use Vendor Priority to bias ranking toward Duo or competitor matches.",
          "Use Boost terms to increase relevance for specific keywords.",
          "Pin high-value matches to keep them prioritized in each seed cluster.",
          "Save snapshots to preserve compare configurations and load them later.",
        ]}
        features={[
          "Seed queue management with add and remove controls",
          "Related match scoring and confidence labels",
          "Vendor priority policy controls",
          "Keyword boosts with removable chips",
          "Pinned match prioritization",
          "Snapshot save and restore for repeat analysis",
        ]}
      />
      <h2 className="type-display">Compare Mode</h2>
      <p className="type-micro">Side-by-side topic coverage between Duo and competitor content.</p>
      {!items.length ? (
        <EmptyState title="Compare queue is empty" text="Use the Compare button on any result to add it here." />
      ) : (
        <>
      <div className="glass-surface p-3">
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-xs text-slate-600 dark:text-slate-300">Vendor Priority</label>
          <select className="glass-control py-1 text-xs" value={vendorPriority} onChange={(e) => onChangeVendorPriority?.(e.target.value)}>
            <option value="balanced">Balanced</option>
            <option value="duo_first">Duo First</option>
            <option value="competitor_first">Competitor First</option>
          </select>
          <button className="glass-control py-1 text-xs" onClick={onSaveSnapshot}>Save Snapshot</button>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {boostTerms.map((term) => (
            <span key={term} className="inline-flex items-center gap-1 rounded-full border border-cyan-300/70 bg-cyan-100/65 px-2 py-0.5 text-[10px] text-cyan-900 dark:border-cyan-700 dark:bg-cyan-900/35 dark:text-cyan-200">
              {term}
              <button onClick={() => onRemoveBoost?.(term)} aria-label={`Remove boost ${term}`}>x</button>
            </span>
          ))}
          <input
            className="glass-control w-40 py-1 text-xs"
            placeholder="Add keyword boost"
            value={boostDraft}
            onChange={(e) => setBoostDraft(e.target.value)}
          />
          <button
            className="glass-control py-1 text-xs"
            onClick={() => {
              if (!boostDraft.trim()) return;
              onAddBoost?.(boostDraft.trim());
              setBoostDraft("");
            }}
          >
            Add Boost
          </button>
        </div>
        {!!snapshots.length && (
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] text-slate-500">Snapshots:</span>
            {snapshots.slice(0, 8).map((snapshot) => (
              <button key={snapshot.id} className="rounded-full border border-white/35 bg-white/35 px-2 py-0.5 text-[10px] dark:border-slate-700/60 dark:bg-slate-900/55" onClick={() => onLoadSnapshot?.(snapshot.id)}>
                {snapshot.label}
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="space-y-3">
        {items.map((pair) => (
          <div key={pair.id} className="glass-surface p-4">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <p className="type-card-title">{pair.title}</p>
              <button
                className="rounded-full border border-cyan-300 bg-cyan-100/70 px-2 py-0.5 text-[10px] font-medium text-cyan-900 dark:border-cyan-700 dark:bg-cyan-900/35 dark:text-cyan-100"
                onClick={(e) => {
                  const mode = e.altKey ? "exclude" : e.shiftKey ? "or" : "and";
                  onTagClick?.(pair.seedVendor, mode);
                }}
              >
                {pair.seedVendor}
              </button>
              <button className="rounded border border-rose-300 px-2 py-0.5 text-[10px] text-rose-700" onClick={() => onRemoveSeed?.(pair.seedId)}>
                Remove
              </button>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <article className="rounded-xl border border-white/35 bg-white/25 p-3 dark:border-slate-700/60 dark:bg-slate-900/40">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">Seed Item</p>
                <p className="mt-1 text-sm font-medium">{pair.seedTitle}</p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{pair.seedSummary || "No summary available."}</p>
                {pair.seedUrl && (
                  <a className="mt-2 inline-flex text-xs text-cyan-700 hover:underline dark:text-cyan-300" href={pair.seedUrl} target="_blank" rel="noreferrer">
                    Open seed page
                  </a>
                )}
              </article>

              <article className="rounded-xl border border-white/35 bg-white/25 p-3 dark:border-slate-700/60 dark:bg-slate-900/40">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">Related Matches</p>
                {!pair.related.length ? (
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">No strong related competitor results yet.</p>
                ) : (
                  <div className="mt-1 space-y-2">
                    {pair.related.map((match) => (
                      <div key={match.id} className="rounded-lg border border-white/30 bg-white/20 p-2 dark:border-slate-700/50 dark:bg-slate-900/30">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs font-medium">{match.title}</p>
                          <button className="rounded border border-cyan-300 px-1.5 py-0.5 text-[10px] text-cyan-800 dark:border-cyan-700 dark:text-cyan-200" onClick={() => onTogglePinnedMatch?.(pair.seedId, match.id)}>
                            {match.pinned ? "Pinned" : "Pin"}
                          </button>
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-300">
                          {match.vendor} · score {match.relationScore} · {match.relationConfidence}
                        </p>
                        {!!match.boostedTokens?.length && (
                          <p className="text-[11px] text-cyan-700 dark:text-cyan-300">boost: {match.boostedTokens.join(", ")}</p>
                        )}
                        <a className="text-[11px] text-cyan-700 hover:underline dark:text-cyan-300" href={match.url} target="_blank" rel="noreferrer">
                          Open match
                        </a>
                      </div>
                    ))}
                  </div>
                )}
              </article>
            </div>
          </div>
        ))}
      </div>
        </>
      )}
    </div>
  );
}

function ChangeHeatmapPanel({ cells, title = "Change Heatmap", onCellClick }) {
  return (
    <section
      style={{
        background: "var(--glass-bg)",
        border: "1.5px solid var(--glass-border)",
        boxShadow: "var(--glass-shadow)",
        backdropFilter: "blur(var(--glass-blur))",
        borderRadius: "var(--glass-radius)",
        padding: "var(--glass-card-padding)",
      }}
    >
      <p className="type-card-title">{title}</p>
      {!cells.length ? (
        <p className="mt-3 text-sm text-slate-500">No recent changes to visualize.</p>
      ) : (
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {cells.map((cell) => (
            <button
              key={`${cell.vendor}_${cell.category}`}
              type="button"
              onClick={() => onCellClick?.(cell)}
              className="rounded-xl border border-white/35 bg-white/25 p-3 text-left transition hover:bg-white/40 dark:border-slate-700/60 dark:bg-slate-900/40 dark:hover:bg-slate-900/55"
              title="Open Explorer with filters for this changed segment"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">{cell.vendor}</p>
                <span className="text-[10px] text-slate-500">{cell.category}</span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200/70 dark:bg-slate-700/70">
                <div className="h-2 rounded-full bg-gradient-to-r from-cyan-500 to-emerald-500" style={{ width: `${Math.min(100, cell.intensity)}%` }} />
              </div>
              <p className="mt-2 text-sm font-semibold">{cell.changedCount} changed</p>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

function SmartGapFinderView({ items, onTagClick, onFeedback, hasRun, onRun }) {
  return (
    <div className="space-y-4">
      <ToolDetailsDisclosure
        title="Detailed Smart Gap Finder Guide"
        overview="Smart Gap Finder scans competitor topics and evaluates whether Duo has equivalent coverage using indexed topic matching, confidence scoring, severity weighting, and feedback signals."
        steps={[
          "Competitor pages are tokenized and compared against Duo candidate pages.",
          "Each gap receives a type, severity score, evidence count, and explanation.",
          "Confirmed gaps receive ranking boosts for ongoing triage.",
          "Dismissed gaps are filtered out to reduce noise.",
          "Use vendor chips to pivot quickly into filtered exploration.",
        ]}
        features={[
          "Gap type classification (taxonomy, workflow, feature depth)",
          "Severity and evidence scoring",
          "Why flagged explanation text",
          "Confirm and dismiss feedback loop",
          "Direct link to source competitor reference",
        ]}
      />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="type-display mb-4">Smart Gap Finder</h2>
        <button className="glass-control px-3 py-1 text-xs" onClick={onRun}>Run Gap Analyzer</button>
      </div>
      {!hasRun ? (
        <EmptyState title="Gap analyzer not run" text="Use Run Gap Analyzer to generate current gap candidates." />
      ) : null}
      {hasRun ? (
        !items.length ? (
          <EmptyState title="No likely gaps detected" text="Coverage looks balanced for current filters." />
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {items.map((gap) => (
              <article key={gap.id} className="glass-surface p-4">
            <p className="type-card-title">{gap.title}</p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-300">Potential gap: {gap.pathSummary}</p>
            <p className="mt-2 text-sm text-glass-secondary">{gap.summary}</p>
            <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-slate-500 dark:text-slate-300">
              <span className="rounded-full border border-white/35 bg-white/35 px-2 py-0.5 dark:border-slate-700/60 dark:bg-slate-900/55">Type: {gap.gapType}</span>
              <span className="rounded-full border border-white/35 bg-white/35 px-2 py-0.5 dark:border-slate-700/60 dark:bg-slate-900/55">Severity: {gap.severity}</span>
              <span className="rounded-full border border-white/35 bg-white/35 px-2 py-0.5 dark:border-slate-700/60 dark:bg-slate-900/55">Evidence: {gap.evidenceCount}</span>
            </div>
            {!!gap.whyFlagged && (
              <p className="mt-2 text-xs text-slate-600 dark:text-slate-300">Why flagged: {gap.whyFlagged}</p>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                className="rounded-full border border-sky-300/70 bg-sky-100/65 px-2 py-0.5 text-[10px] uppercase tracking-[0.08em] text-sky-900 dark:border-sky-700 dark:bg-sky-900/35 dark:text-sky-200"
                onClick={(e) => {
                  const mode = e.altKey ? "exclude" : e.shiftKey ? "or" : "and";
                  onTagClick?.(gap.vendor, mode);
                }}
              >
                {gap.vendor}
              </button>
              <button className="rounded border border-emerald-300 px-2 py-0.5 text-[10px] text-emerald-700" onClick={() => onFeedback?.(gap.id, "confirmed")}>Confirm</button>
              <button className="rounded border border-rose-300 px-2 py-0.5 text-[10px] text-rose-700" onClick={() => onFeedback?.(gap.id, "dismissed")}>Dismiss</button>
              <a className="text-xs text-cyan-700 hover:underline dark:text-cyan-300" href={gap.url} target="_blank" rel="noreferrer">
                Open reference page
              </a>
            </div>
              </article>
            ))}
          </div>
        )
      ) : null}
    </div>
  );
}

function AutoBriefsPanel({ briefs }) {
  return (
    <section
      style={{
        background: "var(--glass-bg)",
        border: "1.5px solid var(--glass-border)",
        boxShadow: "var(--glass-shadow)",
        backdropFilter: "blur(var(--glass-blur))",
        borderRadius: "var(--glass-radius)",
        padding: "var(--glass-card-padding)",
      }}
    >
      <p className="type-card-title">Auto Briefs</p>
      {!briefs.length ? (
        <p className="mt-3 text-sm text-slate-500">No weekly brief data available yet.</p>
      ) : (
        <div className="mt-3 space-y-2">
          {briefs.map((brief) => (
            <div key={brief.id} className="rounded-xl border border-white/35 bg-white/25 p-3 dark:border-slate-700/60 dark:bg-slate-900/40">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold">{brief.vendor}</p>
                <span className={`rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wide ${brief.severityTone}`}>
                  {brief.severity}
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">{brief.summary}</p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function WatchlistView({ watchlists, onCreate, onDelete, alerts }) {
  const [name, setName] = useState("");
  const [keyword, setKeyword] = useState("");
  const [vendor, setVendor] = useState("Any");
  const [threshold, setThreshold] = useState(2);

  return (
    <div className="space-y-4">
      <ToolDetailsDisclosure
        title="Detailed Watchlist Guide"
        overview="Watchlist lets you define persistent monitoring rules that trigger alerts when recent indexed changes match your keywords and optional vendor scope."
        steps={[
          "Create a rule with a name, keyword, vendor filter, and alert threshold.",
          "The tool checks changed content against each rule during analysis.",
          "An alert appears when matched item count meets or exceeds threshold.",
          "Delete outdated rules to keep alerting focused.",
        ]}
        features={[
          "Rule builder with keyword and vendor targeting",
          "Threshold-based alerting",
          "Active rule inventory with quick delete",
          "Alert panel summarizing triggered conditions",
        ]}
      />
      <h2 className="type-display">Watchlist</h2>

      <section className="glass-surface p-4">
        <p className="type-card-title">Create Watch Rule</p>
        <div className="mt-3 grid gap-2 md:grid-cols-5">
          <input className={selectCls()} value={name} onChange={(e) => setName(e.target.value)} placeholder="Rule name" />
          <input className={selectCls()} value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="Keyword" />
          <select className={selectCls()} value={vendor} onChange={(e) => setVendor(e.target.value)}>
            {["Any", "Duo", "Okta", "Entra", "Ping Identity"].map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
          <input className={selectCls()} type="number" min={1} max={100} value={threshold} onChange={(e) => setThreshold(Math.max(1, Number(e.target.value) || 1))} />
          <button
            className="glass-control"
            onClick={() => {
              if (!name.trim() || !keyword.trim()) return;
              onCreate({ name: name.trim(), keyword: keyword.trim(), vendor, threshold: Math.max(1, threshold) });
              setName("");
              setKeyword("");
              setVendor("Any");
              setThreshold(2);
            }}
          >
            Add Rule
          </button>
        </div>
      </section>

      <section className="glass-surface p-4">
        <p className="type-card-title">Active Rules</p>
        {!watchlists.length ? <p className="mt-2 text-sm text-slate-500">No rules yet.</p> : (
          <div className="mt-3 space-y-2">
            {watchlists.map((rule) => (
              <div key={rule.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-white/35 bg-white/25 p-3 dark:border-slate-700/60 dark:bg-slate-900/40">
                <p className="text-sm font-medium">{rule.name}</p>
                <span className="text-xs text-slate-500">keyword: {rule.keyword}</span>
                <span className="text-xs text-slate-500">vendor: {rule.vendor}</span>
                <span className="text-xs text-slate-500">threshold: {rule.threshold}</span>
                <button className="ml-auto rounded border border-rose-300 px-2 py-1 text-xs text-rose-700" onClick={() => onDelete(rule.id)}>Delete</button>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="glass-surface p-4">
        <p className="type-card-title">Alerts</p>
        {!alerts.length ? <p className="mt-2 text-sm text-slate-500">No triggered alerts.</p> : (
          <div className="mt-3 space-y-2">
            {alerts.map((alert) => (
              <div key={alert.id} className="rounded-xl border border-amber-300/50 bg-amber-100/40 p-3 dark:border-amber-700/60 dark:bg-amber-900/25">
                <p className="text-sm font-medium">{alert.ruleName}</p>
                <p className="text-xs text-slate-600 dark:text-slate-300">{alert.message}</p>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function buildDuoCloneInstructionModel(item) {
  const sourceTitle = String(item?.title || "Competitor integration");
  const sourceVendor = String(item?.vendor || "Competitor vendor");
  const sourceUrl = String(item?.url || "");
  const sourceSummary = String(item?.summary || "");
  const sourcePath = String(item?.pathSummary || "");
  const sourceHost = (() => {
    try {
      return new URL(sourceUrl).hostname;
    } catch {
      return "unknown-host";
    }
  })();

  const sourceText = [sourceTitle, sourceSummary, sourcePath, sourceUrl].join(" ").toLowerCase();

  const includeIfMentioned = (terms, field) => {
    return terms.some((term) => sourceText.includes(String(term).toLowerCase())) ? [field] : [];
  };

  const samlSpFields = [
    "SP Entity ID / Audience URI",
    "Assertion Consumer Service (ACS) URL",
    "NameID format and value source",
    "SP x509 signing/encryption cert requirements",
    ...includeIfMentioned(["relaystate", "relay state"], "RelayState behavior/requirements"),
    ...includeIfMentioned(["single logout", "slo", "logout"], "Single Logout (SLO) URL + binding"),
    ...includeIfMentioned(["metadata"], "SP metadata URL or XML descriptor"),
    ...includeIfMentioned(["attribute", "claim", "group", "role"], "Required attribute statement mapping"),
  ];

  const oidcSpFields = [
    "Client ID",
    "Client Secret",
    "Redirect URI / Callback URL",
    "Post Logout Redirect URI",
    "Response type + grant type expectations",
    ...includeIfMentioned(["scope", "scopes"], "Required scopes"),
    ...includeIfMentioned(["pkce"], "PKCE requirement (S256 / verifier policy)"),
    ...includeIfMentioned(["nonce"], "Nonce requirement"),
    ...includeIfMentioned(["state"], "State parameter handling"),
    ...includeIfMentioned(["claim", "claims", "group", "role"], "Required claim mapping"),
    ...includeIfMentioned(["token endpoint auth", "client_secret_basic", "client_secret_post", "private_key_jwt"], "Token endpoint auth method"),
  ];

  return {
    sourceTitle,
    sourceVendor,
    sourceUrl,
    sourceHost,
    saml: {
      duoEntityId: "https://sso-XXXXXXXX.duosecurity.com/saml2/sp/DIXXXXXXXXXXXXXXXXXX",
      acsUrl: "https://sso-XXXXXXXX.duosecurity.com/saml2/sp/DIXXXXXXXXXXXXXXXXXX/acs",
      metadataUrl: "https://sso-XXXXXXXX.duosecurity.com/saml2/sp/DIXXXXXXXXXXXXXXXXXX/metadata",
      nameIdFormat: "urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress",
      requiredAttributes: ["email", "firstName", "lastName", "groups"],
      serviceProviderRequiredFields: Array.from(new Set(samlSpFields)),
    },
    oidc: {
      issuer: "https://sso-XXXXXXXX.duosecurity.com/oauth2",
      authorizationEndpoint: "https://sso-XXXXXXXX.duosecurity.com/oauth2/authorize",
      tokenEndpoint: "https://sso-XXXXXXXX.duosecurity.com/oauth2/token",
      userInfoEndpoint: "https://sso-XXXXXXXX.duosecurity.com/oauth2/userinfo",
      jwksUri: "https://sso-XXXXXXXX.duosecurity.com/oauth2/keys",
      scopes: ["openid", "profile", "email", "groups"],
      claims: ["sub", "email", "email_verified", "given_name", "family_name", "groups"],
      redirectUri: "https://your-app.example.com/callback/duo",
      postLogoutRedirectUri: "https://your-app.example.com/logout/callback",
      serviceProviderRequiredFields: Array.from(new Set(oidcSpFields)),
    },
  };
}

function CloneToDuoTemplateView({ stagedItems, onRemove, onClone }) {
  return (
    <div className="space-y-4">
      <ToolDetailsDisclosure
        title="Detailed Clone To Duo Template Guide"
        overview="Stage competitor integration pages and generate Duo-centric setup templates for SAML and OIDC migration patterns."
        steps={[
          "Use Stage Clone on competitor result cards.",
          "Open this tool to review staged competitor pages.",
          "Click Clone to open a Duo setup blueprint modal with protocol-specific requirements.",
          "Copy and adapt URLs, scopes, attributes, and mappings into your target integration.",
        ]}
        features={[
          "Competitor-only stage queue",
          "One-click protocol setup blueprint",
          "SAML/OIDC field checklist",
          "Attribute and claim mapping template",
        ]}
      />
      <h2 className="type-display">Clone To Duo Template</h2>
      {!stagedItems.length ? (
        <EmptyState title="No staged clone candidates" text="Use Stage Clone on competitor results to build a Duo migration template queue." />
      ) : (
        <div className="space-y-3">
          {stagedItems.map((item) => (
            <article key={item.id} className="glass-surface p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="type-card-title">{item.title}</p>
                  <p className="type-micro mt-1">{item.vendor || "Competitor"} · {item.category || "competitor_docs"}</p>
                  {item.url ? (
                    <a href={item.url} target="_blank" rel="noreferrer" className="mt-1 inline-flex text-xs text-cyan-700 hover:underline dark:text-cyan-300">
                      Open source integration page
                    </a>
                  ) : null}
                </div>
                <div className="flex items-center gap-2">
                  <button className="glass-control px-2 py-1 text-xs" onClick={() => onClone(item)}>
                    Clone
                  </button>
                  <button className="rounded border border-rose-300 px-2 py-1 text-xs text-rose-700" onClick={() => onRemove(item.id)}>
                    Remove
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

function CloneInstructionsModal({ open, item, onClose }) {
  if (!open || !item) return null;
  const model = buildDuoCloneInstructionModel(item);
  const jsonBlock = JSON.stringify(
    {
      source: {
        title: model.sourceTitle,
        vendor: model.sourceVendor,
        url: model.sourceUrl,
      },
      saml: {
        entityId: model.saml.duoEntityId,
        acsUrl: model.saml.acsUrl,
        metadataUrl: model.saml.metadataUrl,
        requiredAttributes: model.saml.requiredAttributes,
        serviceProviderRequiredFields: model.saml.serviceProviderRequiredFields,
      },
      oidc: {
        issuer: model.oidc.issuer,
        authorizationEndpoint: model.oidc.authorizationEndpoint,
        tokenEndpoint: model.oidc.tokenEndpoint,
        userInfoEndpoint: model.oidc.userInfoEndpoint,
        jwksUri: model.oidc.jwksUri,
        scopes: model.oidc.scopes,
        claims: model.oidc.claims,
        serviceProviderRequiredFields: model.oidc.serviceProviderRequiredFields,
      },
    },
    null,
    2
  );

  return (
    <BaseModal open={open} onClose={onClose} title={`Clone Setup Blueprint: ${model.sourceTitle}`} widthClass="max-w-5xl">
      <div className="space-y-4 text-sm">
        <section className="rounded-lg border border-white/30 bg-white/30 p-3 dark:bg-slate-900/50">
          <p className="font-semibold">Source Integration</p>
          <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">Vendor: {model.sourceVendor} · Host: {model.sourceHost}</p>
          {model.sourceUrl ? (
            <a href={model.sourceUrl} target="_blank" rel="noreferrer" className="mt-1 inline-flex text-xs text-cyan-700 hover:underline dark:text-cyan-300">
              Open source page
            </a>
          ) : null}
        </section>

        <section className="rounded-lg border border-white/30 bg-white/30 p-3 dark:bg-slate-900/50">
          <p className="font-semibold">SAML Integration Template</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-slate-600 dark:text-slate-300">
            <li>SP Entity ID: {model.saml.duoEntityId}</li>
            <li>ACS URL: {model.saml.acsUrl}</li>
            <li>Metadata URL: {model.saml.metadataUrl}</li>
            <li>NameID format: {model.saml.nameIdFormat}</li>
            <li>Required attributes: {model.saml.requiredAttributes.join(", ")}</li>
          </ul>
          <p className="mt-2 text-xs font-semibold text-slate-700 dark:text-slate-200">Service Provider fields you should capture and map into Duo:</p>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-xs text-slate-600 dark:text-slate-300">
            {model.saml.serviceProviderRequiredFields.map((field) => (
              <li key={field}>{field}</li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-slate-600 dark:text-slate-300">Recommended attribute mapping: email to user.mail, firstName to user.givenName, lastName to user.surname, groups to user.memberOf.</p>
        </section>

        <section className="rounded-lg border border-white/30 bg-white/30 p-3 dark:bg-slate-900/50">
          <p className="font-semibold">OIDC Integration Template</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-slate-600 dark:text-slate-300">
            <li>Issuer: {model.oidc.issuer}</li>
            <li>Authorization endpoint: {model.oidc.authorizationEndpoint}</li>
            <li>Token endpoint: {model.oidc.tokenEndpoint}</li>
            <li>UserInfo endpoint: {model.oidc.userInfoEndpoint}</li>
            <li>JWKS URI: {model.oidc.jwksUri}</li>
            <li>Redirect URI: {model.oidc.redirectUri}</li>
            <li>Post-logout redirect URI: {model.oidc.postLogoutRedirectUri}</li>
            <li>Required scopes: {model.oidc.scopes.join(", ")}</li>
            <li>Expected claims: {model.oidc.claims.join(", ")}</li>
          </ul>
          <p className="mt-2 text-xs font-semibold text-slate-700 dark:text-slate-200">Service Provider fields you should capture and map into Duo:</p>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-xs text-slate-600 dark:text-slate-300">
            {model.oidc.serviceProviderRequiredFields.map((field) => (
              <li key={field}>{field}</li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-slate-600 dark:text-slate-300">OIDC claim mapping suggestion: sub to immutableUserId, email to username/email, groups to authorization groups.</p>
        </section>

        <section className="rounded-lg border border-white/30 bg-white/30 p-3 dark:bg-slate-900/50">
          <p className="font-semibold">Structured Template Payload</p>
          <pre className="mt-2 max-h-56 overflow-auto rounded border border-white/30 bg-white/35 p-2 text-[11px] dark:bg-slate-900/65">{jsonBlock}</pre>
          <p className="mt-2 text-xs text-slate-600 dark:text-slate-300">Validate all IDs, secrets, redirect URIs, and group/attribute paths in your tenant before production cutover.</p>
        </section>
      </div>

      <div className="mt-5 flex justify-end gap-2">
        <button onClick={onClose} className="rounded-lg border px-3 py-2">Close</button>
      </div>
    </BaseModal>
  );
}

function RelationshipGraphView({ graph }) {
  return (
    <div className="space-y-4">
      <ToolDetailsDisclosure
        title="Detailed Relationship Graph Guide"
        overview="Relationship Graph computes cross-vendor topic overlap and displays strongest link pairs based on shared topic clusters."
        steps={[
          "All indexed items are normalized into topic keys.",
          "Vendors sharing the same topic are connected with weighted edges.",
          "The graph ranks edges by overlap weight and shows top relationships.",
          "Use these links to identify convergence or competitive adjacency areas.",
        ]}
        features={[
          "Vendor-to-vendor overlap weighting",
          "Top relationship extraction",
          "Readable link list with shared-topic counts",
          "Progressive computation status during graph build",
        ]}
      />
      <h2 className="type-display">Relationship Graph</h2>
      <div className="glass-surface p-4">
        {!graph.nodes.length ? (
          <p className="text-sm text-slate-500">Not enough cross-vendor overlap to render graph nodes.</p>
        ) : (
          <div className="space-y-2">
            {graph.links.slice(0, 24).map((link, idx) => (
              <div key={`${link.source}_${link.target}_${idx}`} className="rounded-xl border border-white/35 bg-white/25 p-3 text-sm dark:border-slate-700/60 dark:bg-slate-900/40">
                <span className="font-medium">{link.source}</span>
                <span className="mx-2 text-slate-400">↔</span>
                <span className="font-medium">{link.target}</span>
                <span className="ml-2 text-xs text-slate-500">{link.weight} shared topics</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function EvidenceTrailsView({ items }) {
  return (
    <div className="space-y-4">
      <ToolDetailsDisclosure
        title="Detailed Evidence Trails Guide"
        overview="Evidence Trails presents a chronological set of changed pages with enough metadata to support audit, triage, and follow-up verification."
        steps={[
          "The tool filters indexed content down to recently changed or newly discovered pages.",
          "Results are sorted by latest update metadata.",
          "Each entry includes vendor, reason, path summary, and direct source link.",
          "Use this list as supporting evidence for roadmap and gap decisions.",
        ]}
        features={[
          "Change event timeline with metadata",
          "Reason tagging for update context",
          "Path snapshot context for investigation",
          "Direct open-link workflow for source validation",
        ]}
      />
      <h2 className="type-display">Evidence Trails</h2>
      {!items.length ? (
        <EmptyState title="No evidence trails yet" text="Run a sync to populate change events." />
      ) : (
        <div className="space-y-2">
          {items.map((entry) => (
            <article key={entry.id} className="glass-surface p-4">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-semibold">{entry.title}</p>
                <span className="rounded-full border border-white/40 bg-white/40 px-2 py-0.5 text-[10px] uppercase tracking-wide dark:border-slate-700/80 dark:bg-slate-900/60">{entry.vendor}</span>
                <span className="text-[11px] text-slate-500">{entry.updated || "Unknown date"}</span>
              </div>
              <p className="mt-2 text-xs text-slate-600 dark:text-slate-300">Reason: {entry.recentReason || "change_detected"}</p>
              <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">Snapshot: {entry.pathSummary || "No crawl path summary."}</p>
              <a className="mt-2 inline-flex text-xs text-cyan-700 hover:underline dark:text-cyan-300" href={entry.url} target="_blank" rel="noreferrer">
                Open source page
              </a>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

function FacetedTagFilterPanel({
  open,
  onToggle,
  tags,
  selectedModes,
  onApplyTagMode,
  onClear,
  resultCount,
  totalCount,
}) {
  const orderedTags = [...tags]
    .filter((tag) => (selectedModes[tag.id] || "none") === "none")
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));

  return (
    <div className="glass-surface mb-3 p-2">
      <div className="flex flex-wrap items-center gap-1.5">
        <button onClick={onToggle} className="glass-control px-2 py-0.5 text-[10px]" aria-expanded={open}>
          {open ? "Hide Tag Filters" : "Show Tag Filters"}
        </button>
        <p className="text-[10px] text-slate-600 dark:text-slate-300">
          Showing {resultCount} of {totalCount || resultCount} results
        </p>
        <button onClick={onClear} className="ml-auto rounded-full border border-rose-300 px-2 py-0.5 text-[10px] text-rose-700 hover:bg-rose-50/70">
          Clear Tags
        </button>
      </div>

      {open && (
        <div className="mt-2 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-600 dark:text-slate-300">Tag Facets</p>
            <p className="text-[9px] text-slate-500 dark:text-slate-400">
              Click=AND | Shift+Click=OR | Alt+Click=EXCLUDE
            </p>
          </div>
          {!orderedTags.length ? (
            <p className="text-[10px] text-slate-600 dark:text-slate-300">No common tags available for this view.</p>
          ) : (
            <div className="grid grid-cols-2 gap-1 md:grid-cols-4 xl:grid-cols-6">
              {orderedTags.map((tag) => {
                const selected = selectedModes[tag.id] || "none";
                const selectedTone =
                  selected === "and"
                    ? "border-sky-400/70 bg-sky-200/60 text-sky-900"
                    : selected === "or"
                      ? "border-orange-400/70 bg-orange-200/60 text-orange-900"
                      : selected === "exclude"
                        ? "border-rose-500/80 bg-rose-200/65 text-rose-900"
                        : "border-white/35 bg-white/35 text-slate-700 dark:border-slate-700/60 dark:bg-slate-900/60 dark:text-slate-200";
                return (
                  <div key={tag.id} className={`relative rounded-lg border px-1 py-0.5 ${selectedTone}`}>
                    <button
                      onClick={(e) => {
                        const mode = e.altKey ? "exclude" : e.shiftKey ? "or" : "and";
                        onApplyTagMode(tag.id, mode);
                      }}
                      className="w-full pr-1 text-left"
                      aria-label={`Cycle mode for ${tag.label}`}
                    >
                      <div className="flex items-center gap-1">
                        <p className="truncate text-[11px] font-medium leading-none">{tag.label}</p>
                        <span className="text-[11px] leading-none">({tag.count})</span>
                      </div>
                    </button>
                    {selected !== "none" ? null : null}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function isOktaItem(item) {
  if (String(item?.vendor || "").toLowerCase() === "okta") return true;
  try {
    return new URL(String(item?.url || "")).hostname.toLowerCase().includes("help.okta.com");
  } catch {
    return false;
  }
}

function isEntraItem(item) {
  if (String(item?.vendor || "").toLowerCase() === "entra") return true;
  try {
    const urlObj = new URL(String(item?.url || ""));
    const host = urlObj.hostname.toLowerCase();
    const path = urlObj.pathname.toLowerCase();
    return (host === "learn.microsoft.com" || host.endsWith(".learn.microsoft.com")) && /^\/(?:[a-z]{2}-[a-z]{2}\/)?entra\/identity\/saas-apps(?:\/|$)/i.test(path);
  } catch {
    return false;
  }
}

function isEntraSaasAppsItem(item) {
  return isEntraItem(item);
}

function isPingItem(item) {
  if (String(item?.vendor || "").toLowerCase() === "ping identity") return true;
  try {
    const host = new URL(String(item?.url || "")).hostname.toLowerCase();
    return host === "docs.pingidentity.com" || host.endsWith(".docs.pingidentity.com");
  } catch {
    return false;
  }
}

function flattenNavItems(items) {
  return items.flatMap((item) => [
    item,
    ...(Array.isArray(item.children) ? flattenNavItems(item.children) : []),
  ]);
}

function isCompetitorNavigationKey(viewKey) {
  const normalized = String(viewKey || "").toLowerCase();
  return normalized === "competitor_docs" || normalized.startsWith("okta_") || normalized.startsWith("entra_") || normalized.startsWith("ping_") || normalized.includes("__lang__");
}

function isCompetitorResultItem(item) {
  const vendor = String(item?.vendor || "Duo").toLowerCase();
  return String(item?.category || "") === "competitor_docs" || vendor !== "duo";
}

const TOOL_CONTENT_VIEW_KEYS = ["compare_mode", "smart_gap_finder"];
const NAVIGATION_FACET_KEYS = ["duo", "competitor_docs", "okta", "entra", "ping_identity"];
const NAVIGATION_FACET_KEY_SET = new Set(NAVIGATION_FACET_KEYS);

function isToolContentView(viewKey) {
  return TOOL_CONTENT_VIEW_KEYS.includes(String(viewKey || ""));
}

function normalizeTopicLabel(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/\b(duo|okta|entra|ping|identity|microsoft|docs|documentation)\b/g, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function toTopicKey(item) {
  const title = normalizeTopicLabel(item?.title || "");
  if (title) return title;
  return normalizeTopicLabel(item?.pathSummary || item?.url || "");
}

function changedWeight(item) {
  if (item?.recentReason === "new_page") return 3;
  if (item?.recentReason === "changed_content") return 2;
  return item?.recentlyUpdated ? 1 : 0;
}

const RELATION_STOP_WORDS = new Set([
  "the",
  "and",
  "for",
  "with",
  "from",
  "into",
  "your",
  "this",
  "that",
  "how",
  "what",
  "when",
  "why",
  "using",
  "guide",
  "docs",
  "documentation",
  "duo",
  "okta",
  "entra",
  "ping",
  "identity",
]);

function tokenizeRelationText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 2 && !RELATION_STOP_WORDS.has(token));
}

function toTitleCaseWords(value) {
  return String(value || "")
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

function summarizeTopicTitle(value, maxWords = 8) {
  const cleaned = String(value || "").replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
  const words = cleaned.split(" ").filter(Boolean).slice(0, maxWords);
  return toTitleCaseWords(words.join(" ")) || "Untitled Topic";
}

function relationScore(seed, candidate, options = {}) {
  const boosts = Array.isArray(options.boostTerms) ? options.boostTerms : [];
  const vendorPriority = options.vendorPriority || "balanced";

  const seedTokens = new Set(tokenizeRelationText([seed?.title, seed?.summary, seed?.pathSummary].join(" ")));
  if (!seedTokens.size) return 0;

  const candidateTokens = tokenizeRelationText([candidate?.title, candidate?.summary, candidate?.pathSummary].join(" "));
  let overlap = 0;
  const matchedTokens = [];
  candidateTokens.forEach((token) => {
    if (seedTokens.has(token)) {
      overlap += 1;
      matchedTokens.push(token);
    }
  });

  let score = overlap;
  if ((seed?.category || "") === (candidate?.category || "")) score += 1;
  if (changedWeight(candidate) > 0) score += 1;

  const boostedTokens = [];
  boosts.forEach((term) => {
    const normalized = String(term || "").toLowerCase();
    if (!normalized) return;
    const candidateHaystack = [candidate?.title, candidate?.summary, candidate?.pathSummary].join(" ").toLowerCase();
    if (candidateHaystack.includes(normalized)) {
      score += 2;
      boostedTokens.push(normalized);
    }
  });

  const candidateVendor = String(candidate?.vendor || "Duo").toLowerCase();
  if (vendorPriority === "duo_first" && candidateVendor === "duo") score += 1;
  if (vendorPriority === "competitor_first" && candidateVendor !== "duo") score += 1;

  return { score, matchedTokens, boostedTokens };
}

function relationConfidence(score) {
  if (score >= 8) return "high";
  if (score >= 4) return "medium";
  return "low";
}

function gapTypeForItem(item) {
  const path = String(item?.pathSummary || item?.url || "").toLowerCase();
  const title = String(item?.title || "").toLowerCase();
  if (path.includes("/workflow") || path.includes("/wf") || title.includes("workflow")) return "workflow";
  if (path.includes("/api") || title.includes("api") || title.includes("endpoint")) return "feature_depth";
  return "taxonomy";
}

function buildHeatmapCellsFromMap(map) {
  const values = [...map.values()];
  const maxChanged = Math.max(1, ...values.map((value) => value.changedCount));
  return values
    .map((value) => ({ ...value, intensity: Math.round((value.changedCount / maxChanged) * 100) }))
    .sort((a, b) => b.changedCount - a.changedCount)
    .slice(0, 18);
}

function buildAutoBriefsFromMap(byVendor) {
  return [...byVendor.values()]
    .map((vendor, idx) => {
      const severity = vendor.changed > 120 ? "high" : vendor.changed > 30 ? "medium" : "low";
      const severityTone =
        severity === "high"
          ? "bg-rose-200 text-rose-900 dark:bg-rose-900/40 dark:text-rose-200"
          : severity === "medium"
            ? "bg-amber-200 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200"
            : "bg-emerald-200 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-200";
      return {
        id: `brief_${idx}_${vendor.vendor}`,
        vendor: vendor.vendor,
        severity,
        severityTone,
        summary: `${vendor.changed} pages changed this week, including ${vendor.newPages} newly discovered pages.`,
      };
    })
    .sort((a, b) => (a.severity < b.severity ? 1 : -1));
}

function findRelatedCompareItems(seed, catalog, limit = 6, options = {}) {
  const seedVendor = String(seed?.vendor || "Duo");
  const isSeedDuo = seedVendor.toLowerCase() === "duo";

  const candidates = catalog.filter((item) => {
    const vendor = String(item.vendor || "Duo");
    if (!item?.id || item.id === seed?.id) return false;
    if (vendor === seedVendor) return false;
    if (isSeedDuo) return item.category === "competitor_docs";
    return vendor.toLowerCase() === "duo" || item.category === "competitor_docs";
  });

  return candidates
    .map((item) => {
      const scoreMeta = relationScore(seed, item, options);
      return { item, scoreMeta };
    })
    .filter((entry) => entry.scoreMeta.score > 0)
    .sort((a, b) => b.scoreMeta.score - a.scoreMeta.score || String(a.item.title || "").localeCompare(String(b.item.title || "")))
    .slice(0, limit)
    .map((entry) => ({
      ...entry.item,
      relationScore: entry.scoreMeta.score,
      relationConfidence: relationConfidence(entry.scoreMeta.score),
      matchedTokens: entry.scoreMeta.matchedTokens,
      boostedTokens: entry.scoreMeta.boostedTokens,
    }));
}

const URL_SEGMENT_CACHE = new Map();

function urlPathSegments(rawUrl) {
  const cacheKey = String(rawUrl || "");
  if (URL_SEGMENT_CACHE.has(cacheKey)) return URL_SEGMENT_CACHE.get(cacheKey);
  try {
    const path = new URL(String(rawUrl || "")).pathname.replace(/^\/+|\/+$/g, "");
    const segments = path ? path.split("/").map((segment) => segment.toLowerCase()) : [];
    URL_SEGMENT_CACHE.set(cacheKey, segments);
    return segments;
  } catch {
    URL_SEGMENT_CACHE.set(cacheKey, []);
    return [];
  }
}

function normalizeDiscoveredPrefix(candidate) {
  const value = String(candidate || "").toLowerCase();
  if (!value) return "";
  if (/^[a-z]{2}(?:-[a-z]{2})?$/.test(value)) return "";
  if (/\.(?:htm|html|aspx)$/i.test(value)) return "";
  return value;
}

function firstSegmentAfter(rawUrl, anchorSegments = []) {
  const segments = urlPathSegments(rawUrl);
  if (!segments.length) return "";
  if (!anchorSegments.length) {
    for (const segment of segments) {
      const normalized = normalizeDiscoveredPrefix(segment);
      if (normalized) return normalized;
    }
    return "";
  }

  const anchor = anchorSegments.map((segment) => String(segment || "").toLowerCase());
  for (let i = 0; i <= segments.length - anchor.length; i += 1) {
    const match = anchor.every((segment, idx) => segments[i + idx] === segment);
    if (match) {
      return normalizeDiscoveredPrefix(segments[i + anchor.length] || "");
    }
  }
  return "";
}

function normalizePingBundleSegment(segment) {
  const base = String(segment || "").toLowerCase();
  if (!base) return "";
  const stripped = base.replace(/-\d+(?:[._-]\d+)*$/i, "");
  return normalizeDiscoveredPrefix(stripped || base);
}

function canonicalizePingPrefix(prefix) {
  const value = String(prefix || "").toLowerCase().trim();
  if (!value) return "";

  if (/^integrations?$/.test(value)) return "integrations";
  if (value === "pf" || value.startsWith("pingfederate")) return "pingfederate";
  if (value === "pa" || value.startsWith("pingaccess")) return "pingaccess";
  if (value === "pd" || value.startsWith("pingdirectory")) return "pingdirectory";
  if (value === "idm" || value.startsWith("pingidm")) return "pingidm";
  if (value === "pingid" || value.startsWith("pingidentity")) return "pingidentity";
  if (value.startsWith("pingone")) return "pingone";
  if (value.startsWith("pingauthorize")) return "pingauthorize";
  if (value.startsWith("pingintelligence")) return "pingintelligence";
  if (value.startsWith("pingcentral")) return "pingcentral";
  if (value.startsWith("pingdatagovernance")) return "pingdatagovernance";
  if (value.startsWith("davinci")) return "davinci";

  return value;
}

function pingSecondLevelPrefix(rawUrl) {
  const segments = urlPathSegments(rawUrl);
  if (!segments.length) return "";

  // docs.pingidentity.com/r/en-us/pingfederate-120/... => pingfederate
  if (segments[0] === "r") {
    for (let i = 1; i < segments.length; i += 1) {
      const candidate = normalizeDiscoveredPrefix(segments[i]);
      if (!candidate) continue;
      if (/^[a-z]{2}(?:-[a-z]{2})?$/.test(candidate)) continue;
      const normalized = normalizePingBundleSegment(candidate);
      if (normalized && normalized !== "r") return canonicalizePingPrefix(normalized);
    }
  }

  // docs.pingidentity.com/bundle/pingfederate/page/... => pingfederate
  const bundleIdx = segments.indexOf("bundle");
  if (bundleIdx >= 0) {
    const candidate = canonicalizePingPrefix(normalizePingBundleSegment(segments[bundleIdx + 1] || ""));
    if (candidate) return candidate;
  }

  // Common direct taxonomy paths like /integrations/*, /pingfederate/*, /pingidentity/*
  for (const segment of segments) {
    const normalized = normalizeDiscoveredPrefix(segment);
    if (!normalized) continue;
    if (/^[a-z]{2}(?:-[a-z]{2})?$/.test(normalized)) continue;
    if (["r", "latest", "home", "docs"].includes(normalized)) continue;
    return canonicalizePingPrefix(normalizePingBundleSegment(normalized));
  }

  return "";
}

const PING_SECTION_ORDER = [
  "integrations",
  "pingidentity",
  "pingfederate",
  "pingaccess",
  "pingone",
  "pingauthorize",
  "pingdirectory",
  "pingintelligence",
  "pingcentral",
  "pingdatagovernance",
  "pingidm",
  "davinci",
  "other",
];

const PING_CANONICAL_PREFIXES = new Set(PING_SECTION_ORDER.filter((prefix) => prefix !== "other"));

function toPingSectionPrefix(rawUrl) {
  const prefix = pingSecondLevelPrefix(rawUrl);
  if (!prefix) return "other";
  return PING_CANONICAL_PREFIXES.has(prefix) ? prefix : "other";
}

const COMPETITOR_VENDOR_CONFIGS = [
  {
    key: "okta",
    label: "Okta",
    icon: FolderOpen,
    isItem: isOktaItem,
    getPrefix: (item) => firstSegmentAfter(item?.url),
    fallbackPrefix: "general_docs",
    fallbackLabel: "General Docs",
    maxSections: 30,
    minSectionCount: 50,
    otherPrefix: "other",
    otherLabel: "Other",
    labelOverrides: {
      wf: "Workflows",
      oie: "OIE",
      oag: "OAG",
      asa: "ASA",
    },
  },
  {
    key: "entra",
    label: "Entra",
    icon: FolderOpen,
    isItem: isEntraSaasAppsItem,
    getPrefix: (item) => firstSegmentAfter(item?.url, ["entra", "identity", "saas-apps"]),
    fallbackPrefix: "saas_apps",
    fallbackLabel: "SaaS Apps",
    maxSections: 1,
    minSectionCount: 50,
    otherPrefix: "other",
    otherLabel: "App Integrations",
  },
  {
    key: "ping",
    label: "Ping Identity",
    icon: FolderOpen,
    isItem: isPingItem,
    getPrefix: (item) => toPingSectionPrefix(item?.url),
    fallbackPrefix: "integrations",
    fallbackLabel: "Integrations",
    maxSections: 60,
    minSectionCount: 50,
    otherPrefix: "other",
    otherLabel: "Other",
    labelOverrides: {
      integrations: "Integrations",
      pingidentity: "Ping Identity",
      pingfederate: "PingFederate",
      pingaccess: "PingAccess",
      pingone: "PingOne",
      pingauthorize: "PingAuthorize",
      pingdirectory: "PingDirectory",
      pingintelligence: "PingIntelligence",
      pingcentral: "PingCentral",
      pingdatagovernance: "PingDataGovernance",
      pingidm: "PingIDM",
      davinci: "DaVinci",
      other: "Other",
    },
    sectionOrder: PING_SECTION_ORDER,
  },
];

function toSearchFacetToken(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}


function AssignToTemplateModal({ open, onClose, content, templates, onAssign }) {
  const activeTemplates = templates.filter((t) => !t.deletedAt);
  const [selected, setSelected] = useState([]);

  if (!open || !content) return null;

  const toggle = (id) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  return (
    <BaseModal open={open} onClose={onClose} title={`Add to Template(s): ${content.title}`} widthClass="max-w-2xl">
      <div className="space-y-3">
        <div className="max-h-72 overflow-auto space-y-2">
          {activeTemplates.map((t) => (
            <label key={t.id} className="flex items-center gap-2 p-2 rounded-lg border border-slate-200 dark:border-slate-700">
              <input type="checkbox" checked={selected.includes(t.id)} onChange={() => toggle(t.id)} />
              <span className="text-sm">
                {t.name} v{t.version || 1}
              </span>
            </label>
          ))}
        </div>
        <div className="flex justify-end gap-2">
          <button className="px-3 py-2 rounded-lg border" onClick={onClose}>
            Cancel
          </button>
          <button
            className="px-3 py-2 rounded-lg bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
            onClick={() => onAssign(selected)}
          >
            Add to selected templates
          </button>
        </div>
      </div>
    </BaseModal>
  );
}

function StatusCustomersModal({ open, onClose, title, customers }) {
  return (
    <BaseModal open={open} onClose={onClose} title={title} widthClass="max-w-xl">
      {!customers?.length ? (
        <p className="text-sm text-slate-500">No customers in this bucket.</p>
      ) : (
        <div className="space-y-2">
          {customers.map((c) => (
            <div key={c.id} className="p-2 rounded-lg border border-slate-200 dark:border-slate-700">
              <p className="font-medium text-sm">{c.name}</p>
              <p className="text-xs text-slate-500">
                {c.segment} · AKEY: {c.akey || "—"}
              </p>
            </div>
          ))}
        </div>
      )}
    </BaseModal>
  );
}

function TemplateDetailModal({
  open,
  onClose,
  template,
  customers,
  onOpenStatusCustomers,
  onUpdateTemplate,
}) {
  const [moduleName, setModuleName] = useState("");
  const [moduleType, setModuleType] = useState(MODULE_TYPES.ADDON);

  if (!open || !template) return null;

  const templateModules = normalizeTemplateModules(template);
  const itemsWithModule = getTemplateItemsWithModule(template);

  const customerRows = customers
    .filter((c) => !!(c.assignedTemplates || {})[template.id])
    .map((c) => {
      const assignment = c.assignedTemplates[template.id] || {};
      return { ...c, status: assignment.status || STATUS.DISCUSSED };
    });

  const grouped = STATUS_OPTIONS.reduce((acc, s) => {
    acc[s] = customerRows.filter((c) => c.status === s);
    return acc;
  }, {});

  const addModule = () => {
    if (!moduleName.trim()) return;
    onUpdateTemplate(template.id, (prevTemplate) => {
      const modules = normalizeTemplateModules(prevTemplate);
      const nextModules = [...modules, createTemplateModule(moduleType, moduleName)];
      return ensureTemplateShape({ ...prevTemplate, modules: nextModules });
    });
    setModuleName("");
    setModuleType(MODULE_TYPES.ADDON);
  };

  const removeAddonModule = (moduleId) => {
    onUpdateTemplate(template.id, (prevTemplate) => {
      const modules = normalizeTemplateModules(prevTemplate);
      const target = modules.find((module) => module.id === moduleId);
      if (!target || target.type === MODULE_TYPES.CORE || (target.items || []).length) {
        return ensureTemplateShape(prevTemplate);
      }
      return ensureTemplateShape({
        ...prevTemplate,
        modules: modules.filter((module) => module.id !== moduleId),
      });
    });
  };

  return (
    <BaseModal open={open} onClose={onClose} title={`Template: ${template.name}`} widthClass="max-w-5xl">
      <p className="text-sm text-slate-500 mb-4">
        Version: {template.version || 1} · Group: {template.group} · Modules: {templateModules.length} · Items: {itemsWithModule.length}
      </p>

      <div className="grid md:grid-cols-5 gap-3 mb-4">
        {STATUS_OPTIONS.map((s) => {
          const Icon = statusMeta[s].icon;
          const count = grouped[s]?.length || 0;
          return (
            <button
              key={s}
              onClick={() => onOpenStatusCustomers(statusMeta[s].label, grouped[s] || [])}
              className="rounded-xl border border-slate-200 dark:border-slate-700 p-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <Icon size={14} />
                {statusMeta[s].label}
              </div>
              <p className="text-xl font-semibold mt-1">{count}</p>
            </button>
          );
        })}
      </div>

      <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-3">
        <p className="font-medium mb-2">Template modules</p>
        <div className="grid md:grid-cols-[1fr_160px_auto] gap-2 mb-3">
          <input
            value={moduleName}
            onChange={(e) => setModuleName(e.target.value)}
            className={selectCls()}
            placeholder="Add module name"
          />
          <select value={moduleType} onChange={(e) => setModuleType(e.target.value)} className={selectCls()}>
            <option value={MODULE_TYPES.CORE}>Core</option>
            <option value={MODULE_TYPES.ADDON}>Add-on</option>
          </select>
          <button
            onClick={addModule}
            className="rounded-lg bg-slate-900 px-3 py-2 text-sm text-white dark:bg-slate-100 dark:text-slate-900"
          >
            Add Module
          </button>
        </div>

        {!templateModules.length ? (
          <p className="text-sm text-slate-500">No items yet.</p>
        ) : (
          <div className="space-y-3">
            {templateModules.map((module) => (
              <div key={module.id} className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium">
                    {module.name}
                    <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] uppercase tracking-wide text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                      {module.type}
                    </span>
                  </p>
                  {module.type === MODULE_TYPES.ADDON && !(module.items || []).length && (
                    <button
                      onClick={() => removeAddonModule(module.id)}
                      className="rounded border border-rose-300 px-2 py-1 text-xs text-rose-700"
                    >
                      Remove
                    </button>
                  )}
                </div>
                {!(module.items || []).length ? (
                  <p className="mt-2 text-xs text-slate-500">No items in this module yet.</p>
                ) : (
                  <div className="mt-2 space-y-2">
                    {module.items.map((it) => (
                      <div key={it.id} className="rounded border border-slate-200 p-2 text-sm dark:border-slate-700">
                        <p className="font-medium">{it.label}</p>
                        <p className="text-xs text-slate-500">{it.sourceUrl || "—"}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </BaseModal>
  );
}

function CustomerModal({ open, onClose, customer, templates, setCustomers }) {
  const [selectedTemplateId, setSelectedTemplateId] = useState(
    Object.keys(customer?.assignedTemplates || {})[0] || ""
  );

  if (!open || !customer) return null;

  const activeTemplates = templates.filter((t) => !t.deletedAt);
  const assignedMap = customer.assignedTemplates || {};
  const assignedTemplateIds = Object.keys(assignedMap);

  const updateCustomer = (updater) => {
    setCustomers((prev) => prev.map((c) => (c.id === customer.id ? updater(c) : c)));
  };

  const assignTemplate = (templateId) => {
    if (!templateId) return;
    updateCustomer((c) => {
      if (c.assignedTemplates?.[templateId]) return c;
      const template = activeTemplates.find((t) => t.id === templateId);
      const itemStatuses = {};
      getTemplateItemsWithModule(template).forEach((it) => {
        itemStatuses[getTemplateItemKey(it)] = STATUS.DISCUSSED;
      });
      return {
        ...c,
        assignedTemplates: {
          ...(c.assignedTemplates || {}),
          [templateId]: { status: STATUS.DISCUSSED, itemStatuses },
        },
      };
    });
  };

  const unassignTemplate = (templateId) => {
    updateCustomer((c) => {
      const next = { ...(c.assignedTemplates || {}) };
      delete next[templateId];
      return { ...c, assignedTemplates: next };
    });
    if (selectedTemplateId === templateId) setSelectedTemplateId("");
  };

  const updateTemplateStatus = (templateId, status) => {
    updateCustomer((c) => ({
      ...c,
      assignedTemplates: {
        ...(c.assignedTemplates || {}),
        [templateId]: {
          ...(c.assignedTemplates?.[templateId] || { itemStatuses: {} }),
          status,
        },
      },
    }));
  };

  const updateTemplateItemStatus = (templateId, item, status) => {
    const stableKey = getTemplateItemKey(item);
    updateCustomer((c) => ({
      ...c,
      assignedTemplates: {
        ...(c.assignedTemplates || {}),
        [templateId]: {
          ...(c.assignedTemplates?.[templateId] || { status: STATUS.DISCUSSED, itemStatuses: {} }),
          itemStatuses: {
            ...(c.assignedTemplates?.[templateId]?.itemStatuses || {}),
            [stableKey]: status,
          },
        },
      },
    }));
  };

  const selectedTemplate = activeTemplates.find((t) => t.id === selectedTemplateId);
  const selectedAssignment = selectedTemplateId ? assignedMap[selectedTemplateId] : null;
  const selectedTemplateItems = selectedTemplate ? getTemplateItemsWithModule(selectedTemplate) : [];

  return (
    <BaseModal open={open} onClose={onClose} title={`Customer: ${customer.name}`} widthClass="max-w-6xl">
      <p className="text-sm text-slate-500 mb-3">
        AKEY: {customer.akey || "—"} · Omni: {customer.omniLink || "—"}
      </p>

      <div className="grid lg:grid-cols-[320px_1fr] gap-4">
        <aside className="rounded-xl border border-slate-200 dark:border-slate-700 p-3">
          <p className="text-sm font-medium mb-2">Assigned Templates</p>

          <div className="space-y-2 max-h-[420px] overflow-auto">
            {!assignedTemplateIds.length ? (
              <p className="text-sm text-slate-500">No templates assigned.</p>
            ) : (
              assignedTemplateIds.map((tid) => {
                const t = activeTemplates.find((x) => x.id === tid);
                if (!t) return null;
                const assignment = assignedMap[tid];
                return (
                  <div
                    key={tid}
                    className={`p-2 rounded-lg border ${
                      selectedTemplateId === tid ? "border-blue-500" : "border-slate-200 dark:border-slate-700"
                    }`}
                  >
                    <button onClick={() => setSelectedTemplateId(tid)} className="text-left w-full">
                      <p className="text-sm font-medium">
                        {t.name} v{t.version || 1}
                      </p>
                    </button>
                    <div className="mt-2">
                      <StatusSelect
                        value={assignment.status || STATUS.DISCUSSED}
                        onChange={(s) => updateTemplateStatus(tid, s)}
                      />
                    </div>
                    <button
                      onClick={() => unassignTemplate(tid)}
                      className="mt-2 text-xs px-2 py-1 rounded border border-rose-300 text-rose-700"
                    >
                      Unassign
                    </button>
                  </div>
                );
              })
            )}
          </div>

          <div className="mt-3">
            <p className="text-xs text-slate-500 mb-1">Assign template</p>
            <select className={`${selectCls()} w-full`} onChange={(e) => assignTemplate(e.target.value)} defaultValue="">
              <option value="">Select template...</option>
              {activeTemplates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} v{t.version || 1}
                </option>
              ))}
            </select>
          </div>
        </aside>

        <section className="rounded-xl border border-slate-200 dark:border-slate-700 p-3">
          {!selectedTemplate || !selectedAssignment ? (
            <EmptyState title="No template selected" text="Choose an assigned template." />
          ) : (
            <div className="overflow-auto rounded-lg border border-slate-200 dark:border-slate-700">
              <table className="w-full text-sm">
                <thead className="bg-slate-100 dark:bg-slate-800">
                  <tr>
                    <th className="text-left p-2">Module</th>
                    <th className="text-left p-2">Object</th>
                    <th className="text-left p-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedTemplateItems.map((it) => {
                    const stableKey = getTemplateItemKey(it);
                    const itemStatus =
                      selectedAssignment.itemStatuses?.[stableKey] ||
                      selectedAssignment.itemStatuses?.[it.id] ||
                      STATUS.DISCUSSED;

                    return (
                      <tr key={it.id} className="border-t border-slate-200 dark:border-slate-700">
                        <td className="p-2 text-xs text-slate-500">{it.moduleName}</td>
                        <td className="p-2">{it.label}</td>
                        <td className="p-2">
                          <StatusSelect value={itemStatus} onChange={(s) => updateTemplateItemStatus(selectedTemplate.id, it, s)} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </BaseModal>
  );
}

const SEGMENT_OPTIONS = ["Enterprise", "Mid-Market", "Healthcare", "Public Sector", "Regulated"];

function CreateTemplateModal({ open, onClose, onCreate }) {
  const [name, setName] = useState("");
  const [group, setGroup] = useState(SEGMENT_OPTIONS[0]);
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState("");

  if (!open) return null;

  const onSave = () => {
    const nextErrors = {};
    if (!name.trim()) nextErrors.name = "Template name is required.";
    if (!group.trim()) nextErrors.group = "Group is required.";

    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);
      setSubmitError("Please complete all required fields before saving.");
      return;
    }

    onCreate({ name: name.trim(), group });
    onClose();
  };

  return (
    <BaseModal open={open} onClose={onClose} title="Create New Template" widthClass="max-w-xl">
      <p className="text-xs text-slate-500">Fields marked with * are required.</p>
      {submitError ? (
        <div role="alert" className="mt-3 rounded-lg border border-rose-200 bg-rose-50 p-2 text-sm text-rose-700 dark:border-rose-800/60 dark:bg-rose-900/20 dark:text-rose-300">
          {submitError}
        </div>
      ) : null}

      <div className="mt-3 space-y-3">
        <label className="block text-sm font-medium" htmlFor="create-template-name">
          Template Name <span className="text-rose-600">*</span>
        </label>
        <input
          id="create-template-name"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            if (errors.name) setErrors((prev) => ({ ...prev, name: "" }));
          }}
          className={`${selectCls()} w-full`}
          placeholder="Example: Duo Rollout Baseline"
          aria-invalid={errors.name ? "true" : "false"}
          aria-describedby={errors.name ? "create-template-name-error" : undefined}
        />
        {errors.name ? (
          <p id="create-template-name-error" className="text-xs text-rose-600 dark:text-rose-300">
            {errors.name}
          </p>
        ) : null}

        <label className="block text-sm font-medium" htmlFor="create-template-group">
          Group <span className="text-rose-600">*</span>
        </label>
        <select
          id="create-template-group"
          value={group}
          onChange={(e) => {
            setGroup(e.target.value);
            if (errors.group) setErrors((prev) => ({ ...prev, group: "" }));
          }}
          className={`${selectCls()} w-full`}
          aria-invalid={errors.group ? "true" : "false"}
          aria-describedby={errors.group ? "create-template-group-error" : undefined}
        >
          {SEGMENT_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
        {errors.group ? (
          <p id="create-template-group-error" className="text-xs text-rose-600 dark:text-rose-300">
            {errors.group}
          </p>
        ) : null}
      </div>

      <div className="mt-5 flex justify-end gap-2">
        <button onClick={onClose} className="rounded-lg border px-3 py-2">
          Cancel
        </button>
        <button onClick={onSave} className="rounded-lg bg-slate-900 px-3 py-2 text-white dark:bg-slate-100 dark:text-slate-900">
          Save Template
        </button>
      </div>
    </BaseModal>
  );
}

function CreateCustomerModal({ open, onClose, onCreate }) {
  const [name, setName] = useState("");
  const [segment, setSegment] = useState(SEGMENT_OPTIONS[0]);
  const [akey, setAkey] = useState("");
  const [omniLink, setOmniLink] = useState("");
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState("");

  if (!open) return null;

  const onSave = () => {
    const nextErrors = {};
    if (!name.trim()) nextErrors.name = "Customer name is required.";
    if (!segment.trim()) nextErrors.segment = "Segment is required.";

    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);
      setSubmitError("Please complete all required fields before saving.");
      return;
    }

    onCreate({
      name: name.trim(),
      segment,
      akey: akey.trim(),
      omniLink: omniLink.trim(),
    });
    onClose();
  };

  return (
    <BaseModal open={open} onClose={onClose} title="Add Customer" widthClass="max-w-xl">
      <p className="text-xs text-slate-500">Fields marked with * are required.</p>
      {submitError ? (
        <div role="alert" className="mt-3 rounded-lg border border-rose-200 bg-rose-50 p-2 text-sm text-rose-700 dark:border-rose-800/60 dark:bg-rose-900/20 dark:text-rose-300">
          {submitError}
        </div>
      ) : null}

      <div className="mt-3 space-y-3">
        <label className="block text-sm font-medium" htmlFor="create-customer-name">
          Customer Name <span className="text-rose-600">*</span>
        </label>
        <input
          id="create-customer-name"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            if (errors.name) setErrors((prev) => ({ ...prev, name: "" }));
          }}
          className={`${selectCls()} w-full`}
          placeholder="Example: Acme Corp"
          aria-invalid={errors.name ? "true" : "false"}
          aria-describedby={errors.name ? "create-customer-name-error" : undefined}
        />
        {errors.name ? (
          <p id="create-customer-name-error" className="text-xs text-rose-600 dark:text-rose-300">
            {errors.name}
          </p>
        ) : null}

        <label className="block text-sm font-medium" htmlFor="create-customer-segment">
          Segment <span className="text-rose-600">*</span>
        </label>
        <select
          id="create-customer-segment"
          value={segment}
          onChange={(e) => {
            setSegment(e.target.value);
            if (errors.segment) setErrors((prev) => ({ ...prev, segment: "" }));
          }}
          className={`${selectCls()} w-full`}
          aria-invalid={errors.segment ? "true" : "false"}
          aria-describedby={errors.segment ? "create-customer-segment-error" : undefined}
        >
          {SEGMENT_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
        {errors.segment ? (
          <p id="create-customer-segment-error" className="text-xs text-rose-600 dark:text-rose-300">
            {errors.segment}
          </p>
        ) : null}

        <label className="block text-sm font-medium" htmlFor="create-customer-akey">
          AKEY
        </label>
        <input
          id="create-customer-akey"
          value={akey}
          onChange={(e) => setAkey(e.target.value)}
          className={`${selectCls()} w-full`}
          placeholder="Optional"
        />

        <label className="block text-sm font-medium" htmlFor="create-customer-omnilink">
          Omni Link
        </label>
        <input
          id="create-customer-omnilink"
          value={omniLink}
          onChange={(e) => setOmniLink(e.target.value)}
          className={`${selectCls()} w-full`}
          placeholder="Optional"
        />
      </div>

      <div className="mt-5 flex justify-end gap-2">
        <button onClick={onClose} className="rounded-lg border px-3 py-2">
          Cancel
        </button>
        <button onClick={onSave} className="rounded-lg bg-slate-900 px-3 py-2 text-white dark:bg-slate-100 dark:text-slate-900">
          Save Customer
        </button>
      </div>
    </BaseModal>
  );
}

function ExportModal({ open, onClose, onExport, initialOptions }) {
  const [options, setOptions] = useState(initialOptions);

  if (!open) return null;

  const toggleOption = (id, checked) => {
    setOptions((prev) => ({ ...prev, [id]: checked }));
  };

  const anySelected = Object.values(options || {}).some(Boolean);

  return (
    <BaseModal open={open} onClose={onClose} title="Export Backup" widthClass="max-w-2xl">
      <p className="text-xs text-slate-600 dark:text-slate-300">
        Export a single backup file with selected user-managed data only. Indexed results/content are excluded by design.
      </p>
      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
        {[
          ["appearance", "Appearance & Explorer defaults"],
          ["templates", "Templates"],
          ["customers", "Customers"],
          ["pinnedFilters", "Pinned filters"],
          ["watchlists", "Watchlists"],
          ["compare", "Compare mode preferences"],
          ["gapFeedback", "Gap feedback"],
          ["navigation", "Navigation & pagination preferences"],
          ["audit", "Audit log"],
        ].map(([id, label]) => (
          <label key={id} className="flex items-center gap-2 rounded-lg border border-white/30 bg-white/30 p-2 text-sm dark:bg-slate-900/50">
            <input
              type="checkbox"
              checked={!!options?.[id]}
              onChange={(e) => toggleOption(id, e.target.checked)}
            />
            {label}
          </label>
        ))}
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <button onClick={onClose} className="rounded-lg border px-3 py-2">Cancel</button>
        <button
          onClick={() => {
            onExport(options);
            onClose();
          }}
          className="rounded-lg bg-slate-900 px-3 py-2 text-white disabled:opacity-60 dark:bg-slate-100 dark:text-slate-900"
          disabled={!anySelected}
        >
          Export Backup File
        </button>
      </div>
    </BaseModal>
  );
}

function ImportModal({ open, onClose, onImport }) {
  const [file, setFile] = useState(null);
  const [mergeCollections, setMergeCollections] = useState(false);

  if (!open) return null;

  return (
    <BaseModal open={open} onClose={onClose} title="Import Backup" widthClass="max-w-xl">
      <div className="space-y-3">
        <p className="text-xs text-slate-600 dark:text-slate-300">
          Import from a single backup JSON file. This import does not include index/results content.
        </p>
        <label className="block text-sm font-medium" htmlFor="import-file">Backup JSON file</label>
        <input
          id="import-file"
          type="file"
          accept="application/json"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
          className="glass-control w-full"
        />
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={mergeCollections}
            onChange={(e) => setMergeCollections(e.target.checked)}
          />
          Merge templates/customers by id (instead of replace)
        </label>
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <button onClick={onClose} className="rounded-lg border px-3 py-2">Cancel</button>
        <button
          onClick={() => onImport(file, { mergeCollections })}
          className="rounded-lg bg-slate-900 px-3 py-2 text-white dark:bg-slate-100 dark:text-slate-900"
          disabled={!file}
        >
          Import Backup File
        </button>
      </div>
    </BaseModal>
  );
}

function SettingsModal({
  open,
  onClose,
  dark,
  setDark,
  recentDaysWindow,
  setRecentDaysWindow,
  onOpenExportModal,
  onOpenImportModal,
  onOpenAuditLog,
  indexPaths,
  setIndexPaths,
  indexPathStatus,
  onEstimateIndexPath,
  onLoadIndexFromPath,
  onSaveIndexToPath,
  errorLogEntries,
  onClearErrorLog,
}) {
  const [errorLevelFilter, setErrorLevelFilter] = useState("all");
  const [errorAreaFilter, setErrorAreaFilter] = useState("all");

  const errorAreas = useMemo(
    () => [...new Set(errorLogEntries.map((entry) => String(entry.area || "app")))].sort((a, b) => a.localeCompare(b)),
    [errorLogEntries]
  );

  const filteredErrorLogEntries = useMemo(
    () =>
      errorLogEntries.filter((entry) => {
        const levelMatch = errorLevelFilter === "all" || entry.level === errorLevelFilter;
        const areaMatch = errorAreaFilter === "all" || entry.area === errorAreaFilter;
        return levelMatch && areaMatch;
      }),
    [errorLogEntries, errorLevelFilter, errorAreaFilter]
  );

  if (!open) return null;

  return (
    <BaseModal open={open} onClose={onClose} title="Settings" widthClass="max-w-3xl">
      <div className="space-y-4">
        <section className="rounded-lg border border-white/30 bg-white/30 p-3 dark:bg-slate-900/50">
          <p className="text-sm font-semibold">Appearance</p>
          <label className="mt-2 flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={dark}
              onChange={(e) => setDark(e.target.checked)}
            />
            Enable dark mode
          </label>
        </section>

        <section className="rounded-lg border border-white/30 bg-white/30 p-3 dark:bg-slate-900/50">
          <p className="text-sm font-semibold">Explorer Defaults</p>
          <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-1">
            <label className="text-sm">
              <span className="mb-1 block text-xs text-slate-600 dark:text-slate-300">Recent window (days)</span>
              <input
                type="number"
                min={1}
                max={30}
                value={recentDaysWindow}
                onChange={(e) =>
                  setRecentDaysWindow(Math.max(1, Math.min(30, Number(e.target.value) || 14)))
                }
                className="glass-control w-full px-2"
              />
            </label>
          </div>
        </section>

        <section className="rounded-lg border border-white/30 bg-white/30 p-3 dark:bg-slate-900/50">
          <p className="text-sm font-semibold">Data Transfer</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              onClick={onOpenExportModal}
              className="glass-control inline-flex items-center gap-2 px-3 py-2 text-xs font-semibold"
            >
              <Download size={14} />
              Export Data
            </button>
            <button
              onClick={onOpenImportModal}
              className="glass-control inline-flex items-center gap-2 px-3 py-2 text-xs font-semibold"
            >
              <Upload size={14} />
              Import Data
            </button>
            <button
              onClick={onOpenAuditLog}
              className="glass-control inline-flex items-center gap-2 px-3 py-2 text-xs font-semibold"
            >
              <History size={14} />
              Open Audit Log
            </button>
          </div>
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
            Backups are single-file and include only user-managed data (settings/templates/customers/etc.).
          </p>
        </section>

        <section className="rounded-lg border border-white/30 bg-white/30 p-3 dark:bg-slate-900/50">
          <p className="text-sm font-semibold">Centralized Index Management</p>
          <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
            Use a SharePoint/UNC JSON path for centralized index publishing, and optionally keep local cache copies for faster local loads.
          </p>
          <div className="mt-3 grid grid-cols-1 gap-3">
            <label className="text-sm">
              <span className="mb-1 block text-xs text-slate-600 dark:text-slate-300">SharePoint / central index path</span>
              <input
                value={indexPaths.centralPath}
                onChange={(e) => setIndexPaths((prev) => ({ ...prev, centralPath: e.target.value }))}
                className="glass-control w-full px-2"
                placeholder="Example: \\\\tenant.sharepoint.com@SSL\\DavWWWRoot\\sites\\team\\Shared Documents\\sitenavigator-index.json"
              />
            </label>
            <div className="flex flex-wrap gap-2">
              <button className="glass-control px-2 py-1 text-xs" onClick={() => onEstimateIndexPath(indexPaths.centralPath, "central")}>Estimate Size</button>
              <button className="glass-control px-2 py-1 text-xs" onClick={() => onLoadIndexFromPath(indexPaths.centralPath, "central")}>Load Central Index</button>
              <button className="glass-control px-2 py-1 text-xs" onClick={() => onSaveIndexToPath(indexPaths.centralPath, "central")}>Publish Current Index</button>
            </div>

            <label className="text-sm">
              <span className="mb-1 block text-xs text-slate-600 dark:text-slate-300">Local cache index path</span>
              <input
                value={indexPaths.localCachePath}
                onChange={(e) => setIndexPaths((prev) => ({ ...prev, localCachePath: e.target.value }))}
                className="glass-control w-full px-2"
                placeholder="Example: D:\\SiteNavigator\\index-cache.json"
              />
            </label>
            <div className="flex flex-wrap gap-2">
              <button className="glass-control px-2 py-1 text-xs" onClick={() => onEstimateIndexPath(indexPaths.localCachePath, "local")}>Estimate Size</button>
              <button className="glass-control px-2 py-1 text-xs" onClick={() => onLoadIndexFromPath(indexPaths.localCachePath, "local")}>Load Local Cache</button>
              <button className="glass-control px-2 py-1 text-xs" onClick={() => onSaveIndexToPath(indexPaths.localCachePath, "local")}>Save Local Cache Copy</button>
            </div>

            <label className="text-sm">
              <span className="mb-1 block text-xs text-slate-600 dark:text-slate-300">Active local index file (switch source)</span>
              <input
                value={indexPaths.activeLocalPath}
                onChange={(e) => setIndexPaths((prev) => ({ ...prev, activeLocalPath: e.target.value }))}
                className="glass-control w-full px-2"
                placeholder="Example: E:\\Indexes\\team-index.json"
              />
            </label>
            <div className="flex flex-wrap gap-2">
              <button className="glass-control px-2 py-1 text-xs" onClick={() => onEstimateIndexPath(indexPaths.activeLocalPath, "active")}>Estimate Size</button>
              <button className="glass-control px-2 py-1 text-xs" onClick={() => onLoadIndexFromPath(indexPaths.activeLocalPath, "active")}>Use This Local Index</button>
            </div>

            <div className="rounded-lg border border-white/30 bg-white/35 p-2 text-xs dark:bg-slate-900/55">
              <p><span className="font-semibold">Central:</span> {indexPathStatus.central || "—"}</p>
              <p><span className="font-semibold">Local cache:</span> {indexPathStatus.local || "—"}</p>
              <p><span className="font-semibold">Active local:</span> {indexPathStatus.active || "—"}</p>
              {indexPathStatus.error ? <p className="text-rose-700 dark:text-rose-300">{indexPathStatus.error}</p> : null}
            </div>
          </div>
        </section>

        <section className="rounded-lg border border-white/30 bg-white/30 p-3 dark:bg-slate-900/50">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold">Error Log</p>
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-slate-500 dark:text-slate-300">
                {filteredErrorLogEntries.length} shown / {errorLogEntries.length} total
              </span>
              <button
                type="button"
                onClick={onClearErrorLog}
                className="glass-control px-2 py-1 text-[11px]"
                disabled={!errorLogEntries.length}
              >
                Clear
              </button>
            </div>
          </div>
          {!!errorLogEntries.length && (
            <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
              <label className="text-xs text-slate-600 dark:text-slate-300">
                <span className="mb-1 block">Level</span>
                <select
                  value={errorLevelFilter}
                  onChange={(e) => setErrorLevelFilter(e.target.value)}
                  className="glass-control w-full px-2"
                >
                  <option value="all">All levels</option>
                  <option value="warning">Warning</option>
                  <option value="error">Error</option>
                  <option value="critical">Critical</option>
                </select>
              </label>
              <label className="text-xs text-slate-600 dark:text-slate-300">
                <span className="mb-1 block">Area</span>
                <select
                  value={errorAreaFilter}
                  onChange={(e) => setErrorAreaFilter(e.target.value)}
                  className="glass-control w-full px-2"
                >
                  <option value="all">All areas</option>
                  {errorAreas.map((area) => (
                    <option key={area} value={area}>
                      {area}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          )}
          {!errorLogEntries.length ? (
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">No errors captured yet.</p>
          ) : !filteredErrorLogEntries.length ? (
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">No entries match the selected filters.</p>
          ) : (
            <div className="mt-2 max-h-52 space-y-2 overflow-auto pr-1">
              {filteredErrorLogEntries
                .slice()
                .reverse()
                .slice(0, 80)
                .map((entry) => (
                  <div key={entry.id} className="rounded border border-rose-200 bg-rose-50/80 p-2 text-xs dark:border-rose-900/80 dark:bg-rose-950/40">
                    <p className="font-semibold uppercase tracking-[0.08em] text-rose-700 dark:text-rose-300">
                      {entry.level} · {entry.area}
                    </p>
                    <p className="mt-0.5 text-slate-700 dark:text-slate-100">{entry.message}</p>
                    <p className="mt-0.5 text-[10px] text-slate-500 dark:text-slate-400">{entry.at}</p>
                  </div>
                ))}
            </div>
          )}
        </section>
      </div>

      <div className="mt-5 flex justify-end gap-2">
        <button onClick={onClose} className="rounded-lg border px-3 py-2">Close</button>
      </div>
    </BaseModal>
  );
}

function TemplatesView({
  templates,
  deletedTemplates,
  customers,
  setTemplates,
  restoreTemplate,
  query,
  onOpenTemplateDetails,
  onOpenCreateTemplate,
}) {
  const [deleteTarget, setDeleteTarget] = useState(null);

  const activeTemplates = templates.filter((t) => !t.deletedAt);
  const filtered = activeTemplates.filter((t) =>
    [t.name, t.group, ...flattenTemplateItems(t).map((i) => i.label)].join(" ").toLowerCase().includes(query.toLowerCase())
  );

  const confirmDelete = () => {
    if (!deleteTarget) return;
    const assigned = customers.filter((c) => (c.assignedTemplates || {})[deleteTarget.id]).length;
    if (assigned > 0) {
      alert(`Cannot delete, assigned to ${assigned} customer(s).`);
      return;
    }
    setTemplates((prev) =>
      prev.map((t) => (t.id === deleteTarget.id ? { ...t, deletedAt: nowIso() } : t))
    );
    setDeleteTarget(null);
  };

  return (
    <div className="space-y-4 fade-in-up">
      <ConfirmModal
        open={!!deleteTarget}
        title="Delete template?"
        body="Move to Recently Deleted."
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="type-display">Templates</h2>
        <div className="flex items-center gap-2">
          <PageInfoButton
            title="Templates"
            body="Templates define reusable rollout blueprints for customer deployments. You can create, compose, version, and assign template modules, then track adoption and status through customer assignments."
          />
          <button
            onClick={onOpenCreateTemplate}
            className="inline-flex items-center gap-2 rounded-lg bg-cyan-700 px-3 py-2 text-sm text-white shadow-lg shadow-cyan-700/25 transition hover:-translate-y-0.5 hover:bg-cyan-600"
          >
            <Plus size={14} />
            Create Template
          </button>
        </div>
      </div>

      {!filtered.length ? (
        <EmptyState title="No templates found" text="Use Create Template to add one." />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((t) => (
            <div key={t.id} className="glass-surface p-4">
              {(() => {
                const modules = normalizeTemplateModules(t);
                const itemCount = flattenTemplateItems(t).length;
                const addonCount = modules.filter((module) => module.type === MODULE_TYPES.ADDON).length;
                return (
                  <>
                    <h3 className="type-card-title">
                      {t.name} <span className="type-micro">v{t.version || 1}</span>
                    </h3>
                    <p className="type-micro">Group: {t.group}</p>
                    <p className="type-micro mt-1">Items: {itemCount}</p>
                    <p className="type-micro">Modules: {modules.length} ({addonCount} add-ons)</p>
                    <p className="type-micro">Assigned: {t.usage || 0}</p>
                    <div className="mt-3 flex gap-2">
                      <button onClick={() => onOpenTemplateDetails(t.id)} className="glass-control px-2 py-1 text-xs">
                        Open Composer
                      </button>
                      <button
                        onClick={() => setDeleteTarget(t)}
                        className="rounded border border-rose-300 bg-white/30 px-2 py-1 text-xs text-rose-700 transition hover:bg-rose-50/80 dark:bg-slate-900/40"
                      >
                        Delete
                      </button>
                    </div>
                  </>
                );
              })()}
            </div>
          ))}
        </div>
      )}

      <div className="glass-surface p-4">
        <h3 className="type-card-title mb-2">Recently Deleted</h3>
        {!deletedTemplates.length ? (
          <p className="text-sm text-slate-500">None</p>
        ) : (
          deletedTemplates.map((t) => (
            <div key={t.id} className="mb-2 flex items-center justify-between rounded-xl border border-white/30 bg-white/35 p-2 text-sm dark:bg-slate-900/55">
              <span>{t.name}</span>
              <button onClick={() => restoreTemplate(t.id)} className="glass-control px-2 py-1 text-xs">
                Restore
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function CustomersView({ customers, query, onOpenCustomer, onOpenCreateCustomer, onDeleteCustomer }) {
  const filtered = customers.filter((c) =>
    [c.name, c.segment, c.akey, c.omniLink].join(" ").toLowerCase().includes(query.toLowerCase())
  );
  const [deleteTarget, setDeleteTarget] = useState(null);

  const confirmDelete = () => {
    if (!deleteTarget) return;
    onDeleteCustomer?.(deleteTarget.id);
    setDeleteTarget(null);
  };

  return (
    <div className="space-y-4 fade-in-up">
      <ConfirmModal
        open={!!deleteTarget}
        title="Delete Customer?"
        body={deleteTarget ? `Delete '${deleteTarget.name}' from customer records?` : "Delete customer?"}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="type-display">Customers</h2>
        <div className="flex items-center gap-2">
          <PageInfoButton
            title="Customers"
            body="Customers are tracked deployment accounts where you assign templates, maintain rollout status, and monitor progress. Use this page to open customer detail records and manage customer entries."
          />
          <button
            onClick={onOpenCreateCustomer}
            className="inline-flex items-center gap-2 rounded-lg bg-teal-700 px-3 py-2 text-sm text-white shadow-lg shadow-teal-700/25 transition hover:-translate-y-0.5 hover:bg-teal-600"
          >
            <Plus size={14} />
            Add Customer
          </button>
        </div>
      </div>

      {!filtered.length ? (
        <EmptyState title="No customers" text="Use Add Customer to create one." />
      ) : (
        <div className="glass-surface overflow-hidden">
          <div className="hidden grid-cols-12 border-b border-white/30 bg-white/30 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-600 md:grid dark:bg-slate-900/45 dark:text-slate-300">
            <div className="col-span-3">Customer</div>
            <div className="col-span-2">Segment</div>
            <div className="col-span-2">A-Key</div>
            <div className="col-span-3">Omni Link</div>
            <div className="col-span-2">Actions</div>
          </div>
          {filtered.map((c) => (
            <div key={c.id} className="grid gap-2 border-t border-white/30 p-3 text-sm md:grid-cols-12 dark:border-slate-700/70">
              <div className="md:col-span-3">
                <p className="text-[11px] uppercase tracking-wide text-slate-500 md:hidden">Customer</p>
                <p className="type-card-title">{c.name}</p>
              </div>
              <div className="md:col-span-2">
                <p className="text-[11px] uppercase tracking-wide text-slate-500 md:hidden">Segment</p>
                <p>{c.segment}</p>
              </div>
              <div className="md:col-span-2">
                <p className="text-[11px] uppercase tracking-wide text-slate-500 md:hidden">A-Key</p>
                <p>{c.akey || "—"}</p>
              </div>
              <div className="md:col-span-3">
                <p className="text-[11px] uppercase tracking-wide text-slate-500 md:hidden">Omni Link</p>
                {c.omniLink ? (
                  <a href={c.omniLink} target="_blank" rel="noreferrer" className="text-blue-600 dark:text-blue-300">
                    Open
                  </a>
                ) : (
                  "—"
                )}
              </div>
              <div className="md:col-span-2">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => onOpenCustomer(c.id)}
                    className="glass-control px-2 py-1 text-xs"
                    aria-label={`Open customer ${c.name}`}
                  >
                    Open
                  </button>
                  {String(c.id || "").startsWith("c_") && (
                    <button
                      onClick={() => setDeleteTarget(c)}
                      className="rounded border border-rose-300 px-2 py-1 text-xs text-rose-700"
                      aria-label={`Delete customer ${c.name}`}
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AuditView({ audit, confirmedItems, dismissedItems, onDismissConfirmed }) {
  const [tab, setTab] = useState("entries");

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl font-semibold">Audit Log</h2>
        <PageInfoButton
          title="Audit Log"
          body="Audit Log stores application events, including exports/imports, sync actions, and Smart Gap decision tracking. Use tabs to review base system history, confirmed gap records, and dismissed gap records."
        />
      </div>

      <div className="glass-surface flex flex-wrap gap-2 p-2">
        {[
          { id: "entries", label: "Audit Entries" },
          { id: "confirmed", label: "Smart Gap Confirmed Items" },
          { id: "dismissed", label: "Smart Gap Dismissed Items" },
        ].map((item) => (
          <button
            key={item.id}
            onClick={() => setTab(item.id)}
            className={`rounded-full px-3 py-1 text-xs ${
              tab === item.id
                ? "border border-cyan-300/80 bg-cyan-100/75 text-cyan-900 dark:border-cyan-700 dark:bg-cyan-900/35 dark:text-cyan-200"
                : "border border-white/35 bg-white/35 text-slate-600 dark:border-slate-700/60 dark:bg-slate-900/50 dark:text-slate-200"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === "entries" && (
        !audit.length ? (
          <EmptyState title="No audit entries yet" text="Actions appear here." />
        ) : (
          audit
            .slice()
            .reverse()
            .map((a) => (
              <div key={a.id} className="rounded border border-slate-200 bg-white p-3 text-sm dark:border-slate-800 dark:bg-slate-900">
                <p className="font-medium">{a.action}</p>
                <p>{a.message}</p>
                <p className="text-xs text-slate-500">{a.at}</p>
              </div>
            ))
        )
      )}

      {tab === "confirmed" && (
        !confirmedItems.length ? (
          <EmptyState title="No confirmed smart gaps" text="Confirm items from Smart Gap Finder to track them here." />
        ) : (
          <div className="space-y-2">
            {confirmedItems.map((item) => (
              <div key={item.id} className="glass-surface p-3">
                <p className="text-sm font-semibold">{item.title}</p>
                <p className="text-xs text-slate-500">{item.vendor} · {item.category}</p>
                {item.url && (
                  <a className="mt-1 inline-flex text-xs text-cyan-700 hover:underline dark:text-cyan-300" href={item.url} target="_blank" rel="noreferrer">
                    Open reference page
                  </a>
                )}
                <div className="mt-2">
                  <button className="rounded border border-rose-300 px-2 py-1 text-xs text-rose-700" onClick={() => onDismissConfirmed?.(item.id)}>
                    Dismiss
                  </button>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {tab === "dismissed" && (
        !dismissedItems.length ? (
          <EmptyState title="No dismissed smart gaps" text="Dismiss items from Smart Gap Finder to track them here." />
        ) : (
          <div className="space-y-2">
            {dismissedItems.map((item) => (
              <div key={item.id} className="glass-surface p-3">
                <p className="text-sm font-semibold">{item.title}</p>
                <p className="text-xs text-slate-500">{item.vendor} · {item.category}</p>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
}

function ChecklistView({ customers, templates, onOpenCustomer }) {
  const activeTemplates = templates.filter((t) => !t.deletedAt);

  const rows = customers.map((c) => {
    const assigned = Object.entries(c.assignedTemplates || {});
    const templateStatuses = assigned.map(([, val]) => val?.status || STATUS.DISCUSSED);
    const implemented = templateStatuses.filter((s) => s === STATUS.IMPLEMENTED).length;
    const inProgress = templateStatuses.filter((s) => s === STATUS.IN_PROGRESS).length;
    const interested = templateStatuses.filter((s) => s === STATUS.INTERESTED).length;
    const discussed = templateStatuses.filter((s) => s === STATUS.DISCUSSED).length;
    const notInterested = templateStatuses.filter((s) => s === STATUS.NOT_INTERESTED).length;
    const pct = assigned.length ? Math.round((implemented / assigned.length) * 100) : 0;

    return {
      id: c.id,
      name: c.name,
      assignedCount: assigned.length,
      implemented,
      inProgress,
      interested,
      discussed,
      notInterested,
      completionPct: pct,
    };
  });

  const totalAssigned = rows.reduce((sum, r) => sum + r.assignedCount, 0);
  const totalImplemented = rows.reduce((sum, r) => sum + r.implemented, 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="type-display">Checklist Workspace</h2>
        <PageInfoButton
          title="Checklist Workspace"
          body="Checklist Workspace provides a portfolio-level status grid across customers and assigned templates, so you can quickly evaluate rollout progress and open customer records for follow-up actions."
        />
      </div>
      <div className="grid md:grid-cols-4 gap-3">
        <div className="rounded-xl p-4 border bg-white dark:bg-slate-900">
          <p className="type-label">Customers</p>
          <p className="text-2xl font-semibold mt-1">{customers.length}</p>
        </div>
        <div className="rounded-xl p-4 border bg-white dark:bg-slate-900">
          <p className="type-label">Active Templates</p>
          <p className="text-2xl font-semibold mt-1">{activeTemplates.length}</p>
        </div>
        <div className="rounded-xl p-4 border bg-white dark:bg-slate-900">
          <p className="type-label">Assigned Rollouts</p>
          <p className="text-2xl font-semibold mt-1">{totalAssigned}</p>
        </div>
        <div className="rounded-xl p-4 border bg-white dark:bg-slate-900">
          <p className="type-label">Implemented</p>
          <p className="text-2xl font-semibold mt-1">{totalImplemented}</p>
        </div>
      </div>

      {!rows.length ? (
        <EmptyState title="No customers yet" text="Create customers to start checklist tracking." />
      ) : (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-auto">
          <table className="w-full text-sm min-w-[860px]">
            <thead className="bg-slate-100 dark:bg-slate-800">
              <tr>
                <th className="text-left p-3">Customer</th>
                <th className="text-left p-3">Assigned</th>
                <th className="text-left p-3">Implemented</th>
                <th className="text-left p-3">In Progress</th>
                <th className="text-left p-3">Interested</th>
                <th className="text-left p-3">Discussed</th>
                <th className="text-left p-3">Not Interested</th>
                <th className="text-left p-3">Completion</th>
                <th className="text-left p-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-slate-200 dark:border-slate-700">
                  <td className="p-3 font-medium">{r.name}</td>
                  <td className="p-3">{r.assignedCount}</td>
                  <td className="p-3">{r.implemented}</td>
                  <td className="p-3">{r.inProgress}</td>
                  <td className="p-3">{r.interested}</td>
                  <td className="p-3">{r.discussed}</td>
                  <td className="p-3">{r.notInterested}</td>
                  <td className="p-3">{r.completionPct}%</td>
                  <td className="p-3">
                    <button
                      onClick={() => onOpenCustomer(r.id)}
                      className="text-xs px-2 py-1 rounded border"
                    >
                      Open
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function ManageCustomersView({
  tab,
  setTab,
  templatesView,
  customersView,
  checklistView,
}) {
  return (
    <div className="space-y-4">
      <h2 className="type-display">Manage Customers</h2>
      <div className="glass-surface flex flex-wrap gap-2 p-2">
        {[
          { id: "customers", label: "Customers" },
          { id: "templates", label: "Templates" },
          { id: "checklist", label: "Checklist" },
        ].map((item) => (
          <button
            key={item.id}
            onClick={() => setTab(item.id)}
            className={`rounded-full px-3 py-1 text-xs ${
              tab === item.id
                ? "border border-cyan-300/80 bg-cyan-100/75 text-cyan-900 dark:border-cyan-700 dark:bg-cyan-900/35 dark:text-cyan-200"
                : "border border-white/35 bg-white/35 text-slate-600 dark:border-slate-700/60 dark:bg-slate-900/50 dark:text-slate-200"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === "customers" && customersView}
      {tab === "templates" && templatesView}
      {tab === "checklist" && checklistView}
    </div>
  );
}

/** =========================================================
 * App
 * ========================================================= */
export default function App() {
  const FETCH_ALL_RESULTS_PAGE_SIZE = 0;
  const MAX_DISPLAY_RESULTS = 100;
  const defaultBackupOptions = {
    appearance: true,
    templates: true,
    customers: true,
    pinnedFilters: true,
    watchlists: true,
    compare: true,
    gapFeedback: true,
    navigation: true,
    audit: false,
  };

  const [active, setActive] = useState("dashboard");
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [recentDaysWindow, setRecentDaysWindow] = useState(() =>
    readStorage(STORAGE_KEYS.recentDaysWindow, 14)
  );
  const [backupOptions, setBackupOptions] = useState(() =>
    readStorage(STORAGE_KEYS.backupPrefs, defaultBackupOptions)
  );
  const [indexPaths, setIndexPaths] = useState(() =>
    readStorage(STORAGE_KEYS.indexPaths, { centralPath: "", localCachePath: "", activeLocalPath: "" })
  );
  const [indexPathStatus, setIndexPathStatus] = useState({
    central: "",
    local: "",
    active: "",
    error: "",
  });

  const [dark, setDark] = useState(() => readStorage(STORAGE_KEYS.darkMode, false));
  const [templates, setTemplates] = useState(() =>
    readStorage(STORAGE_KEYS.templates, defaultTemplates).map(ensureTemplateShape)
  );
  const [customers, setCustomers] = useState(() =>
    readStorage(STORAGE_KEYS.customers, defaultCustomers).map(ensureCustomerShape)
  );
  const [audit, setAudit] = useState(() => readStorage(STORAGE_KEYS.audit, defaultAudit));
  const [lastBackupAt, setLastBackupAt] = useState(() => readStorage(STORAGE_KEYS.lastBackupAt, null));
  const [indexedContent, setIndexedContent] = useState(defaultIndexedContent);

  const [openCustomerId, setOpenCustomerId] = useState(null);
  const [createTemplateModalOpen, setCreateTemplateModalOpen] = useState(false);
  const [createCustomerModalOpen, setCreateCustomerModalOpen] = useState(false);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [assignContent, setAssignContent] = useState(null);
  const [templateDetailId, setTemplateDetailId] = useState(null);
  const [statusCustomersModal, setStatusCustomersModal] = useState({
    open: false,
    title: "",
    customers: [],
  });

  const [syncState, setSyncState] = useState({
    loading: false,
    inProgress: false,
    lastRun: null,
    error: "",
    progress: { percent: 0, processed: 0, queued: 0, currentUrl: "", currentDepth: 0 },
  });
  const [contentState, setContentState] = useState({
    loading: false,
    error: "",
    lastLoadedAt: null,
  });
  const [contentMeta, setContentMeta] = useState({
    count: 0,
    newlyDiscovered: 0,
    recentlyUpdated: 0,
    counts: {
      blog: 0,
      docs: 0,
      release_notes: 0,
      guides: 0,
      resources: 0,
      help_kb: 0,
      demos: 0,
      ecosystem_marketplace: 0,
      competitor_docs: 0,
      other: 0,
    },
    page: 1,
    pageSize: 25,
    totalPages: 1,
    hasNextPage: false,
    hasPrevPage: false,
  });
  const [contentPage, setContentPage] = useState(1);
  const [contentPageSize, setContentPageSize] = useState(MAX_DISPLAY_RESULTS);
  const [explorerCategory, setExplorerCategory] = useState("");
  const [facetModes, setFacetModes] = useState({});
  const [searchFacetTerms, setSearchFacetTerms] = useState([]);
  const [paginationByView, setPaginationByView] = useState(() =>
    readStorage(STORAGE_KEYS.paginationByView, {})
  );
  const [facetPanelByView, setFacetPanelByView] = useState(() =>
    readStorage(STORAGE_KEYS.facetPanelByView, {})
  );
  const [pinnedFilters, setPinnedFilters] = useState(() =>
    readStorage(STORAGE_KEYS.pinnedFilters, [])
  );
  const [watchlists, setWatchlists] = useState(() => readStorage(STORAGE_KEYS.watchlists, []));
  const [cloneStageItems, setCloneStageItems] = useState([]);
  const [cloneInstructionTarget, setCloneInstructionTarget] = useState(null);
  const [compareSeedIds, setCompareSeedIds] = useState(() => readStorage(STORAGE_KEYS.compareSeeds, []));
  const [comparePrefs, setComparePrefs] = useState(() =>
    readStorage(STORAGE_KEYS.comparePrefs, {
      vendorPriority: "balanced",
      boostTerms: [],
      pinnedMatchIdsBySeed: {},
    })
  );
  const [compareSnapshots, setCompareSnapshots] = useState(() =>
    readStorage(STORAGE_KEYS.compareSnapshots, [])
  );
  const [gapFeedback, setGapFeedback] = useState(() => readStorage(STORAGE_KEYS.gapFeedback, {}));
  const [compareModeItems, setCompareModeItems] = useState([]);
  const [smartGapItems, setSmartGapItems] = useState([]);
  const [heatmapCells, setHeatmapCells] = useState([]);
  const [autoBriefs, setAutoBriefs] = useState([]);
  const [relationshipGraph, setRelationshipGraph] = useState({ nodes: [], links: [] });
  const [evidenceTrailItems, setEvidenceTrailItems] = useState([]);
  const [toolLoadState, setToolLoadState] = useState({
    compare: { loading: false, progress: 0 },
    gap: { loading: false, progress: 0 },
    heatmap: { loading: false, progress: 0 },
    briefs: { loading: false, progress: 0 },
    graph: { loading: false, progress: 0 },
    evidence: { loading: false, progress: 0 },
  });
  const [toolComputedAt, setToolComputedAt] = useState({
    compare: null,
    gap: null,
    heatmap: null,
    briefs: null,
    graph: null,
    evidence: null,
  });
  const [lastAddedFacetId, setLastAddedFacetId] = useState(null);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [manageCustomersTab, setManageCustomersTab] = useState("customers");
  const [smartGapRunNonce, setSmartGapRunNonce] = useState(0);

  const [toast, setToast] = useState({ show: false, message: "" });
  const [debugLogs, setDebugLogs] = useState(() => readStorage(STORAGE_KEYS.debugLogs, []));
  const [criticalWarning, setCriticalWarning] = useState(null);
  const searchInputRef = useRef(null);
  const lastPaginationRestoreViewRef = useRef("");
  const criticalWarningTimeoutRef = useRef(null);
  const previousActiveViewRef = useRef("");
  const syncPollRetryLoggedRef = useRef(false);
  const lastUiuxLogRef = useRef({ key: "", at: 0 });

  const pushDebugLog = useCallback(
    ({ level = "info", area = "app", action = "EVENT", message = "", details = null, important = false }) => {
      const normalizedLevel = ["debug", "info", "warning", "error", "critical"].includes(level)
        ? level
        : "info";
      const entry = {
        id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        level: normalizedLevel,
        area,
        action,
        message: String(message || action || "App event"),
        details,
        at: nowIso(),
      };

      setDebugLogs((prev) => [...prev.slice(-499), entry]);

      if (important || normalizedLevel === "error" || normalizedLevel === "critical") {
        setCriticalWarning({ id: entry.id, message: `[${area}] ${entry.message}` });
        if (criticalWarningTimeoutRef.current) {
          clearTimeout(criticalWarningTimeoutRef.current);
        }
        criticalWarningTimeoutRef.current = setTimeout(() => {
          setCriticalWarning((prev) => (prev?.id === entry.id ? null : prev));
        }, 5000);
      }

      if (import.meta.env.DEV) {
        const writer = normalizedLevel === "error" || normalizedLevel === "critical" ? console.error : console.log;
        writer(`[${normalizedLevel}] [${area}] ${action}: ${entry.message}`, details || "");
      }
    },
    []
  );

  const deferredQuery = useDeferredValue(debouncedQuery);
  const normalizedRawQuery = query.trim().toLowerCase();
  const isExplorer = active === "explorer";
  const isContentView =
    isExplorer || CATALOG_TABS.includes(active) || isCompetitorNavigationKey(active) || isToolContentView(active);
  const isFacetPaginationView =
    CONTENT_VIEWS.includes(active) || isCompetitorNavigationKey(active) || isToolContentView(active);
  const contentQuery = isContentView ? deferredQuery : "";
  const searchPending = isContentView && deferredQuery !== normalizedRawQuery;
  const hasBlockingModal =
    !!assignModalOpen ||
    !!templateDetailId ||
    !!statusCustomersModal.open ||
    !!openCustomerId ||
    !!createTemplateModalOpen ||
    !!createCustomerModalOpen ||
    !!exportModalOpen ||
    !!settingsModalOpen ||
    !!importModalOpen;

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(normalizedRawQuery), 180);
    return () => clearTimeout(t);
  }, [normalizedRawQuery]);

  useEffect(() => {
    return () => {
      if (criticalWarningTimeoutRef.current) {
        clearTimeout(criticalWarningTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const isIgnorableUiUxMessage = (message, source = "") => {
      const msg = String(message || "");
      const src = String(source || "");
      if (!msg && !src) return true;

      const ignorablePatterns = [
        /aborterror/i,
        /the operation was aborted/i,
        /resizeobserver loop limit exceeded/i,
        /resizeobserver loop completed with undelivered notifications/i,
        /^script error\.?$/i,
      ];

      if (ignorablePatterns.some((pattern) => pattern.test(msg))) return true;
      if (/(chrome-extension|moz-extension|extensions::)/i.test(msg) || /(chrome-extension|moz-extension|extensions::)/i.test(src)) {
        return true;
      }

      return false;
    };

    const isLikelyAppSource = (source) => {
      const src = String(source || "");
      if (!src) return false;
      if (src.includes("/src/") || src.includes("/assets/index") || src.includes("App.jsx")) return true;
      if (typeof window !== "undefined" && window.location?.origin && src.includes(window.location.origin)) {
        return true;
      }
      return false;
    };

    const shouldSuppressDuplicate = (key) => {
      const now = Date.now();
      const last = lastUiuxLogRef.current;
      if (last.key === key && now - last.at < 5000) {
        return true;
      }
      lastUiuxLogRef.current = { key, at: now };
      return false;
    };

    const onError = (event) => {
      const message = event?.message || "Unhandled window error";
      const source = event?.filename || "";
      if (isIgnorableUiUxMessage(message, source)) return;
      if (!isLikelyAppSource(`${source} ${event?.error?.stack || ""}`)) return;

      const key = `WINDOW_ERROR:${message}:${source}:${event?.lineno || 0}:${event?.colno || 0}`;
      if (shouldSuppressDuplicate(key)) return;

      pushDebugLog({
        level: "error",
        area: "uiux",
        action: "WINDOW_ERROR",
        message,
        details: {
          filename: source,
          line: event?.lineno || 0,
          column: event?.colno || 0,
        },
        important: false,
      });
    };

    const onUnhandledRejection = (event) => {
      const reasonMessage = event?.reason?.message || String(event?.reason || "Unhandled promise rejection");
      const reasonStack = event?.reason?.stack || "";
      if (isIgnorableUiUxMessage(reasonMessage, reasonStack)) return;
      if (!isLikelyAppSource(`${reasonMessage} ${reasonStack}`)) return;

      const key = `UNHANDLED_REJECTION:${reasonMessage}`;
      if (shouldSuppressDuplicate(key)) return;

      pushDebugLog({
        level: "error",
        area: "uiux",
        action: "UNHANDLED_REJECTION",
        message: reasonMessage,
        details: { reason: reasonMessage },
        important: false,
      });
    };

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onUnhandledRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onUnhandledRejection);
    };
  }, [pushDebugLog]);

  useEffect(() => {
    if (!previousActiveViewRef.current) {
      previousActiveViewRef.current = active;
      return;
    }
    if (previousActiveViewRef.current === active) return;

    pushDebugLog({
      level: "debug",
      area: "navigation",
      action: "VIEW_CHANGED",
      message: `View changed from ${previousActiveViewRef.current} to ${active}`,
      details: { from: previousActiveViewRef.current, to: active },
    });
    previousActiveViewRef.current = active;
  }, [active, pushDebugLog]);

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === "/") {
        const target = e.target;
        const tag = target?.tagName?.toLowerCase();
        if (tag === "input" || tag === "textarea" || target?.isContentEditable || hasBlockingModal) return;
        e.preventDefault();
        searchInputRef.current?.focus();
      }
      if (e.key === "Escape" && mobileNavOpen) {
        setMobileNavOpen(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [mobileNavOpen, hasBlockingModal]);

  useEffect(() => {
    document.body.classList.toggle("modal-open", hasBlockingModal);
    return () => document.body.classList.remove("modal-open");
  }, [hasBlockingModal]);

  useEffect(() => {
    document.body.classList.toggle("content-view-no-fx", isContentView);
    return () => document.body.classList.remove("content-view-no-fx");
  }, [isContentView]);

  useEffect(() => {
    setTemplates((prev) => {
      const next = prev.map(ensureTemplateShape);
      if (JSON.stringify(next) === JSON.stringify(prev)) return prev;
      return next;
    });
  }, []);

  useEffect(() => {
    setCustomers((prev) => {
      const next = prev.map(ensureCustomerShape);
      if (JSON.stringify(next) === JSON.stringify(prev)) return prev;
      return next;
    });
  }, []);

  useEffect(() => {
    if (!isContentView) {
      lastPaginationRestoreViewRef.current = "";
      return;
    }
    if (lastPaginationRestoreViewRef.current === active) return;
    const viewState = paginationByView[active] || {};
    setContentPage(Math.max(1, Number(viewState.page) || 1));
    setContentPageSize(
      Math.max(1, Math.min(MAX_DISPLAY_RESULTS, Number(viewState.pageSize) || MAX_DISPLAY_RESULTS))
    );
    // Do not carry a category filter into Explorer.
    setExplorerCategory("");
    lastPaginationRestoreViewRef.current = active;
  }, [active, isContentView, MAX_DISPLAY_RESULTS, paginationByView]);

  useEffect(() => {
    if (!isContentView || !isFacetPaginationView) return;
    setPaginationByView((prev) => {
      const nextForActive = {
        page: contentPage,
        pageSize: contentPageSize,
        explorerCategory: active === "explorer" ? explorerCategory : "",
      };
      const prevForActive = prev[active] || {};
      if (
        prevForActive.page === nextForActive.page &&
        prevForActive.pageSize === nextForActive.pageSize &&
        prevForActive.explorerCategory === nextForActive.explorerCategory
      ) {
        return prev;
      }
      return { ...prev, [active]: nextForActive };
    });
  }, [active, isContentView, isFacetPaginationView, contentPage, contentPageSize, explorerCategory]);

  const facetPanelOpen = useMemo(() => {
    if (!isContentView) return false;
    return !!(facetPanelByView[active] || {}).open;
  }, [active, isContentView, facetPanelByView]);

  const setFacetPanelOpenForActive = (valueOrUpdater) => {
    if (!isContentView || !isFacetPaginationView) return;
    setFacetPanelByView((prev) => {
      const currentOpen = !!(prev[active] || {}).open;
      const nextOpen =
        typeof valueOrUpdater === "function" ? !!valueOrUpdater(currentOpen) : !!valueOrUpdater;
      if (currentOpen === nextOpen) return prev;
      return { ...prev, [active]: { open: nextOpen } };
    });
  };

  const pushAudit = (action, message) => {
    setAudit((prev) => [
      ...prev,
      { id: `a_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`, action, message, at: nowIso() },
    ]);
  };

  const deletedTemplates = useMemo(() => templates.filter((t) => !!t.deletedAt), [templates]);
  const backupStale = daysSince(lastBackupAt) > 14;

  const openCustomer = customers.find((c) => c.id === openCustomerId) || null;
  const openTemplate = templates.find((t) => t.id === templateDetailId) || null;

  const catalog = useMemo(() => indexedContent.map(mapIndexedToCatalogItem), [indexedContent]);

  const itemsByCategory = useMemo(
    () => ({
      blog: catalog.filter((i) => i.category === "blog"),
      docs: catalog.filter((i) => i.category === "docs"),
      release_notes: catalog.filter((i) => i.category === "release_notes"),
      guides: catalog.filter((i) => i.category === "guides"),
      resources: catalog.filter((i) => i.category === "resources"),
      help_kb: catalog.filter((i) => i.category === "help_kb"),
      demos: catalog.filter((i) => i.category === "demos"),
      ecosystem_marketplace: catalog.filter((i) => i.category === "ecosystem_marketplace"),
        competitor_docs: catalog.filter((i) => i.category === "competitor_docs"),
      other: catalog.filter(
          (i) =>
          !["blog", "docs", "release_notes", "guides", "resources", "help_kb", "demos", "ecosystem_marketplace", "competitor_docs"].includes(i.category)
      ),
    }),
    [catalog]
  );

  const competitorNavItems = useMemo(
    () =>
      COMPETITOR_VENDOR_CONFIGS.map((vendor) => {
        const discoveredSections = buildDiscoveredVendorSections(catalog, vendor, { defaultSectionIcon: FileText });
        return {
          key: `${vendor.key}_folder`,
          label: vendor.label,
          icon: vendor.icon,
          viewTitle: `${vendor.label} Documentation`,
          children: discoveredSections.map((section) => {
            const sectionKey =
              vendor.key === "okta" && section.key === "general_docs"
                ? "competitor_docs"
                : `${vendor.key}_${section.key}`;

            return {
              key: sectionKey,
              label: section.label,
              icon: section.icon,
              predicate: section.predicate,
              viewTitle: `${vendor.label} / ${section.label}`,
            };
          }),
        };
      }),
    [catalog]
  );

  const competitorItemsByNavKey = useMemo(() => {
    const grouped = {};

    const collectNodeItems = (node) => {
      if (!node.children?.length) {
        const leafItems = catalog.filter(node.predicate || (() => false));
        grouped[node.key] = leafItems;
        return leafItems;
      }

      const nestedItems = node.children.flatMap((child) => collectNodeItems(child));
      grouped[node.key] = nestedItems;
      return nestedItems;
    };

    competitorNavItems.forEach((item) => {
      collectNodeItems(item);
    });

    return grouped;
  }, [catalog, competitorNavItems]);

  const flattenedCompetitorNavItems = useMemo(() => flattenNavItems(competitorNavItems), [competitorNavItems]);
  const activeCompetitorNavItem = useMemo(
    () => flattenedCompetitorNavItems.find((item) => item.key === active) || null,
    [flattenedCompetitorNavItems, active]
  );

  const needsCompareData = active === "compare_mode";
  const needsGapData = active === "smart_gap_finder";
  const needsHeatmapData = active === "dashboard" || active === "change_heatmap";
  const needsBriefData = active === "dashboard";
  const needsEvidenceData = active === "evidence_trails";
  const needsGraphData = active === "relationship_graph";
  const needsWatchAlerts = active === "watchlist";

  useEffect(() => {
    if (!needsCompareData) {
      setCompareModeItems([]);
      setToolLoadState((prev) => ({ ...prev, compare: { loading: false, progress: 0 } }));
      return;
    }

    let cancelled = false;
    const vendorPriority = comparePrefs.vendorPriority || "balanced";
    const boostTerms = Array.isArray(comparePrefs.boostTerms) ? comparePrefs.boostTerms : [];
    const pinnedBySeed = comparePrefs.pinnedMatchIdsBySeed || {};
    const byId = new Map(catalog.map((item) => [item.id, item]));
    const seedIds = [...compareSeedIds];
    const built = [];
    const chunkSize = 4;

    setToolLoadState((prev) => ({ ...prev, compare: { loading: true, progress: 0 } }));

    const step = (startIndex) => {
      if (cancelled) return;
      const slice = seedIds.slice(startIndex, startIndex + chunkSize);
      slice.forEach((seedId, offset) => {
        const seed = byId.get(seedId);
        if (!seed) return;
        const relatedRaw = findRelatedCompareItems(seed, catalog, 8, { vendorPriority, boostTerms });
        const pinnedIds = new Set(Array.isArray(pinnedBySeed[seed.id]) ? pinnedBySeed[seed.id] : []);
        const related = relatedRaw
          .map((item) => ({ ...item, pinned: pinnedIds.has(item.id) }))
          .sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.relationScore - a.relationScore)
          .slice(0, 6);
        built.push({
          id: `cmp_${startIndex + offset}_${seed.id}`,
          seedId: seed.id,
          seedVendor: seed.vendor || "Duo",
          title: summarizeTopicTitle(seed.title),
          summary: seed.summary || seed.pathSummary || "No summary available.",
          category: seed.category || "other",
          vendor: seed.vendor || "Duo",
          tags: ["Compare", seed.vendor || "Duo", ...(Array.isArray(seed.tags) ? seed.tags : [])],
          recentlyUpdated: !!seed.recentlyUpdated,
          recentReason: seed.recentReason || "none",
          pathSummary: seed.pathSummary,
          url: seed.url,
          seedTitle: seed.title,
          seedSummary: seed.summary,
          seedUrl: seed.url,
          related,
        });
      });

      const nextIndex = startIndex + chunkSize;
      const progress = seedIds.length ? Math.round((Math.min(nextIndex, seedIds.length) / seedIds.length) * 100) : 100;
      setCompareModeItems([...built]);
      setToolLoadState((prev) => ({ ...prev, compare: { loading: nextIndex < seedIds.length, progress } }));

      if (nextIndex < seedIds.length) {
        setTimeout(() => step(nextIndex), 0);
      } else {
        setToolComputedAt((prev) => ({ ...prev, compare: Date.now() }));
      }
    };

    step(0);
    return () => {
      cancelled = true;
    };
  }, [compareSeedIds, catalog, comparePrefs, needsCompareData]);

  useEffect(() => {
    if (!needsGapData) {
      setToolLoadState((prev) => ({ ...prev, gap: { loading: false, progress: 0 } }));
      return;
    }
    if (smartGapRunNonce < 1) {
      setSmartGapItems([]);
      setToolLoadState((prev) => ({ ...prev, gap: { loading: false, progress: 0 } }));
      return;
    }

    let cancelled = false;
    const feedbackSnapshot = { ...gapFeedback };
    const duoItems = catalog.filter((item) => String(item.vendor || "Duo").toLowerCase() === "duo");
    const duoById = new Map(duoItems.map((item) => [item.id, item]));
    const duoTokenIndex = new Map();
    duoItems.forEach((item) => {
      const tokens = new Set(tokenizeRelationText([item.title, item.summary, item.pathSummary].join(" ")).slice(0, 24));
      tokens.forEach((token) => {
        const existing = duoTokenIndex.get(token) || new Set();
        existing.add(item.id);
        duoTokenIndex.set(token, existing);
      });
    });

    const topicVendorSpread = new Map();
    catalog.forEach((item) => {
      if (item.category !== "competitor_docs") return;
      const topic = toTopicKey(item);
      if (!topic) return;
      const current = topicVendorSpread.get(topic) || new Set();
      current.add(String(item.vendor || "Competitor"));
      topicVendorSpread.set(topic, current);
    });

    const competitorItems = catalog.filter((item) => item.category === "competitor_docs");
    const minimumStrongGapEvidence = 2;
    const built = [];
    const chunkSize = 20;

    setToolLoadState((prev) => ({ ...prev, gap: { loading: true, progress: 0 } }));

    const step = (startIndex) => {
      if (cancelled) return;
      const slice = competitorItems.slice(startIndex, startIndex + chunkSize);

      slice.forEach((item) => {
        const seedTokens = tokenizeRelationText([item.title, item.summary, item.pathSummary].join(" ")).slice(0, 18);
        const candidateIds = new Set();
        seedTokens.forEach((token) => {
          const ids = duoTokenIndex.get(token);
          if (!ids) return;
          ids.forEach((id) => candidateIds.add(id));
        });

        const relatedCandidates = [...candidateIds]
          .slice(0, 120)
          .map((id) => duoById.get(id))
          .filter(Boolean)
          .map((candidate) => {
            const scoreMeta = relationScore(item, candidate, { vendorPriority: "duo_first", boostTerms: [] });
            return {
              ...candidate,
              relationScore: scoreMeta.score,
              relationConfidence: relationConfidence(scoreMeta.score),
              matchedTokens: scoreMeta.matchedTokens,
              boostedTokens: scoreMeta.boostedTokens,
            };
          })
          .filter((candidate) => candidate.relationScore > 0)
          .sort((a, b) => b.relationScore - a.relationScore)
          .slice(0, 3);

        const relatedDuo = relatedCandidates[0] || null;
        const topicKey = toTopicKey(item);
        const evidenceCount = topicVendorSpread.get(topicKey)?.size || 0;
        const relationConfidenceScore = relatedDuo?.relationScore || 0;
        const recencyScore = changedWeight(item);
        const spreadScore = Math.min(4, evidenceCount);
        const severityScore = spreadScore + recencyScore + Math.max(0, 6 - relationConfidenceScore);
        const severity = severityScore >= 9 ? "high" : severityScore >= 6 ? "medium" : "low";
        const isStrongGap = !relatedDuo && evidenceCount >= minimumStrongGapEvidence;
        const gapType = gapTypeForItem(item);
        const matched = relatedDuo?.matchedTokens?.slice(0, 4) || [];
        const missingHint = tokenizeRelationText(item.title).slice(0, 4).filter((token) => !matched.includes(token));
        const whyFlagged = relatedDuo
          ? `Weak Duo alignment (${relationConfidenceScore}). matched: ${matched.join(", ") || "none"}; missing: ${missingHint.join(", ") || "none"}.`
          : `No Duo counterpart above threshold. evidence vendors: ${evidenceCount}. missing: ${missingHint.join(", ") || "none"}.`;
        const feedbackState = feedbackSnapshot[`gap_${item.id}`] || "none";

        built.push({
          ...item,
          id: `gap_${item.id}`,
          title: `${item.vendor || "Competitor"} ${summarizeTopicTitle(item.title, 6)}`,
          summary: relatedDuo
            ? `Potential ${gapType.replace("_", " ")} gap. Closest Duo topic: '${summarizeTopicTitle(relatedDuo.title, 6)}'.`
            : `Likely ${gapType.replace("_", " ")} gap with no reliable Duo equivalent detected.`,
          tags: [
            ...(Array.isArray(item.tags) ? item.tags : []),
            isStrongGap ? "strong_gap" : "partial_gap",
            `gap_${gapType}`,
            `severity_${severity}`,
          ],
          relatedScore: relationConfidenceScore,
          relatedDuoTitle: relatedDuo?.title || "",
          severity,
          severityScore,
          gapType,
          whyFlagged,
          evidenceCount,
          feedbackState,
        });
      });

      const nextIndex = startIndex + chunkSize;
      const progress = competitorItems.length
        ? Math.round((Math.min(nextIndex, competitorItems.length) / competitorItems.length) * 100)
        : 100;

      const partial = built
        .filter((item) => item.feedbackState !== "dismissed" && item.feedbackState !== "confirmed")
        .sort((a, b) => {
          const feedbackBoostA = a.feedbackState === "confirmed" ? 5 : 0;
          const feedbackBoostB = b.feedbackState === "confirmed" ? 5 : 0;
          return (b.severityScore + feedbackBoostB) - (a.severityScore + feedbackBoostA);
        })
        .slice(0, 300);

      setSmartGapItems(partial);
      setToolLoadState((prev) => ({ ...prev, gap: { loading: nextIndex < competitorItems.length, progress } }));

      if (nextIndex < competitorItems.length) {
        setTimeout(() => step(nextIndex), 0);
      } else {
        setToolComputedAt((prev) => ({ ...prev, gap: Date.now() }));
      }
    };

    step(0);
    return () => {
      cancelled = true;
    };
  }, [needsGapData, smartGapRunNonce, catalog, gapFeedback]);

  const smartGapFeedbackItems = useMemo(() => {
    const byId = new Map(catalog.map((item) => [item.id, item]));
    return Object.entries(gapFeedback || {})
      .map(([key, state]) => {
        const sourceId = key.replace(/^gap_/, "");
        const source = byId.get(sourceId);
        if (!source) return null;
        return {
          id: key,
          sourceId,
          state,
          title: source.title || source.pathSummary || source.url,
          vendor: source.vendor || "Competitor",
          category: source.category || "other",
          url: source.url || "",
        };
      })
      .filter(Boolean);
  }, [catalog, gapFeedback]);

  const smartGapConfirmedItems = useMemo(
    () => smartGapFeedbackItems.filter((item) => item.state === "confirmed"),
    [smartGapFeedbackItems]
  );
  const smartGapDismissedItems = useMemo(
    () => smartGapFeedbackItems.filter((item) => item.state === "dismissed"),
    [smartGapFeedbackItems]
  );

  useEffect(() => {
    if (!needsHeatmapData) {
      setHeatmapCells([]);
      setToolLoadState((prev) => ({ ...prev, heatmap: { loading: false, progress: 0 } }));
      return;
    }

    let cancelled = false;
    const map = new Map();
    const chunkSize = 160;
    setToolLoadState((prev) => ({ ...prev, heatmap: { loading: true, progress: 0 } }));

    const step = (startIndex) => {
      if (cancelled) return;
      const slice = catalog.slice(startIndex, startIndex + chunkSize);

      slice.forEach((item) => {
        const vendor = item.vendor || "Duo";
        const category = item.category || "other";
        const key = vendor.toLowerCase() === "duo" ? "duo__all" : `${vendor}__${category}`;
        const current = map.get(key) || {
          vendor,
          category: vendor.toLowerCase() === "duo" ? "all categories" : category,
          changedCount: 0,
        };
        if (changedWeight(item) > 0) current.changedCount += 1;
        map.set(key, current);
      });

      const nextIndex = startIndex + chunkSize;
      const scanProgress = catalog.length ? Math.round((Math.min(nextIndex, catalog.length) / catalog.length) * 90) : 90;
      setHeatmapCells(buildHeatmapCellsFromMap(map));

      if (nextIndex < catalog.length) {
        setToolLoadState((prev) => ({ ...prev, heatmap: { loading: true, progress: scanProgress } }));
        setTimeout(() => step(nextIndex), 0);
        return;
      }

      setToolLoadState((prev) => ({ ...prev, heatmap: { loading: false, progress: 100 } }));
      setToolComputedAt((prev) => ({ ...prev, heatmap: Date.now() }));
    };

    step(0);
    return () => {
      cancelled = true;
    };
  }, [catalog, needsHeatmapData]);

  useEffect(() => {
    if (!needsBriefData) {
      setAutoBriefs([]);
      setToolLoadState((prev) => ({ ...prev, briefs: { loading: false, progress: 0 } }));
      return;
    }

    let cancelled = false;
    const byVendor = new Map();
    const chunkSize = 160;
    setToolLoadState((prev) => ({ ...prev, briefs: { loading: true, progress: 0 } }));

    const step = (startIndex) => {
      if (cancelled) return;
      const slice = catalog.slice(startIndex, startIndex + chunkSize);

      slice.forEach((item) => {
        const vendor = item.vendor || "Duo";
        const current = byVendor.get(vendor) || { vendor, changed: 0, newPages: 0 };
        if (item.recentReason === "new_page") current.newPages += 1;
        if (changedWeight(item) > 0) current.changed += 1;
        byVendor.set(vendor, current);
      });

      const nextIndex = startIndex + chunkSize;
      const scanProgress = catalog.length ? Math.round((Math.min(nextIndex, catalog.length) / catalog.length) * 90) : 90;
      setAutoBriefs(buildAutoBriefsFromMap(byVendor));

      if (nextIndex < catalog.length) {
        setToolLoadState((prev) => ({ ...prev, briefs: { loading: true, progress: scanProgress } }));
        setTimeout(() => step(nextIndex), 0);
        return;
      }

      setToolLoadState((prev) => ({ ...prev, briefs: { loading: false, progress: 100 } }));
      setToolComputedAt((prev) => ({ ...prev, briefs: Date.now() }));
    };

    step(0);
    return () => {
      cancelled = true;
    };
  }, [catalog, needsBriefData]);

  useEffect(() => {
    if (!needsEvidenceData) {
      setEvidenceTrailItems([]);
      setToolLoadState((prev) => ({ ...prev, evidence: { loading: false, progress: 0 } }));
      return;
    }

    let cancelled = false;
    const chunkSize = 120;
    const built = [];
    setToolLoadState((prev) => ({ ...prev, evidence: { loading: true, progress: 0 } }));

    const step = (startIndex) => {
      if (cancelled) return;
      const slice = catalog.slice(startIndex, startIndex + chunkSize);
      slice.forEach((item) => {
        if (changedWeight(item) > 0) built.push(item);
      });
      const nextIndex = startIndex + chunkSize;
      const progress = catalog.length ? Math.round((Math.min(nextIndex, catalog.length) / catalog.length) * 100) : 100;
      const partial = [...built]
        .sort((a, b) => String(b.updated || "").localeCompare(String(a.updated || "")))
        .slice(0, 120);
      setEvidenceTrailItems(partial);
      setToolLoadState((prev) => ({ ...prev, evidence: { loading: nextIndex < catalog.length, progress } }));
      if (nextIndex < catalog.length) {
        setTimeout(() => step(nextIndex), 0);
      } else {
        setToolComputedAt((prev) => ({ ...prev, evidence: Date.now() }));
      }
    };

    step(0);
    return () => {
      cancelled = true;
    };
  }, [catalog, needsEvidenceData]);

  useEffect(() => {
    if (!needsGraphData) {
      setRelationshipGraph({ nodes: [], links: [] });
      setToolLoadState((prev) => ({ ...prev, graph: { loading: false, progress: 0 } }));
      return;
    }

    let cancelled = false;
    const topicVendors = new Map();
    const chunkSize = 120;
    setToolLoadState((prev) => ({ ...prev, graph: { loading: true, progress: 0 } }));

    const stepCatalog = (startIndex) => {
      if (cancelled) return;
      const slice = catalog.slice(startIndex, startIndex + chunkSize);
      slice.forEach((item) => {
        const topic = toTopicKey(item);
        if (!topic) return;
        const set = topicVendors.get(topic) || new Set();
        set.add(item.vendor || "Duo");
        topicVendors.set(topic, set);
      });

      const nextIndex = startIndex + chunkSize;
      const progress = catalog.length ? Math.round((Math.min(nextIndex, catalog.length) / catalog.length) * 70) : 70;
      setToolLoadState((prev) => ({ ...prev, graph: { loading: true, progress } }));

      if (nextIndex < catalog.length) {
        setTimeout(() => stepCatalog(nextIndex), 0);
        return;
      }

      const topicEntries = [...topicVendors.values()];
      const edgeWeights = new Map();

      topicEntries.forEach((vendors) => {
        const list = [...vendors].sort();
        for (let i = 0; i < list.length; i += 1) {
          for (let j = i + 1; j < list.length; j += 1) {
            const key = `${list[i]}__${list[j]}`;
            edgeWeights.set(key, (edgeWeights.get(key) || 0) + 1);
          }
        }
      });

      const links = [...edgeWeights.entries()]
        .map(([key, weight]) => {
          const [source, target] = key.split("__");
          return { source, target, weight };
        })
        .sort((a, b) => b.weight - a.weight)
        .slice(0, 40);
      const nodes = [...new Set(links.flatMap((link) => [link.source, link.target]))].map((id) => ({ id }));
      setRelationshipGraph({ nodes, links });
      setToolLoadState((prev) => ({ ...prev, graph: { loading: false, progress: 100 } }));
      setToolComputedAt((prev) => ({ ...prev, graph: Date.now() }));
    };

    stepCatalog(0);
    return () => {
      cancelled = true;
    };
  }, [catalog, needsGraphData]);

  const watchlistAlerts = useMemo(() => {
    if (!needsWatchAlerts) return [];
    return watchlists.flatMap((rule) => {
      const matched = catalog.filter((item) => {
        const keyword = String(rule.keyword || "").toLowerCase();
        if (!keyword) return false;
        const haystack = [item.title, item.summary, item.pathSummary, item.vendor, item.category].join(" ").toLowerCase();
        const keywordMatch = haystack.includes(keyword);
        const vendorMatch = rule.vendor === "Any" || String(item.vendor || "Duo") === rule.vendor;
        return keywordMatch && vendorMatch && changedWeight(item) > 0;
      });
      if (matched.length < Number(rule.threshold || 1)) return [];
      return [{
        id: `alert_${rule.id}`,
        ruleName: rule.name,
        message: `${matched.length} items matched '${rule.keyword}' (threshold ${rule.threshold}).`,
      }];
    });
  }, [watchlists, catalog, needsWatchAlerts]);

  const activeRawItems = useMemo(() => {
    if (active === "explorer") return catalog;
    if (active === "compare_mode") return compareModeItems;
    if (active === "smart_gap_finder") return smartGapItems;
    if (isCompetitorNavigationKey(active)) return competitorItemsByNavKey[active] || [];
    if (CATALOG_TABS.includes(active)) return itemsByCategory[active] || [];
    return [];
  }, [active, catalog, compareModeItems, smartGapItems, itemsByCategory, competitorItemsByNavKey]);

  const facetTagDefinitions = useMemo(
    () =>
      createPresetFacetTagDefinitions(searchFacetTerms, {
        isOktaItem,
        isEntraItem,
        isPingItem,
      }),
    [searchFacetTerms]
  );

  const contentFacetModes = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(facetModes).filter(([id]) => !NAVIGATION_FACET_KEY_SET.has(id))
      ),
    [facetModes]
  );

  const filteredCatalogForNavCounts = useMemo(
    () => applyFacetModes(catalog, facetTagDefinitions, contentFacetModes),
    [catalog, facetTagDefinitions, contentFacetModes]
  );

  const prospectiveCategoryCounts = useMemo(() => {
    const next = {
      other: 0,
      docs: 0,
      release_notes: 0,
      guides: 0,
      blog: 0,
      resources: 0,
      help_kb: 0,
      demos: 0,
      ecosystem_marketplace: 0,
      competitor_docs: 0,
    };

    CATALOG_TABS.forEach((categoryKey) => {
      const sourceItems = itemsByCategory[categoryKey] || [];
      next[categoryKey] = applyFacetModes(sourceItems, facetTagDefinitions, contentFacetModes).length;
    });

    return next;
  }, [itemsByCategory, facetTagDefinitions, contentFacetModes]);

  const prospectiveCompetitorCounts = useMemo(
    () =>
      Object.fromEntries(
        Object.keys(competitorItemsByNavKey).map((key) => [
          key,
          applyFacetModes(competitorItemsByNavKey[key] || [], facetTagDefinitions, contentFacetModes).length,
        ])
      ),
    [competitorItemsByNavKey, facetTagDefinitions, contentFacetModes]
  );

  const activeFacetTags = useMemo(() => {
    const byId = new Map(facetTagDefinitions.map((tag) => [tag.id, tag]));
    return Object.entries(facetModes)
      .map(([id, mode]) => {
        const tag = byId.get(id);
        const label = tag?.label || id.replace(/^search:/, "").replace(/_/g, " ");
        return { id, mode, label };
      })
      .filter((tag) => tag.mode && tag.mode !== "none");
  }, [facetTagDefinitions, facetModes]);

  const navigationScopeLabel = useMemo(() => {
    if (facetModes.okta === "and") return "Okta";
    if (facetModes.entra === "and") return "Entra";
    if (facetModes.ping_identity === "and") return "Ping Identity";
    if (facetModes.competitor_docs === "and") return "Competitor";
    if (facetModes.duo === "and") return "Duo";
    return "";
  }, [facetModes]);

  useEffect(() => {
    setFacetModes((prev) => {
      const allowed = new Set(facetTagDefinitions.map((tag) => tag.id));
      const next = Object.fromEntries(Object.entries(prev).filter(([id]) => allowed.has(id)));
      const prevKeys = Object.keys(prev);
      const nextKeys = Object.keys(next);
      if (prevKeys.length === nextKeys.length && nextKeys.every((key) => prev[key] === next[key])) {
        return prev;
      }
      return next;
    });
  }, [facetTagDefinitions]);

  const facetedActiveItems = useMemo(
    () => applyFacetModes(activeRawItems, facetTagDefinitions, facetModes),
    [activeRawItems, facetTagDefinitions, facetModes]
  );

  const filteredActiveItems = useMemo(() => {
    const faceted = facetedActiveItems;
    return sortItemsBySearchPriority(faceted, contentQuery);
  }, [facetedActiveItems, contentQuery]);

  const availableFacetTags = useMemo(
    () => withFacetTagCounts(filteredActiveItems, facetTagDefinitions),
    [filteredActiveItems, facetTagDefinitions]
  );

  const effectiveContentPageSize = useMemo(
    () => Math.max(1, Math.min(MAX_DISPLAY_RESULTS, Number(contentPageSize) || MAX_DISPLAY_RESULTS)),
    [contentPageSize, MAX_DISPLAY_RESULTS]
  );

  const filteredTotalPages = useMemo(
    () => Math.max(1, Math.ceil(filteredActiveItems.length / effectiveContentPageSize)),
    [filteredActiveItems.length, effectiveContentPageSize]
  );

  const clampedContentPage = useMemo(
    () => Math.max(1, Math.min(contentPage, filteredTotalPages)),
    [contentPage, filteredTotalPages]
  );

  useEffect(() => {
    if (contentPage !== clampedContentPage) {
      setContentPage(clampedContentPage);
    }
  }, [contentPage, clampedContentPage]);

  const pagedFilteredActiveItems = useMemo(() => {
    const start = (clampedContentPage - 1) * effectiveContentPageSize;
    return filteredActiveItems.slice(start, start + effectiveContentPageSize);
  }, [filteredActiveItems, clampedContentPage, effectiveContentPageSize]);

  const counts = useMemo(
    () => ({
      dashboard: null,
      explorer: filteredCatalogForNavCounts.length,
      other: prospectiveCategoryCounts.other,
      docs: prospectiveCategoryCounts.docs,
      release_notes: prospectiveCategoryCounts.release_notes,
      guides: prospectiveCategoryCounts.guides,
      blog: prospectiveCategoryCounts.blog,
      resources: prospectiveCategoryCounts.resources,
      help_kb: prospectiveCategoryCounts.help_kb,
      demos: prospectiveCategoryCounts.demos,
      ecosystem_marketplace: prospectiveCategoryCounts.ecosystem_marketplace,
      competitor_docs: prospectiveCategoryCounts.competitor_docs,
      compare_mode: compareSeedIds.length,
      change_heatmap: null,
      smart_gap_finder: null,
      clone_to_duo_template: cloneStageItems.length,
      watchlist: watchlists.length,
      relationship_graph: null,
      evidence_trails: null,
      ...prospectiveCompetitorCounts,
      manage_customers: customers.length,
    }),
    [
      filteredCatalogForNavCounts.length,
      prospectiveCategoryCounts,
      prospectiveCompetitorCounts,
      compareSeedIds.length,
      cloneStageItems.length,
      watchlists.length,
      customers.length,
    ]
  );

  const dashboardSummary = useMemo(
    () => ({
      total: contentMeta.count,
      counts: contentMeta.counts,
      newlyDiscovered: contentMeta.newlyDiscovered,
      recentlyUpdated: contentMeta.recentlyUpdated,
    }),
    [contentMeta]
  );

  const errorLogEntries = useMemo(
    () => debugLogs.filter((entry) => ["warning", "error", "critical"].includes(entry.level)),
    [debugLogs]
  );

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);

  useEffect(() => {
    // Indexed content is server-backed and can exceed localStorage quota.
    localStorage.removeItem(STORAGE_KEYS.indexedContent);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEYS.darkMode, JSON.stringify(dark));
        localStorage.setItem(STORAGE_KEYS.templates, JSON.stringify(templates));
        localStorage.setItem(STORAGE_KEYS.customers, JSON.stringify(customers));
        localStorage.setItem(STORAGE_KEYS.audit, JSON.stringify(audit));
        localStorage.setItem(STORAGE_KEYS.lastBackupAt, JSON.stringify(lastBackupAt));
        localStorage.setItem(STORAGE_KEYS.recentDaysWindow, JSON.stringify(recentDaysWindow));
        localStorage.setItem(STORAGE_KEYS.paginationByView, JSON.stringify(paginationByView));
        localStorage.setItem(STORAGE_KEYS.facetPanelByView, JSON.stringify(facetPanelByView));
        localStorage.setItem(STORAGE_KEYS.pinnedFilters, JSON.stringify(pinnedFilters));
        localStorage.setItem(STORAGE_KEYS.watchlists, JSON.stringify(watchlists));
        localStorage.setItem(STORAGE_KEYS.compareSeeds, JSON.stringify(compareSeedIds));
        localStorage.setItem(STORAGE_KEYS.comparePrefs, JSON.stringify(comparePrefs));
        localStorage.setItem(STORAGE_KEYS.compareSnapshots, JSON.stringify(compareSnapshots));
        localStorage.setItem(STORAGE_KEYS.gapFeedback, JSON.stringify(gapFeedback));
        localStorage.setItem(STORAGE_KEYS.backupPrefs, JSON.stringify(backupOptions));
        localStorage.setItem(STORAGE_KEYS.indexPaths, JSON.stringify(indexPaths));
        localStorage.setItem(STORAGE_KEYS.debugLogs, JSON.stringify(debugLogs));
      } catch (e) {
        // Keep app responsive if storage quota is exceeded by user data.
        if (String(e?.name || "").toLowerCase().includes("quota")) {
          localStorage.removeItem(STORAGE_KEYS.indexedContent);
          if (import.meta.env.DEV) {
            console.warn("[storage] Quota exceeded while persisting state; skipped oversized storage writes.");
          }
        }
      }
    }, 260);
    return () => clearTimeout(t);
  }, [
    dark,
    templates,
    customers,
    audit,
    lastBackupAt,
    recentDaysWindow,
    paginationByView,
    facetPanelByView,
    pinnedFilters,
    watchlists,
    compareSeedIds,
    comparePrefs,
    compareSnapshots,
    gapFeedback,
    backupOptions,
    indexPaths,
    debugLogs,
  ]);

  useEffect(() => {
    const usage = {};
    customers.forEach((c) => {
      Object.keys(c.assignedTemplates || {}).forEach((tid) => {
        usage[tid] = (usage[tid] || 0) + 1;
      });
    });
    setTemplates((prev) => {
      const next = prev.map((t) => ({ ...t, usage: usage[t.id] || 0 }));
      return JSON.stringify(next) === JSON.stringify(prev) ? prev : next;
    });
  }, [customers]);

  const refreshSyncStatus = useCallback(async () => {
    try {
      const status = await apiGetSyncStatus();
      setSyncState((prev) => ({
        ...prev,
        inProgress: !!status.inProgress,
        lastRun: status.lastRun || null,
        error: "",
      }));
    } catch (e) {
      setSyncState((prev) => ({ ...prev, error: e.message || "Failed to load sync status" }));
      pushDebugLog({
        level: "error",
        area: "sync",
        action: "SYNC_STATUS_FAILED",
        message: e.message || "Failed to load sync status",
        important: true,
      });
    }
  }, [pushDebugLog]);

  const refreshIndexedContentFromServer = useCallback(async (options = {}) => {
    setContentState((prev) => ({ ...prev, loading: true, error: "" }));
    try {
      const response = await apiGetContent(recentDaysWindow, {
        category: "",
        page: 1,
        pageSize: FETCH_ALL_RESULTS_PAGE_SIZE,
        signal: options.signal,
      });
      const mapped = (response.items || []).map((x) => {
        const isEcosystemMarketplaceUrl = /^https?:\/\/ecosystem\.duo\.com\//i.test(String(x.url || ""));
        const derivedVendor =
          x.vendor ||
          (String(x.url || "").includes("help.okta.com")
            ? "Okta"
            : String(x.url || "").includes("docs.pingidentity.com")
              ? "Ping Identity"
            : /learn\.microsoft\.com\/(?:[a-z]{2}-[a-z]{2}\/)?entra\/identity\/saas-apps/i.test(String(x.url || ""))
              ? "Entra"
              : "Duo");

        return {
          id: x.id,
          url: x.url,
          title: x.title,
          category: isEcosystemMarketplaceUrl ? "ecosystem_marketplace" : (x.category || "other"),
          vendor: derivedVendor,
          tags: Array.isArray(x.tags) && x.tags.length ? x.tags : [derivedVendor],
          pathSummary: x.pathSummary || "",
          summary: x.summary,
          pageLastUpdated: x.pageLastUpdated,
          contentHash: x.contentHash,
          firstSeenAt: x.firstSeenAt,
          updatedAt: x.updatedAt,
          recentlyUpdated: !!x.recentlyUpdated,
          recentReason: x.recentReason || "none",
        };
      });
      const derivedCounts = {
        other: 0,
        docs: 0,
        release_notes: 0,
        guides: 0,
        blog: 0,
        resources: 0,
        help_kb: 0,
        demos: 0,
        ecosystem_marketplace: 0,
        competitor_docs: 0,
      };
      mapped.forEach((item) => {
        const key = String(item.category || "other");
        if (Object.prototype.hasOwnProperty.call(derivedCounts, key)) derivedCounts[key] += 1;
        else derivedCounts.other += 1;
      });
      setIndexedContent(mapped);
      setContentMeta((prev) => ({
        ...prev,
        count: mapped.length,
        newlyDiscovered: response.signals?.newlyDiscovered ?? 0,
        recentlyUpdated: response.signals?.recentlyUpdated ?? 0,
        counts: derivedCounts,
        page: 1,
        pageSize: FETCH_ALL_RESULTS_PAGE_SIZE,
        totalPages: response.totalPages ?? 1,
        hasNextPage: !!response.hasNextPage,
        hasPrevPage: !!response.hasPrevPage,
      }));
      setContentState({ loading: false, error: "", lastLoadedAt: nowIso() });
    } catch (e) {
      if (e?.name === "AbortError") return;
      setContentState((prev) => ({
        ...prev,
        loading: false,
        error: e.message || "Failed to load content",
      }));
      pushDebugLog({
        level: "error",
        area: "sync",
        action: "CONTENT_REFRESH_FAILED",
        message: e.message || "Failed to load content",
        details: { recentDaysWindow },
        important: true,
      });
    }
  }, [recentDaysWindow, pushDebugLog]);

  useEffect(() => {
    const controller = new AbortController();
    refreshSyncStatus();
    refreshIndexedContentFromServer({ signal: controller.signal });
    return () => controller.abort();
  }, [refreshSyncStatus, refreshIndexedContentFromServer]);

  useEffect(() => {
    if (isContentView) setContentPage(1);
  }, [contentQuery, recentDaysWindow, contentPageSize, isContentView]);

  const addSearchFacetTerm = (rawTerm, mode = "and") => {
    const term = toSearchFacetToken(rawTerm);
    if (!term || term.length < 2) return;
    // Prevent navigation keys from being treated as search filters.
    const blockedTerms = new Set(["explorer", "dashboard", "templates", "customers", "audit", "checklist", "manage_customers"]);
    if (blockedTerms.has(term)) return;
    const id = `search:${term}`;
    setSearchFacetTerms((prev) => (prev.includes(term) ? prev : [...prev, term]));
    setFacetModes((prev) => ({ ...prev, [id]: mode || prev[id] || "and" }));
    setLastAddedFacetId(id);
  };

  const removeFacetById = (id) => {
    if (!id) return;
    setFacetModes((prev) => {
      if (!prev[id]) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
    if (id.startsWith("search:")) {
      const term = id.replace(/^search:/, "");
      setSearchFacetTerms((prev) => prev.filter((x) => x !== term));
    }
    if (lastAddedFacetId === id) setLastAddedFacetId(null);
  };

  useEffect(() => {
    if (active !== "explorer") return;
    setSearchFacetTerms((prev) => prev.filter((term) => term !== "explorer"));
    setFacetModes((prev) => {
      if (!prev["search:explorer"]) return prev;
      const next = { ...prev };
      delete next["search:explorer"];
      return next;
    });
  }, [active]);

  const applyPinnedFilter = (pin) => {
    if (!pin) return;
    setActive(pin.view || "explorer");
    setQuery(pin.query || "");
    setExplorerCategory(pin.explorerCategory || "");
    setContentPageSize(Math.max(1, Math.min(MAX_DISPLAY_RESULTS, Number(pin.contentPageSize) || MAX_DISPLAY_RESULTS)));
    setRecentDaysWindow(Math.max(1, Math.min(30, Number(pin.recentDaysWindow) || 14)));
    setContentPage(1);
  };

  const clearPinnedFilters = () => setPinnedFilters([]);

  const renamePinnedFilter = (id) => {
    setPinnedFilters((prev) => {
      const target = prev.find((p) => p.id === id);
      if (!target) return prev;
      const nextLabel = window.prompt("Rename pinned filter", target.label)?.trim();
      if (!nextLabel) return prev;
      return prev.map((p) => (p.id === id ? { ...p, label: nextLabel } : p));
    });
  };

  const deletePinnedFilter = (id) => {
    setPinnedFilters((prev) => prev.filter((p) => p.id !== id));
  };

  const createWatchlistRule = ({ name, keyword, vendor, threshold }) => {
    const next = {
      id: `wl_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      name,
      keyword,
      vendor,
      threshold,
    };
    setWatchlists((prev) => [next, ...prev]);
  };

  const deleteWatchlistRule = (id) => {
    setWatchlists((prev) => prev.filter((rule) => rule.id !== id));
  };

  const addCompareSeed = (item) => {
    if (!item?.id) return;
    setCompareSeedIds((prev) => (prev.includes(item.id) ? prev : [item.id, ...prev].slice(0, 40)));
    setToast({ show: true, message: `Added '${item.title}' to Compare Mode` });
    setTimeout(() => setToast({ show: false, message: "" }), 2400);
  };

  const stageCloneCandidate = (item) => {
    if (!isCompetitorResultItem(item)) return;
    setCloneStageItems((prev) => (prev.some((x) => x.id === item.id) ? prev : [item, ...prev]));
    setToast({ show: true, message: "Competitor result staged for Duo clone template" });
    setTimeout(() => setToast({ show: false, message: "" }), 2200);
  };

  const removeStagedClone = (id) => {
    setCloneStageItems((prev) => prev.filter((item) => item.id !== id));
  };

  const removeCompareSeed = (seedId) => {
    setCompareSeedIds((prev) => prev.filter((id) => id !== seedId));
  };

  const setCompareVendorPriority = (priority) => {
    const allowed = new Set(["balanced", "duo_first", "competitor_first"]);
    if (!allowed.has(priority)) return;
    setComparePrefs((prev) => ({ ...prev, vendorPriority: priority }));
  };

  const addCompareBoostTerm = (term) => {
    const normalized = String(term || "").trim().toLowerCase();
    if (!normalized) return;
    setComparePrefs((prev) => {
      const existing = Array.isArray(prev.boostTerms) ? prev.boostTerms : [];
      if (existing.includes(normalized)) return prev;
      return { ...prev, boostTerms: [...existing, normalized].slice(0, 12) };
    });
  };

  const removeCompareBoostTerm = (term) => {
    const normalized = String(term || "").trim().toLowerCase();
    setComparePrefs((prev) => ({
      ...prev,
      boostTerms: (Array.isArray(prev.boostTerms) ? prev.boostTerms : []).filter((item) => item !== normalized),
    }));
  };

  const togglePinnedMatch = (seedId, matchId) => {
    if (!seedId || !matchId) return;
    setComparePrefs((prev) => {
      const bySeed = { ...(prev.pinnedMatchIdsBySeed || {}) };
      const existing = new Set(Array.isArray(bySeed[seedId]) ? bySeed[seedId] : []);
      if (existing.has(matchId)) existing.delete(matchId);
      else existing.add(matchId);
      bySeed[seedId] = [...existing].slice(0, 12);
      return { ...prev, pinnedMatchIdsBySeed: bySeed };
    });
  };

  const saveCompareSnapshot = () => {
    const stamp = new Date().toISOString().slice(0, 16).replace("T", " ");
    const snapshot = {
      id: `cmp_snap_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      label: `Snapshot ${stamp}`,
      compareSeedIds,
      comparePrefs,
      createdAt: nowIso(),
    };
    setCompareSnapshots((prev) => [snapshot, ...prev].slice(0, 20));
    setToast({ show: true, message: "Saved compare snapshot" });
    setTimeout(() => setToast({ show: false, message: "" }), 2000);
  };

  const loadCompareSnapshot = (snapshotId) => {
    const snapshot = compareSnapshots.find((item) => item.id === snapshotId);
    if (!snapshot) return;
    setCompareSeedIds(Array.isArray(snapshot.compareSeedIds) ? snapshot.compareSeedIds : []);
    setComparePrefs(
      snapshot.comparePrefs || { vendorPriority: "balanced", boostTerms: [], pinnedMatchIdsBySeed: {} }
    );
  };

  const setGapFeedbackState = (gapId, state) => {
    if (!gapId) return;
    const allowed = new Set(["dismissed", "confirmed", "none"]);
    if (!allowed.has(state)) return;
    setGapFeedback((prev) => ({ ...prev, [gapId]: state }));
    if (state === "dismissed" || state === "confirmed") {
      setSmartGapItems((prev) => prev.filter((item) => item.id !== gapId));
      const gapLabel = smartGapItems.find((item) => item.id === gapId)?.title || gapId;
      const action = state === "dismissed" ? "SMART_GAP_DISMISSED_ITEM" : "SMART_GAP_CONFIRMED_ITEM";
      pushAudit(action, `${state === "dismissed" ? "Dismissed" : "Confirmed"} smart gap item: ${gapLabel}`);
    }
  };

  const runSmartGapAnalysis = () => {
    setSmartGapItems([]);
    setSmartGapRunNonce((prev) => prev + 1);
    pushAudit("SMART_GAP_ANALYSIS_RUN", "Manually ran Smart Gap analysis.");
  };

  const applyDashboardQuickTag = (tagId) => {
    const allowedQuickTags = new Set(["newly_discovered", "recently_updated"]);
    if (!allowedQuickTags.has(tagId)) return;

    setActive("explorer");
    setFacetPanelByView((prev) => {
      const currentOpen = !!(prev.explorer || {}).open;
      if (currentOpen) return prev;
      return { ...prev, explorer: { open: true } };
    });
    setFacetModes((prev) => ({ ...prev, [tagId]: "and" }));
    setLastAddedFacetId(tagId);
    setContentPage(1);
  };

  const applyHeatmapCellFilter = (cell) => {
    if (!cell) return;

    const vendorTagMap = {
      duo: "duo",
      okta: "okta",
      entra: "entra",
      "ping identity": "ping_identity",
    };

    const nextModes = { recently_updated: "and" };
    const nextSearchTerms = [];

    const vendorKey = String(cell.vendor || "").toLowerCase();
    const vendorTagId = vendorTagMap[vendorKey];
    if (vendorTagId) {
      nextModes[vendorTagId] = "and";
    } else {
      const vendorTerm = toSearchFacetToken(cell.vendor || "");
      if (vendorTerm) nextSearchTerms.push(vendorTerm);
    }

    const categoryValue = String(cell.category || "").toLowerCase();
    if (categoryValue && categoryValue !== "all categories") {
      const categoryTerm = toSearchFacetToken(categoryLabel(categoryValue));
      if (categoryTerm) nextSearchTerms.push(categoryTerm);
    }

    const uniqueTerms = [...new Set(nextSearchTerms)];
    uniqueTerms.forEach((term) => {
      nextModes[`search:${term}`] = "and";
    });

    setActive("explorer");
    setExplorerCategory("");
    setFacetPanelByView((prev) => ({ ...prev, explorer: { open: true } }));
    setSearchFacetTerms(uniqueTerms);
    setFacetModes(nextModes);
    setLastAddedFacetId("recently_updated");
    setContentPage(1);
  };

  const applyResultTagFilter = (tagLabel, mode = "and") => {
    if (!tagLabel) return;
    setFacetPanelOpenForActive(true);
    addSearchFacetTerm(tagLabel, mode);
    setContentPage(1);
  };

  useEffect(() => {
    if (!syncState.inProgress && !syncState.loading) return;

    let cancelled = false;
    let timeoutId;
    let currentController = null;
    let retryDelay = 1000;

    const poll = async () => {
      if (cancelled) return;
      currentController = new AbortController();
      try {
        const r = await apiGetSyncProgress({ signal: currentController.signal });
        const p = r?.progress || {};
        setSyncState((prev) => ({
          ...prev,
          inProgress: !!p.inProgress,
          progress: {
            percent: p.percent ?? 0,
            processed: p.processed ?? 0,
            queued: p.queued ?? 0,
            currentUrl: p.currentUrl || "",
            currentDepth: p.currentDepth ?? 0,
          },
        }));
        retryDelay = 1000;
        syncPollRetryLoggedRef.current = false;
      } catch (e) {
        if (e?.name !== "AbortError") {
          if (!syncPollRetryLoggedRef.current) {
            pushDebugLog({
              level: "warning",
              area: "sync",
              action: "SYNC_POLL_RETRY",
              message: e.message || "Sync progress polling failed",
            });
            syncPollRetryLoggedRef.current = true;
          }
          retryDelay = Math.min(5000, retryDelay * 2);
        }
      } finally {
        if (!cancelled) {
          timeoutId = setTimeout(poll, retryDelay);
        }
      }
    };

    poll();
    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
      if (currentController) currentController.abort();
    };
  }, [syncState.inProgress, syncState.loading, pushDebugLog]);

  const runResync = async () => {
    try {
      setSyncState((prev) => ({
        ...prev,
        loading: true,
        inProgress: true,
        error: "",
        progress: { percent: 0, processed: 0, queued: 0, currentUrl: "", currentDepth: 0 },
      }));
      pushDebugLog({ level: "info", area: "sync", action: "RESYNC_STARTED", message: "Incremental resync started" });
      await apiRunSync();
      await refreshSyncStatus();
      await refreshIndexedContentFromServer();
      pushAudit("RESYNC_COMPLETED", "Performed incremental site resync.");
      pushDebugLog({ level: "info", area: "sync", action: "RESYNC_COMPLETED", message: "Incremental resync completed" });
    } catch (e) {
      setSyncState((prev) => ({ ...prev, error: e.message || "Resync failed" }));
      pushAudit("RESYNC_FAILED", e.message || "Resync failed");
      pushDebugLog({
        level: "critical",
        area: "sync",
        action: "RESYNC_FAILED",
        message: e.message || "Resync failed",
        important: true,
      });
    } finally {
      setSyncState((prev) => ({ ...prev, loading: false }));
    }
  };

  const openAssignModal = (content) => {
    setAssignContent(content);
    setAssignModalOpen(true);
  };

  const assignCatalogItemToTemplates = (templateIds) => {
    if (!assignContent || !templateIds?.length) return;

    const selectedNames = [];
    setTemplates((prev) =>
      prev.map((t) => {
        if (!templateIds.includes(t.id)) return t;

        const existingItems = flattenTemplateItems(t);
        const exists = existingItems.some(
          (it) =>
            (assignContent.id && it.sourceRefId === assignContent.id) ||
            it.label.toLowerCase() === assignContent.title.toLowerCase()
        );
        if (exists) return t;

        selectedNames.push(t.name);
        return addTemplateItemToModule(t, toTemplateItemFromContent(assignContent, "catalog"));
      })
    );

    setAssignModalOpen(false);
    setAssignContent(null);

    if (selectedNames.length) {
      const names = selectedNames.join(", ");
      setToast({ show: true, message: `Items successfully added to template ${names}` });
      setTimeout(() => setToast({ show: false, message: "" }), 3500);
    }
  };

  const handleExport = (selectedOptions) => {
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
    const options = { ...defaultBackupOptions, ...(selectedOptions || {}) };
    const payload = {
      exportType: "user_backup_single_file",
      schemaVersion: APP_SCHEMA_VERSION,
      exportedAt: nowIso(),
      includes: options,
      data: {
        appearance: options.appearance
          ? {
              dark,
              recentDaysWindow,
            }
          : undefined,
        templates: options.templates
          ? templates.map((t) => ensureTemplateShape({ ...t, usage: 0, deletedAt: null }))
          : undefined,
        customers: options.customers ? customers.map(ensureCustomerShape) : undefined,
        pinnedFilters: options.pinnedFilters ? pinnedFilters : undefined,
        watchlists: options.watchlists ? watchlists : undefined,
        compare:
          options.compare
            ? {
                seedIds: compareSeedIds,
                prefs: comparePrefs,
                snapshots: compareSnapshots,
              }
            : undefined,
        gapFeedback: options.gapFeedback ? gapFeedback : undefined,
        navigation:
          options.navigation
            ? {
                paginationByView,
                facetPanelByView,
              }
            : undefined,
        audit: options.audit ? audit : undefined,
      },
      note: "Indexed content/results are excluded from backup by design.",
    };
    downloadJson(`sitenavigator-backup-${stamp}.json`, payload);
    setBackupOptions(options);
    setLastBackupAt(nowIso());
  };

  const handleImportData = async (file, options = {}) => {
    if (!file) return;

    try {
      const json = JSON.parse(await file.text());
      const { exportType: incomingType, schemaVersion, data } = json || {};
      if (!data || schemaVersion < 1 || schemaVersion > APP_SCHEMA_VERSION) {
        alert("Invalid import");
        return;
      }

      if (!["user_backup_single_file", "full_backup", "templates_only"].includes(incomingType)) {
        alert("Unsupported backup format.");
        return;
      }

      const mergeCollections = !!options.mergeCollections;

      if (incomingType === "templates_only") {
        const incomingTemplates = (data.templates || []).map((t) => ({
          ...ensureTemplateShape(t),
          usage: 0,
          deletedAt: null,
        }));
        setTemplates((prev) => (mergeCollections ? mergeById(prev, incomingTemplates).map(ensureTemplateShape) : incomingTemplates));
        setImportModalOpen(false);
        return;
      }

      if (incomingType === "full_backup") {
        // Legacy support path: import only user-managed data, skip indexedContent/results.
        if (typeof data.dark === "boolean") setDark(data.dark);
        if (data.templates) {
          const incomingTemplates = (data.templates || []).map(ensureTemplateShape);
          setTemplates((prev) => (mergeCollections ? mergeById(prev, incomingTemplates).map(ensureTemplateShape) : incomingTemplates));
        }
        if (data.customers) {
          const incomingCustomers = (data.customers || []).map(ensureCustomerShape);
          setCustomers((prev) => (mergeCollections ? mergeById(prev, incomingCustomers).map(ensureCustomerShape) : incomingCustomers));
        }
        if (isArray(data.audit)) setAudit(data.audit);
        if (isArray(data.pinnedFilters)) setPinnedFilters(data.pinnedFilters.filter(Boolean));
        if (isArray(data.watchlists)) setWatchlists(data.watchlists.filter(Boolean));
        if (isArray(data.compareSeedIds)) setCompareSeedIds(data.compareSeedIds.filter(Boolean));
        if (data.comparePrefs) setComparePrefs(data.comparePrefs);
        if (isArray(data.compareSnapshots)) setCompareSnapshots(data.compareSnapshots.filter(Boolean));
        if (data.gapFeedback && typeof data.gapFeedback === "object") setGapFeedback(data.gapFeedback);
        if (data.recentDaysWindow) {
          setRecentDaysWindow(Math.max(1, Math.min(30, Number(data.recentDaysWindow || 14))));
        }
        setImportModalOpen(false);
        return;
      }

      const appearance = data.appearance || {};
      const incomingTemplates = (data.templates || []).map(ensureTemplateShape);
      const incomingCustomers = (data.customers || []).map(ensureCustomerShape);

      if (typeof appearance.dark === "boolean") setDark(appearance.dark);
      if (appearance.recentDaysWindow) {
        setRecentDaysWindow(Math.max(1, Math.min(30, Number(appearance.recentDaysWindow || 14))));
      }
      if (incomingTemplates.length) {
        setTemplates((prev) => (mergeCollections ? mergeById(prev, incomingTemplates).map(ensureTemplateShape) : incomingTemplates));
      }
      if (incomingCustomers.length) {
        setCustomers((prev) => (mergeCollections ? mergeById(prev, incomingCustomers).map(ensureCustomerShape) : incomingCustomers));
      }
      if (isArray(data.pinnedFilters)) setPinnedFilters(data.pinnedFilters.filter(Boolean));
      if (isArray(data.watchlists)) setWatchlists(data.watchlists.filter(Boolean));
      if (data.compare?.seedIds) setCompareSeedIds((data.compare.seedIds || []).filter(Boolean));
      if (data.compare?.prefs) {
        setComparePrefs(
          data.compare.prefs || { vendorPriority: "balanced", boostTerms: [], pinnedMatchIdsBySeed: {} }
        );
      }
      if (isArray(data.compare?.snapshots)) setCompareSnapshots(data.compare.snapshots.filter(Boolean));
      if (data.gapFeedback && typeof data.gapFeedback === "object") setGapFeedback(data.gapFeedback);
      if (data.navigation?.paginationByView) setPaginationByView(data.navigation.paginationByView);
      if (data.navigation?.facetPanelByView) setFacetPanelByView(data.navigation.facetPanelByView);
      if (isArray(data.audit)) setAudit(data.audit);
      setImportModalOpen(false);
    } catch {
      pushDebugLog({
        level: "error",
        area: "tools",
        action: "IMPORT_FAILED",
        message: "Import failed",
        important: true,
      });
      alert("Import failed");
    }
  };

  const formatFileSize = (sizeBytes) => {
    const bytes = Number(sizeBytes || 0);
    if (bytes <= 0) return "0 B";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const setIndexStatus = (slot, message) => {
    setIndexPathStatus((prev) => ({ ...prev, [slot]: message, error: "" }));
  };

  const onEstimateIndexPath = async (filePath, slot) => {
    const path = String(filePath || "").trim();
    if (!path) {
      setIndexStatus(slot, "No path provided");
      return;
    }
    try {
      const info = await apiGetIndexPathInfo(path);
      const existence = info.exists ? "exists" : "missing";
      setIndexStatus(slot, `${existence} · ${formatFileSize(info.sizeBytes)}`);
    } catch (e) {
      setIndexPathStatus((prev) => ({ ...prev, error: e.message || "Failed to estimate size" }));
      pushDebugLog({
        level: "error",
        area: "tools",
        action: "INDEX_ESTIMATE_FAILED",
        message: e.message || "Failed to estimate size",
        details: { path, slot },
        important: true,
      });
    }
  };

  const onLoadIndexFromPath = async (filePath, slot) => {
    const path = String(filePath || "").trim();
    if (!path) {
      setIndexStatus(slot, "No path provided");
      return;
    }

    try {
      const result = await apiLoadIndexFromPath(path, "replace");
      await refreshIndexedContentFromServer();
      setIndexStatus(slot, `loaded · ${formatFileSize(result.sizeBytes)}`);
      setToast({ show: true, message: "Index loaded from selected path" });
      setTimeout(() => setToast({ show: false, message: "" }), 2200);
    } catch (e) {
      setIndexPathStatus((prev) => ({ ...prev, error: e.message || "Failed to load index" }));
      pushDebugLog({
        level: "critical",
        area: "tools",
        action: "INDEX_LOAD_FAILED",
        message: e.message || "Failed to load index",
        details: { path, slot },
        important: true,
      });
    }
  };

  const onSaveIndexToPath = async (filePath, slot) => {
    const path = String(filePath || "").trim();
    if (!path) {
      setIndexStatus(slot, "No path provided");
      return;
    }

    try {
      const result = await apiSaveIndexToPath(path);
      setIndexStatus(slot, `saved · ${formatFileSize(result.sizeBytes)}`);
      setToast({ show: true, message: "Index copy saved" });
      setTimeout(() => setToast({ show: false, message: "" }), 2200);
    } catch (e) {
      setIndexPathStatus((prev) => ({ ...prev, error: e.message || "Failed to save index" }));
      pushDebugLog({
        level: "error",
        area: "tools",
        action: "INDEX_SAVE_FAILED",
        message: e.message || "Failed to save index",
        details: { path, slot },
        important: true,
      });
    }
  };

  const restoreTemplate = (id) => {
    setTemplates((prev) => prev.map((t) => (t.id === id ? { ...t, deletedAt: null } : t)));
  };

  const createTemplate = ({ name, group }) => {
    const newTemplate = {
      id: `t_${Date.now()}`,
      name,
      group,
      version: 1,
      modules: [createTemplateModule(MODULE_TYPES.CORE, "Core")],
      usage: 0,
      deletedAt: null,
    };
    setTemplates((prev) => [ensureTemplateShape(newTemplate), ...prev]);
    pushAudit("TEMPLATE_CREATED", `Created template ${name}.`);
  };

  const createCustomer = ({ name, segment, akey, omniLink }) => {
    setCustomers((prev) => [
      {
        id: `c_${Date.now()}`,
        name,
        segment,
        akey,
        omniLink,
        assignedTemplates: {},
      },
      ...prev,
    ]);
    pushAudit("CUSTOMER_CREATED", `Added customer ${name}.`);
  };

  const deleteCustomer = (customerId) => {
    const target = customers.find((c) => c.id === customerId);
    if (!target) return;
    setCustomers((prev) => prev.filter((c) => c.id !== customerId));
    pushAudit("CUSTOMER_DELETED", `Deleted customer ${target.name}.`);
  };

  const clearNavigationGroupFacets = () => {
    setFacetModes((prev) => {
      const next = { ...prev };
      NAVIGATION_FACET_KEYS.forEach((id) => {
        delete next[id];
      });
      return next;
    });
  };

  return (
    <div className={`flex min-h-screen items-stretch ${isContentView ? "app-stable-paint" : ""}`}>
      <Toast show={toast.show} message={toast.message} onClose={() => setToast({ show: false, message: "" })} />
      <CriticalWarningBanner warning={criticalWarning} onClose={() => setCriticalWarning(null)} />
      <Sidebar
        active={active}
        setActive={setActive}
        counts={counts}
        competitorNavItems={competitorNavItems}
        mobileOpen={mobileNavOpen}
        setMobileOpen={setMobileNavOpen}
        settingsOpen={settingsModalOpen}
        onOpenSettings={() => setSettingsModalOpen(true)}
        onClearNavigationFilters={clearNavigationGroupFacets}
        onOpenFilteredExplorer={({ facetTagId, searchTerm }) => {
          const normalizedSearchTerm = toSearchFacetToken(searchTerm || "");
          const searchTagId = normalizedSearchTerm ? `search:${normalizedSearchTerm}` : "";

          pushDebugLog({
            level: "debug",
            area: "navigation",
            action: "OPEN_FILTERED_EXPLORER",
            message: "Opened explorer from navigation scope",
            details: { facetTagId: facetTagId || "", searchTagId },
          });

          setActive("explorer");
          setExplorerCategory("");
          setFacetPanelByView((prev) => ({ ...prev, explorer: { open: true } }));
          setContentPage(1);

          if (normalizedSearchTerm) {
            setSearchFacetTerms((prev) =>
              prev.includes(normalizedSearchTerm) ? prev : [...prev, normalizedSearchTerm]
            );
          }

          if (facetTagId || searchTagId) {
            setFacetModes((prev) => {
              const next = { ...prev };
              NAVIGATION_FACET_KEYS.forEach((id) => {
                delete next[id];
              });
              if (facetTagId) next[facetTagId] = "and";
              if (searchTagId) next[searchTagId] = "and";
              return next;
            });
            setLastAddedFacetId(searchTagId || facetTagId);
          }
        }}
      />

      <main className={`flex-1 p-4 md:p-6 ${isContentView ? "content-stable-paint" : ""}`}>
        {active !== "dashboard" && (
          <TopBar
            query={query}
            setQuery={setQuery}
            recentDaysWindow={recentDaysWindow}
            setRecentDaysWindow={setRecentDaysWindow}
            onResync={runResync}
            syncState={syncState}
            onToggleNav={() => setMobileNavOpen(true)}
            isNavOpen={mobileNavOpen}
            searchInputRef={searchInputRef}
            isContentView={isContentView}
            isExplorer={isExplorer}
            explorerCategory={explorerCategory}
            setExplorerCategory={setExplorerCategory}
            onPinSearchTag={addSearchFacetTerm}
            activeFacetTags={activeFacetTags}
            activeFilterCount={Object.keys(facetModes).length}
            onRemoveActiveTag={removeFacetById}
            onUndoLastTag={() => {
              if (!lastAddedFacetId) return;
              removeFacetById(lastAddedFacetId);
            }}
            lastAddedFacetId={lastAddedFacetId}
            navigationScopeLabel={navigationScopeLabel}
            showSearch={active !== "dashboard"}
            searchPlaceholder={
              active === "manage_customers"
                ? manageCustomersTab === "templates"
                  ? "Search Templates"
                  : "Search Customers"
                  : "Search all site content..."
            }
          />
        )}
        {isContentView && pinnedFilters.length > 0 && (
          <div className="glass-surface mb-4 p-3">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-xs font-medium text-slate-500">Pinned Filters</p>
              {!pinnedFilters.length ? (
                <span className="text-xs text-slate-400">No pinned filters</span>
              ) : (
                pinnedFilters.map((pin) => (
                  <span key={pin.id} className="inline-flex items-center gap-1 rounded-full border border-white/35 bg-white/35 px-2 py-1 text-xs dark:bg-slate-900/60">
                    <button
                      onClick={() => applyPinnedFilter(pin)}
                      className="px-0.5"
                      aria-label={`Apply pinned filter ${pin.label}`}
                    >
                      {pin.label}
                    </button>
                    <button
                      onClick={() => renamePinnedFilter(pin.id)}
                      aria-label={`Rename pinned filter ${pin.label}`}
                      className="text-slate-500 hover:text-slate-700 dark:hover:text-slate-200"
                    >
                      Rename
                    </button>
                    <button
                      onClick={() => deletePinnedFilter(pin.id)}
                      aria-label={`Delete pinned filter ${pin.label}`}
                      className="text-rose-700"
                    >
                      Delete
                    </button>
                  </span>
                ))
              )}
              {!!pinnedFilters.length && (
                <button
                  onClick={clearPinnedFilters}
                  className="rounded-full border border-rose-300 px-2.5 py-1 text-xs text-rose-700 hover:bg-rose-50/70"
                >
                  Clear Pins
                </button>
              )}
            </div>
          </div>
        )}

        {contentState.loading && (
          <div className="glass-surface mb-4 p-3 text-sm text-blue-700 dark:text-blue-200">
            Refreshing indexed content...
          </div>
        )}

        {!!contentState.error && (
          <div className="glass-surface mb-4 flex items-center justify-between gap-2 p-3 text-sm">
            <span className="text-rose-700 dark:text-rose-200">{contentState.error}</span>
            <button
              onClick={refreshIndexedContentFromServer}
              className="rounded border border-rose-300 px-2 py-1 text-xs text-rose-700 dark:text-rose-200"
            >
              Retry
            </button>
          </div>
        )}

        {searchPending && (
          <div className="mb-4 text-xs text-slate-500">Updating search results...</div>
        )}

        {isContentView && activeFacetTags.length >= 2 && filteredActiveItems.length === 0 && (
          <div className="mb-4 rounded-xl border border-amber-300/60 bg-amber-100/35 p-3 text-xs text-amber-900 dark:border-amber-700/70 dark:bg-amber-900/25 dark:text-amber-200">
            Current filters returned no results. Remove one or more tags to broaden the result set.
          </div>
        )}

        {isContentView && (
          <FacetedTagFilterPanel
            open={facetPanelOpen}
            onToggle={() => setFacetPanelOpenForActive((prev) => !prev)}
            tags={availableFacetTags}
            selectedModes={facetModes}
            onApplyTagMode={(id, mode) => {
              setFacetModes((prev) => {
                const current = prev[id] || "none";
                if (mode === "none") {
                  const next = { ...prev };
                  delete next[id];
                  return next;
                }
                if (current === mode) {
                  const next = { ...prev };
                  delete next[id];
                  return next;
                }
                return { ...prev, [id]: mode };
              });
              setContentPage(1);
              setLastAddedFacetId(id);
            }}
            onClear={() => {
              setFacetModes({});
              setSearchFacetTerms([]);
              setLastAddedFacetId(null);
              setContentPage(1);
            }}
            resultCount={filteredActiveItems.length}
            totalCount={activeRawItems.length}
          />
        )}

        {active === "dashboard" && (
          <>
            <Dashboard
              summary={dashboardSummary}
              backupStale={backupStale}
              onQuickExport={() => handleExport("full")}
              onQuickFilterTag={applyDashboardQuickTag}
              onOpenExplorer={() => setActive("explorer")}
              onHeatmapCellClick={applyHeatmapCellFilter}
              customers={customers}
              templates={templates}
              heatmapCells={heatmapCells}
              briefs={autoBriefs}
            />
          </>
        )}

        {active === "explorer" && (
          <CatalogView title="Explorer" items={pagedFilteredActiveItems} query={contentQuery} onAdd={openAssignModal} onTagClick={applyResultTagFilter} onCompare={addCompareSeed} onStageClone={stageCloneCandidate} />
        )}

        {active === "compare_mode" && (
          <>
            <CompareModeView
              items={pagedFilteredActiveItems}
              onTagClick={applyResultTagFilter}
              onRemoveSeed={removeCompareSeed}
              vendorPriority={comparePrefs.vendorPriority || "balanced"}
              onChangeVendorPriority={setCompareVendorPriority}
              boostTerms={Array.isArray(comparePrefs.boostTerms) ? comparePrefs.boostTerms : []}
              onAddBoost={addCompareBoostTerm}
              onRemoveBoost={removeCompareBoostTerm}
              onSaveSnapshot={saveCompareSnapshot}
              snapshots={compareSnapshots}
              onLoadSnapshot={loadCompareSnapshot}
              onTogglePinnedMatch={togglePinnedMatch}
            />
            {(toolLoadState.compare.loading || toolComputedAt.compare) && (
              <ToolComputeStatus
                label="Computing compare relations..."
                progress={toolLoadState.compare.progress}
                lastComputedAt={toolComputedAt.compare}
              />
            )}
          </>
        )}

        {active === "smart_gap_finder" && (
          <>
            <SmartGapFinderView
              items={pagedFilteredActiveItems}
              onTagClick={applyResultTagFilter}
              onFeedback={setGapFeedbackState}
              hasRun={smartGapRunNonce > 0}
              onRun={runSmartGapAnalysis}
            />
            {(toolLoadState.gap.loading || toolComputedAt.gap) && (
              <ToolComputeStatus
                label="Computing gaps..."
                progress={toolLoadState.gap.progress}
                lastComputedAt={toolComputedAt.gap}
              />
            )}
          </>
        )}

        {active === "clone_to_duo_template" && (
          <CloneToDuoTemplateView
            stagedItems={cloneStageItems}
            onRemove={removeStagedClone}
            onClone={setCloneInstructionTarget}
          />
        )}

        {active === "change_heatmap" && (
          <div className="space-y-4">
            <ToolDetailsDisclosure
              title="Detailed Change Heatmap Guide"
              overview="Change Heatmap aggregates recent content updates by vendor and category, then normalizes intensity to highlight where update activity is concentrated."
              steps={[
                "Each indexed page contributes change weight based on recency signals.",
                "Entries are grouped by vendor and content category.",
                "Counts are normalized to intensity percentages for side-by-side comparison.",
                "Top cells reveal high-churn areas that may need product or documentation attention.",
              ]}
              features={[
                "Vendor and category level change aggregation",
                "Intensity normalization for fair visual comparison",
                "Top-change segment surfacing",
                "Progressive compute status for large datasets",
              ]}
            />
            <h2 className="type-display">Change Heatmap</h2>
            <p className="type-micro">Track where content changed most by vendor and category.</p>
            {(toolLoadState.heatmap.loading || toolComputedAt.heatmap) && (
              <ToolComputeStatus
                label="Computing heatmap intensity..."
                progress={toolLoadState.heatmap.progress}
                lastComputedAt={toolComputedAt.heatmap}
              />
            )}
            <ChangeHeatmapPanel cells={heatmapCells} title="Weekly Change Intensity" onCellClick={applyHeatmapCellFilter} />
          </div>
        )}

        {active === "watchlist" && (
          <WatchlistView
            watchlists={watchlists}
            onCreate={createWatchlistRule}
            onDelete={deleteWatchlistRule}
            alerts={watchlistAlerts}
          />
        )}

        {active === "relationship_graph" && (
          <>
            <RelationshipGraphView graph={relationshipGraph} />
            {(toolLoadState.graph.loading || toolComputedAt.graph) && (
              <ToolComputeStatus
                label="Building relationship graph..."
                progress={toolLoadState.graph.progress}
                lastComputedAt={toolComputedAt.graph}
              />
            )}
          </>
        )}

        {active === "evidence_trails" && (
          <>
            <EvidenceTrailsView items={evidenceTrailItems} />
            {(toolLoadState.evidence.loading || toolComputedAt.evidence) && (
              <ToolComputeStatus
                label="Collecting evidence trails..."
                progress={toolLoadState.evidence.progress}
                lastComputedAt={toolComputedAt.evidence}
              />
            )}
          </>
        )}

        {(CATALOG_TABS.includes(active) || isCompetitorNavigationKey(active) || isToolContentView(active)) && (
          <div className="mb-4 flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <span>
              Showing {pagedFilteredActiveItems.length} of {filteredActiveItems.length} filtered results ({activeRawItems.length} in scope)
            </span>
          </div>
        )}

        {isContentView && filteredTotalPages > 1 && (
          <div className="mb-4 flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <button
              onClick={() => setContentPage(1)}
              disabled={clampedContentPage <= 1}
              className="glass-control px-2 py-1 disabled:opacity-50"
            >
              First
            </button>
            <button
              onClick={() => setContentPage((prev) => Math.max(1, prev - 1))}
              disabled={clampedContentPage <= 1}
              className="glass-control px-2 py-1 disabled:opacity-50"
            >
              Prev
            </button>
            <span>
              Page {clampedContentPage} of {filteredTotalPages}
            </span>
            <button
              onClick={() => setContentPage((prev) => Math.min(filteredTotalPages, prev + 1))}
              disabled={clampedContentPage >= filteredTotalPages}
              className="glass-control px-2 py-1 disabled:opacity-50"
            >
              Next
            </button>
            <button
              onClick={() => setContentPage(filteredTotalPages)}
              disabled={clampedContentPage >= filteredTotalPages}
              className="glass-control px-2 py-1 disabled:opacity-50"
            >
              Last
            </button>
          </div>
        )}

        {active === "other" && (
          <CatalogView title="Other" items={pagedFilteredActiveItems} query={contentQuery} onAdd={openAssignModal} onTagClick={applyResultTagFilter} onCompare={addCompareSeed} onStageClone={stageCloneCandidate} />
        )}
        {active === "docs" && (
          <CatalogView title="Docs" items={pagedFilteredActiveItems} query={contentQuery} onAdd={openAssignModal} onTagClick={applyResultTagFilter} onCompare={addCompareSeed} onStageClone={stageCloneCandidate} />
        )}
        {active === "release_notes" && (
          <CatalogView title="Release Notes" items={pagedFilteredActiveItems} query={contentQuery} onAdd={openAssignModal} onTagClick={applyResultTagFilter} onCompare={addCompareSeed} onStageClone={stageCloneCandidate} />
        )}
        {active === "guides" && (
          <CatalogView title="Guides" items={pagedFilteredActiveItems} query={contentQuery} onAdd={openAssignModal} onTagClick={applyResultTagFilter} onCompare={addCompareSeed} onStageClone={stageCloneCandidate} />
        )}
        {active === "blog" && (
          <CatalogView title="Blog" items={pagedFilteredActiveItems} query={contentQuery} onAdd={openAssignModal} onTagClick={applyResultTagFilter} onCompare={addCompareSeed} onStageClone={stageCloneCandidate} />
        )}
        {active === "resources" && (
          <CatalogView title="Resources" items={pagedFilteredActiveItems} query={contentQuery} onAdd={openAssignModal} onTagClick={applyResultTagFilter} onCompare={addCompareSeed} onStageClone={stageCloneCandidate} />
        )}
        {active === "help_kb" && (
          <CatalogView title="Help/KB Articles" items={pagedFilteredActiveItems} query={contentQuery} onAdd={openAssignModal} onTagClick={applyResultTagFilter} onCompare={addCompareSeed} onStageClone={stageCloneCandidate} />
        )}
        {active === "demos" && (
          <CatalogView title="Demos" items={pagedFilteredActiveItems} query={contentQuery} onAdd={openAssignModal} onTagClick={applyResultTagFilter} onCompare={addCompareSeed} onStageClone={stageCloneCandidate} />
        )}
        {active === "ecosystem_marketplace" && (
          <CatalogView title="Ecosystem/Marketplace" items={pagedFilteredActiveItems} query={contentQuery} onAdd={openAssignModal} onTagClick={applyResultTagFilter} onCompare={addCompareSeed} onStageClone={stageCloneCandidate} />
        )}
        {isCompetitorNavigationKey(active) && !!activeCompetitorNavItem && (
          <CatalogView title={activeCompetitorNavItem.viewTitle || activeCompetitorNavItem.label} items={pagedFilteredActiveItems} query={contentQuery} onAdd={openAssignModal} onTagClick={applyResultTagFilter} onCompare={addCompareSeed} onStageClone={stageCloneCandidate} />
        )}

        {active === "manage_customers" && (
          <ManageCustomersView
            tab={manageCustomersTab}
            setTab={setManageCustomersTab}
            templatesView={(
              <TemplatesView
                templates={templates}
                deletedTemplates={deletedTemplates}
                customers={customers}
                setTemplates={setTemplates}
                restoreTemplate={restoreTemplate}
                query={manageCustomersTab === "templates" ? deferredQuery : ""}
                onOpenTemplateDetails={setTemplateDetailId}
                onOpenCreateTemplate={() => setCreateTemplateModalOpen(true)}
              />
            )}
            customersView={(
              <CustomersView
                customers={customers}
                query={manageCustomersTab === "customers" ? deferredQuery : ""}
                onOpenCustomer={setOpenCustomerId}
                onOpenCreateCustomer={() => setCreateCustomerModalOpen(true)}
                onDeleteCustomer={deleteCustomer}
              />
            )}
            checklistView={<ChecklistView customers={customers} templates={templates} onOpenCustomer={setOpenCustomerId} />}
          />
        )}

        {active === "audit" && (
          <AuditView
            audit={audit}
            confirmedItems={smartGapConfirmedItems}
            dismissedItems={smartGapDismissedItems}
            onDismissConfirmed={(gapId) => setGapFeedbackState(gapId, "dismissed")}
          />
        )}

        <AssignToTemplateModal
          key={`assign_${assignModalOpen ? "open" : "closed"}_${assignContent?.id || "none"}`}
          open={assignModalOpen}
          onClose={() => setAssignModalOpen(false)}
          content={assignContent}
          templates={templates}
          onAssign={assignCatalogItemToTemplates}
        />

        <CreateTemplateModal
          key={`create_template_${createTemplateModalOpen ? "open" : "closed"}`}
          open={createTemplateModalOpen}
          onClose={() => setCreateTemplateModalOpen(false)}
          onCreate={createTemplate}
        />

        <CreateCustomerModal
          key={`create_customer_${createCustomerModalOpen ? "open" : "closed"}`}
          open={createCustomerModalOpen}
          onClose={() => setCreateCustomerModalOpen(false)}
          onCreate={createCustomer}
        />

        <ImportModal
          key={`import_${importModalOpen ? "open" : "closed"}`}
          open={importModalOpen}
          onClose={() => setImportModalOpen(false)}
          onImport={handleImportData}
        />

        <ExportModal
          key={`export_${exportModalOpen ? "open" : "closed"}`}
          open={exportModalOpen}
          onClose={() => setExportModalOpen(false)}
          onExport={handleExport}
          initialOptions={backupOptions}
        />

        <SettingsModal
          open={settingsModalOpen}
          onClose={() => setSettingsModalOpen(false)}
          dark={dark}
          setDark={setDark}
          recentDaysWindow={recentDaysWindow}
          setRecentDaysWindow={setRecentDaysWindow}
          onOpenExportModal={() => setExportModalOpen(true)}
          onOpenImportModal={() => setImportModalOpen(true)}
          onOpenAuditLog={() => {
            setSettingsModalOpen(false);
            setActive("audit");
          }}
          indexPaths={indexPaths}
          setIndexPaths={setIndexPaths}
          indexPathStatus={indexPathStatus}
          onEstimateIndexPath={onEstimateIndexPath}
          onLoadIndexFromPath={onLoadIndexFromPath}
          onSaveIndexToPath={onSaveIndexToPath}
          errorLogEntries={errorLogEntries}
          onClearErrorLog={() => setDebugLogs([])}
        />

        <TemplateDetailModal
          key={`template_detail_${templateDetailId || "none"}`}
          open={!!templateDetailId}
          onClose={() => setTemplateDetailId(null)}
          template={openTemplate}
          customers={customers}
          onUpdateTemplate={(templateId, updater) => {
            setTemplates((prev) =>
              prev.map((template) => {
                if (template.id !== templateId) return template;
                const next = updater(template);
                return ensureTemplateShape(next);
              })
            );
          }}
          onOpenStatusCustomers={(title, list) =>
            setStatusCustomersModal({ open: true, title, customers: list })
          }
        />

        <StatusCustomersModal
          open={statusCustomersModal.open}
          onClose={() => setStatusCustomersModal({ open: false, title: "", customers: [] })}
          title={statusCustomersModal.title}
          customers={statusCustomersModal.customers}
        />

        <CloneInstructionsModal
          open={!!cloneInstructionTarget}
          item={cloneInstructionTarget}
          onClose={() => setCloneInstructionTarget(null)}
        />

        <CustomerModal
          key={`customer_modal_${openCustomerId || "none"}`}
          open={!!openCustomerId}
          onClose={() => setOpenCustomerId(null)}
          customer={openCustomer}
          templates={templates}
          setCustomers={setCustomers}
        />
      </main>
    </div>
  );
}