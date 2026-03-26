import {
  CheckCircle2,
  Circle,
  MessageCircle,
  MinusCircle,
  RotateCcw,
} from "lucide-react";

export const APP_SCHEMA_VERSION = 4;
export const TEMPLATE_EXPORT_SCHEMA_VERSION = 4;

export const STATUS = {
  NOT_INTERESTED: "not_interested",
  DISCUSSED: "discussed",
  INTERESTED: "interested",
  IN_PROGRESS: "in_progress",
  IMPLEMENTED: "implemented",
};

export const STATUS_OPTIONS = [
  STATUS.NOT_INTERESTED,
  STATUS.DISCUSSED,
  STATUS.INTERESTED,
  STATUS.IN_PROGRESS,
  STATUS.IMPLEMENTED,
];

export const statusMeta = {
  [STATUS.NOT_INTERESTED]: {
    label: "Not Interested",
    chip: "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200",
    icon: Circle,
  },
  [STATUS.DISCUSSED]: {
    label: "Discussed",
    chip: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
    icon: MessageCircle,
  },
  [STATUS.INTERESTED]: {
    label: "Interested",
    chip: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
    icon: MinusCircle,
  },
  [STATUS.IN_PROGRESS]: {
    label: "In Progress",
    chip: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
    icon: RotateCcw,
  },
  [STATUS.IMPLEMENTED]: {
    label: "Implemented",
    chip: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
    icon: CheckCircle2,
  },
};

export const STORAGE_KEYS = {
  darkMode: "sn_dark_mode",
  templates: "sn_templates",
  customers: "sn_customers",
  audit: "sn_audit",
  lastBackupAt: "sn_last_backup_at",
  indexedContent: "sn_indexed_content",
  recentDaysWindow: "sn_recent_days_window",
  paginationByView: "sn_pagination_by_view",
  facetPanelByView: "sn_facet_panel_by_view",
  pinnedFilters: "sn_pinned_filters",
  watchlists: "sn_watchlists",
  compareSeeds: "sn_compare_seeds",
  comparePrefs: "sn_compare_prefs",
  compareSnapshots: "sn_compare_snapshots",
  gapFeedback: "sn_gap_feedback",
  navMenuOrder: "sn_nav_menu_order",
  backupPrefs: "sn_backup_prefs",
  indexPaths: "sn_index_paths",
  debugLogs: "sn_debug_logs",
  cloneDuoDraftId: "sn_clone_duo_draft_id",
};

export const MODULE_TYPES = {
  CORE: "core",
  ADDON: "addon",
};

export const defaultTemplates = [
  {
    id: "t1",
    name: "Duo Rollout Baseline",
    group: "Enterprise",
    version: 1,
    modules: [
      {
        id: "mod_core",
        name: "Core",
        type: "core",
        items: [
          {
            id: "ti_1",
            label: "Passwordless",
            sourceType: "manual",
            sourceRefId: null,
            sourceUrl: "https://duo.com",
          },
        ],
      },
    ],
    usage: 1,
    deletedAt: null,
  },
];

export const defaultCustomers = [
  {
    id: "c1",
    name: "Acme Corp",
    segment: "Enterprise",
    akey: "AKEY-ACME-001",
    omniLink: "https://example.omni/acme",
    owner: "",
    watchers: [],
    comments: [],
    assignedTemplates: {
      t1: {
        status: STATUS.IN_PROGRESS,
        itemStatuses: { "lbl:passwordless": STATUS.IN_PROGRESS },
      },
    },
  },
];

export const defaultAudit = [];
export const defaultIndexedContent = [];

export const CATALOG_TABS = [
  "other",
  "docs",
  "release_notes",
  "guides",
  "blog",
  "resources",
  "help_kb",
  "demos",
  "ecosystem_marketplace",
  "competitor_docs",
];
export const CONTENT_VIEWS = ["explorer", ...CATALOG_TABS];

export const EXPLORER_CATEGORY_OPTIONS = [
  { value: "", label: "All Categories" },
  { value: "blog", label: "Blog" },
  { value: "docs", label: "Docs" },
  { value: "release_notes", label: "Release Notes" },
  { value: "guides", label: "Guides" },
  { value: "resources", label: "Resources" },
  { value: "help_kb", label: "Help/KB" },
  { value: "demos", label: "Demos" },
  { value: "ecosystem_marketplace", label: "Ecosystem/Marketplace" },
  { value: "competitor_docs", label: "Competitor Documentation" },
  { value: "other", label: "Other" },
];
