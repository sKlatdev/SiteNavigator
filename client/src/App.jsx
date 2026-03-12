import { useEffect, useMemo, useState } from "react";
import {
  LayoutDashboard,
  Puzzle,
  PlugZap,
  BookOpen,
  FileText,
  Search,
  Sun,
  Moon,
  UserCircle2,
  CheckCircle2,
  Circle,
  MinusCircle,
  Tag,
  MessageCircle,
  ClipboardList,
  Building2,
  Download,
  Upload,
  AlertTriangle,
  RotateCcw,
  History,
  ExternalLink,
  X,
  Plus,
  BookMarked,
  FolderOpen,
} from "lucide-react";
import {
  apiGetContent,
  apiGetSyncStatus,
  apiRunSync,
  apiGetSyncProgress,
} from "./lib/api";

/** =========================================================
 * Constants
 * ========================================================= */
const APP_SCHEMA_VERSION = 4;
const TEMPLATE_EXPORT_SCHEMA_VERSION = 4;

const STATUS = {
  NOT_INTERESTED: "not_interested",
  DISCUSSED: "discussed",
  INTERESTED: "interested",
  IN_PROGRESS: "in_progress",
  IMPLEMENTED: "implemented",
};

const STATUS_OPTIONS = [
  STATUS.NOT_INTERESTED,
  STATUS.DISCUSSED,
  STATUS.INTERESTED,
  STATUS.IN_PROGRESS,
  STATUS.IMPLEMENTED,
];

const statusMeta = {
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

const STORAGE_KEYS = {
  darkMode: "sn_dark_mode",
  templates: "sn_templates",
  customers: "sn_customers",
  audit: "sn_audit",
  lastBackupAt: "sn_last_backup_at",
  indexedContent: "sn_indexed_content",
  recentDaysWindow: "sn_recent_days_window",
};

const defaultTemplates = [
  {
    id: "t1",
    name: "Duo Rollout Baseline",
    group: "Enterprise",
    version: 1,
    items: [
      {
        id: "ti_1",
        label: "Passwordless",
        sourceType: "manual",
        sourceRefId: null,
        sourceUrl: "https://duo.com",
      },
    ],
    usage: 1,
    deletedAt: null,
  },
];

const defaultCustomers = [
  {
    id: "c1",
    name: "Acme Corp",
    segment: "Enterprise",
    akey: "AKEY-ACME-001",
    omniLink: "https://example.omni/acme",
    assignedTemplates: {
      t1: {
        status: STATUS.IN_PROGRESS,
        itemStatuses: { "lbl:passwordless": STATUS.IN_PROGRESS },
      },
    },
  },
];

const defaultAudit = [];
const defaultIndexedContent = [];

/** =========================================================
 * Helpers
 * ========================================================= */
function readStorage(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}
const isArray = Array.isArray;
const nowIso = () => new Date().toISOString();

function mergeById(current, incoming) {
  const map = new Map();
  current.forEach((i) => map.set(i.id, i));
  incoming.forEach((i) => map.set(i.id, i));
  return Array.from(map.values());
}

function daysSince(iso) {
  if (!iso) return 9999;
  const then = new Date(iso).getTime();
  const now = Date.now();
  return Math.floor((now - then) / (1000 * 60 * 60 * 24));
}

function isRecentlyUpdated(pageLastUpdated, windowDays) {
  return daysSince(pageLastUpdated) <= windowDays;
}

function downloadJson(filename, object) {
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

function selectCls() {
  return "rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 p-2";
}

function normalizeLabel(label) {
  return (label || "").trim().toLowerCase();
}

function getTemplateItemKey(item) {
  if (item?.sourceRefId) return `ref:${item.sourceRefId}`;
  return `lbl:${normalizeLabel(item?.label)}`;
}

function toTemplateItemFromContent(content, sourceType = "catalog") {
  return {
    id: `ti_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    label: content.title,
    sourceType,
    sourceRefId: content.id || null,
    sourceUrl: content.url || "",
  };
}

function mapIndexedToCatalogItem(item) {
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
    author: "Duo",
    tags: [item.category || "other"],
  };
}

function categoryLabel(cat) {
  if (cat === "blog") return "Blog";
  if (cat === "docs") return "Docs";
  if (cat === "guides") return "Guides";
  if (cat === "resources") return "Resources";
  if (cat === "help_kb") return "Help/KB Articles";
  if (cat === "demos") return "Demos";
  return "Other";
}

/** =========================================================
 * Reusable UI
 * ========================================================= */
function EmptyState({ title, text }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 p-8 text-center">
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
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-5">
        <h3 className="font-semibold text-lg">{title}</h3>
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
      </div>
    </div>
  );
}

function BaseModal({ open, title, onClose, children, widthClass = "max-w-4xl" }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-black/40 z-50 p-4 overflow-auto">
      <div
        className={`${widthClass} mx-auto rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-5`}
      >
        <div className="flex items-start justify-between gap-2 mb-3">
          <h3 className="text-xl font-semibold">{title}</h3>
          <button onClick={onClose} className="p-2 rounded-lg border">
            <X size={16} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function BadgeRecentlyUpdated({ pageLastUpdated, windowDays }) {
  if (!isRecentlyUpdated(pageLastUpdated, windowDays)) return null;
  return (
    <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
      Page recently updated
    </span>
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

/** =========================================================
 * Top-level components
 * ========================================================= */
function Sidebar({ active, setActive, counts }) {
  const items = [
    { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { key: "other", label: "Other", icon: Puzzle },
    { key: "docs", label: "Docs", icon: FileText },
    { key: "guides", label: "Guides", icon: BookMarked },
    { key: "blog", label: "Blog", icon: BookOpen },
    { key: "resources", label: "Resources", icon: FolderOpen },
    { key: "help_kb", label: "Help/KB Articles", icon: FileText },
    { key: "demos", label: "Demos", icon: PlugZap },
    { key: "templates", label: "Templates", icon: ClipboardList },
    { key: "customers", label: "Customers", icon: Building2 },
    { key: "audit", label: "Audit Log", icon: History },
    { key: "checklist", label: "Checklist View", icon: CheckCircle2 },
  ];

  return (
    <aside className="w-72 shrink-0 h-screen sticky top-0 border-r border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 backdrop-blur">
      <div className="p-5">
        <h1 className="text-xl font-bold tracking-tight">SiteNavigator</h1>
        <p className="text-xs text-slate-500 mt-1">DUO SITE ROADMAP</p>
      </div>
      <nav className="px-3 pb-6 space-y-1">
        {items.map((item) => {
          const Icon = item.icon;
          const selected = active === item.key;
          const count = counts[item.key];
          return (
            <button
              key={item.key}
              onClick={() => setActive(item.key)}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm transition ${
                selected
                  ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
                  : "hover:bg-slate-100 dark:hover:bg-slate-800"
              }`}
            >
              <span className="flex items-center gap-2">
                <Icon size={16} />
                {item.label}
              </span>
              {typeof count === "number" && (
                <span
                  className={`text-xs px-2 py-0.5 rounded-full ${
                    selected ? "bg-white/20" : "bg-slate-200 dark:bg-slate-700"
                  }`}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </nav>
    </aside>
  );
}

function TopBar(props) {
  const {
    dark,
    setDark,
    query,
    setQuery,
    autosaveStatus,
    exportType,
    setExportType,
    importMode,
    setImportMode,
    onExport,
    onImportFile,
    recentDaysWindow,
    setRecentDaysWindow,
    onResync,
    syncState,
  } = props;

  return (
    <header className="flex flex-wrap items-center gap-3 mb-6">
      <div className="flex-1 min-w-[240px] relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2" size={16} />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search all site content..."
          className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 outline-none"
        />
      </div>

      <span className="text-xs px-2 py-1 rounded-md bg-slate-100 dark:bg-slate-800">
        {autosaveStatus}
      </span>

      <div className="flex items-center gap-2">
        <span className="text-xs text-slate-500">Recent window</span>
        <input
          type="number"
          min={1}
          max={30}
          value={recentDaysWindow}
          onChange={(e) =>
            setRecentDaysWindow(Math.max(1, Math.min(30, Number(e.target.value) || 14)))
          }
          className="w-16 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-2 text-sm"
        />
      </div>

      <select value={exportType} onChange={(e) => setExportType(e.target.value)} className={selectCls()}>
        <option value="full">Export: Full Backup</option>
        <option value="templates">Export: Template Export</option>
      </select>

      <select value={importMode} onChange={(e) => setImportMode(e.target.value)} className={selectCls()}>
        <option value="replace">Import: Replace</option>
        <option value="merge">Import: Merge</option>
      </select>

      <button
        onClick={onExport}
        className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
        title="Export JSON"
      >
        <Download size={18} />
      </button>

      <label
        className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 cursor-pointer"
        title="Import JSON"
      >
        <Upload size={18} />
        <input type="file" accept="application/json" className="hidden" onChange={onImportFile} />
      </label>

      <button
        onClick={onResync}
        disabled={syncState?.loading || syncState?.inProgress}
        className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm disabled:opacity-60"
      >
        {syncState?.loading || syncState?.inProgress ? "Resyncing..." : "Resync"}
      </button>

      <button
        onClick={() => setDark(!dark)}
        className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
      >
        {dark ? <Sun size={18} /> : <Moon size={18} />}
      </button>

      <button className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
        <UserCircle2 size={18} />
      </button>

      {(syncState?.lastRun || syncState?.error) && (
        <div className="w-full text-xs text-slate-500 mt-1">
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
          <div className="h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
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

function Dashboard({ itemsByCategory, backupStale, onQuickExport }) {
  const total = Object.values(itemsByCategory).reduce((a, b) => a + b.length, 0);

  return (
    <div className="space-y-4">
      {backupStale && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-700 p-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm">
            <AlertTriangle size={16} />
            It’s been over 14 days since your last Full Backup export.
          </div>
          <button onClick={onQuickExport} className="text-xs px-2 py-1 rounded-md bg-amber-600 text-white">
            Export now
          </button>
        </div>
      )}
      <h2 className="text-2xl font-semibold">SITE NAVIGATOR ROADMAP</h2>
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-4">
        <div className="rounded-2xl p-5 bg-teal-500 text-white">
          <p className="text-sm opacity-90">Catalog</p>
          <p className="text-3xl font-bold mt-2">{total}</p>
          <p className="text-sm mt-2">Indexed site objects</p>
        </div>
        <div className="rounded-2xl p-5 bg-blue-700 text-white">
          <p className="text-sm opacity-90">Docs</p>
          <p className="text-3xl font-bold mt-2">{itemsByCategory.docs.length}</p>
        </div>
        <div className="rounded-2xl p-5 bg-violet-600 text-white">
          <p className="text-sm opacity-90">Guides</p>
          <p className="text-3xl font-bold mt-2">{itemsByCategory.guides.length}</p>
        </div>
        <div className="rounded-2xl p-5 bg-orange-500 text-white">
          <p className="text-sm opacity-90">Resources</p>
          <p className="text-3xl font-bold mt-2">{itemsByCategory.resources.length}</p>
        </div>
      </div>
    </div>
  );
}

function CatalogCard({ item, recentDaysWindow, onAdd }) {
  return (
    <div className="rounded-2xl p-4 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-semibold">{item.title}</h3>
        <BadgeRecentlyUpdated
          pageLastUpdated={item.pageLastUpdated || item.updated}
          windowDays={recentDaysWindow}
        />
      </div>
      <div className="text-xs text-slate-500 mt-1 flex flex-wrap gap-2 items-center">
        <span className="inline-flex items-center gap-1">
          <Tag size={12} />
          {categoryLabel(item.category)}
        </span>
        {item.pathSummary && <span>· {item.pathSummary}</span>}
      </div>
      <p className="text-sm mt-3 text-slate-600 dark:text-slate-300">{item.summary}</p>
      <div className="mt-4 flex gap-2">
        <button
          onClick={() => onAdd(item)}
          className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded border bg-white dark:bg-slate-800"
        >
          <Plus size={12} /> Add to Template
        </button>
        <a
          href={item.url || "https://duo.com"}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded border bg-white dark:bg-slate-800"
        >
          Open <ExternalLink size={12} />
        </a>
      </div>
    </div>
  );
}

function CatalogView({ title, items, query, recentDaysWindow, onAdd }) {
  const filtered = items.filter((i) =>
    [i.title, i.summary, i.pathSummary, i.category].join(" ").toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div>
      <h2 className="text-2xl font-semibold mb-4">{title}</h2>
      {!filtered.length ? (
        <EmptyState title={`No ${title.toLowerCase()} matches`} text="Try another search term." />
      ) : (
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((item) => (
            <CatalogCard key={item.id} item={item} recentDaysWindow={recentDaysWindow} onAdd={onAdd} />
          ))}
        </div>
      )}
    </div>
  );
}

function AssignToTemplateModal({ open, onClose, content, templates, onAssign }) {
  const activeTemplates = templates.filter((t) => !t.deletedAt);
  const [selected, setSelected] = useState([]);

  useEffect(() => {
    if (open) setSelected([]);
  }, [open]);

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

function TemplateDetailModal({ open, onClose, template, customers, onOpenStatusCustomers }) {
  if (!open || !template) return null;

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

  return (
    <BaseModal open={open} onClose={onClose} title={`Template: ${template.name}`} widthClass="max-w-5xl">
      <p className="text-sm text-slate-500 mb-4">
        Version: {template.version || 1} · Group: {template.group} · Items: {(template.items || []).length}
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
        <p className="font-medium mb-2">Template items</p>
        {!template.items?.length ? (
          <p className="text-sm text-slate-500">No items yet.</p>
        ) : (
          <div className="space-y-2">
            {template.items.map((it) => (
              <div key={it.id} className="text-sm p-2 rounded border border-slate-200 dark:border-slate-700">
                <p className="font-medium">{it.label}</p>
                <p className="text-xs text-slate-500">{it.sourceUrl || "—"}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </BaseModal>
  );
}

function CustomerModal({ open, onClose, customer, templates, setCustomers }) {
  const [selectedTemplateId, setSelectedTemplateId] = useState("");

  useEffect(() => {
    if (customer) {
      setSelectedTemplateId(Object.keys(customer.assignedTemplates || {})[0] || "");
    }
  }, [customer]);

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
      (template?.items || []).forEach((it) => {
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
                    <th className="text-left p-2">Object</th>
                    <th className="text-left p-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {(selectedTemplate.items || []).map((it) => {
                    const stableKey = getTemplateItemKey(it);
                    const itemStatus =
                      selectedAssignment.itemStatuses?.[stableKey] ||
                      selectedAssignment.itemStatuses?.[it.id] ||
                      STATUS.DISCUSSED;

                    return (
                      <tr key={it.id} className="border-t border-slate-200 dark:border-slate-700">
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

function TemplatesView({
  templates,
  deletedTemplates,
  customers,
  setTemplates,
  restoreTemplate,
  query,
  onOpenTemplateDetails,
}) {
  const [name, setName] = useState("");
  const [group, setGroup] = useState("Enterprise");
  const [deleteTarget, setDeleteTarget] = useState(null);

  const activeTemplates = templates.filter((t) => !t.deletedAt);
  const filtered = activeTemplates.filter((t) =>
    [t.name, t.group, ...(t.items || []).map((i) => i.label)].join(" ").toLowerCase().includes(query.toLowerCase())
  );

  const addTemplate = () => {
    if (!name.trim()) return;
    const newTemplate = {
      id: `t_${Date.now()}`,
      name: name.trim(),
      group,
      version: 1,
      items: [],
      usage: 0,
      deletedAt: null,
    };
    setTemplates((prev) => [newTemplate, ...prev]);
    setName("");
  };

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
    <div className="space-y-4">
      <ConfirmModal
        open={!!deleteTarget}
        title="Delete template?"
        body="Move to Recently Deleted."
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      <h2 className="text-2xl font-semibold">Templates</h2>

      <div className="rounded-2xl p-4 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
        <div className="grid md:grid-cols-3 gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Template name"
            className={selectCls()}
          />
          <select value={group} onChange={(e) => setGroup(e.target.value)} className={selectCls()}>
            <option>Enterprise</option>
            <option>Mid-Market</option>
            <option>Healthcare</option>
            <option>Public Sector</option>
            <option>Regulated</option>
          </select>
          <button
            onClick={addTemplate}
            className="rounded-lg px-3 py-2 bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
          >
            Create
          </button>
        </div>
      </div>

      {!filtered.length ? (
        <EmptyState title="No templates found" text="Create a template." />
      ) : (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((t) => (
            <div key={t.id} className="rounded-2xl p-4 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
              <h3 className="font-semibold">
                {t.name} <span className="text-xs text-slate-500">v{t.version || 1}</span>
              </h3>
              <p className="text-xs text-slate-500">Group: {t.group}</p>
              <p className="text-xs text-slate-500 mt-1">Items: {(t.items || []).length}</p>
              <p className="text-xs text-slate-500">Assigned: {t.usage || 0}</p>
              <div className="mt-3 flex gap-2">
                <button onClick={() => onOpenTemplateDetails(t.id)} className="text-xs px-2 py-1 rounded border">
                  Open
                </button>
                <button
                  onClick={() => setDeleteTarget(t)}
                  className="text-xs px-2 py-1 rounded border border-rose-300 text-rose-700"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="rounded-2xl p-4 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
        <h3 className="font-semibold mb-2">Recently Deleted</h3>
        {!deletedTemplates.length ? (
          <p className="text-sm text-slate-500">None</p>
        ) : (
          deletedTemplates.map((t) => (
            <div key={t.id} className="flex items-center justify-between text-sm p-2 rounded bg-slate-50 dark:bg-slate-800 mb-2">
              <span>{t.name}</span>
              <button onClick={() => restoreTemplate(t.id)} className="text-xs px-2 py-1 rounded border">
                Restore
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function CustomersView({ customers, setCustomers, query, onOpenCustomer }) {
  const [newName, setNewName] = useState("");
  const [newSegment, setNewSegment] = useState("Enterprise");
  const [newAkey, setNewAkey] = useState("");
  const [newOmni, setNewOmni] = useState("");

  const filtered = customers.filter((c) =>
    [c.name, c.segment, c.akey, c.omniLink].join(" ").toLowerCase().includes(query.toLowerCase())
  );

  const addCustomer = () => {
    if (!newName.trim()) return;
    setCustomers((prev) => [
      {
        id: `c_${Date.now()}`,
        name: newName.trim(),
        segment: newSegment,
        akey: newAkey.trim(),
        omniLink: newOmni.trim(),
        assignedTemplates: {},
      },
      ...prev,
    ]);
    setNewName("");
    setNewAkey("");
    setNewOmni("");
    setNewSegment("Enterprise");
  };

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-semibold">Customers</h2>

      <div className="rounded-2xl p-4 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
        <div className="grid xl:grid-cols-5 md:grid-cols-2 gap-2">
          <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Customer name" className={selectCls()} />
          <select value={newSegment} onChange={(e) => setNewSegment(e.target.value)} className={selectCls()}>
            <option>Enterprise</option>
            <option>Mid-Market</option>
            <option>Healthcare</option>
            <option>Public Sector</option>
            <option>Regulated</option>
          </select>
          <input value={newAkey} onChange={(e) => setNewAkey(e.target.value)} placeholder="AKEY" className={selectCls()} />
          <input value={newOmni} onChange={(e) => setNewOmni(e.target.value)} placeholder="Omni Link" className={selectCls()} />
          <button onClick={addCustomer} className="rounded-lg px-3 py-2 bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900">
            Add
          </button>
        </div>
      </div>

      {!filtered.length ? (
        <EmptyState title="No customers" text="Add one." />
      ) : (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
          {filtered.map((c) => (
            <div key={c.id} className="grid grid-cols-12 p-3 border-t border-slate-200 dark:border-slate-800 items-center text-sm">
              <div className="col-span-3">{c.name}</div>
              <div className="col-span-2">{c.segment}</div>
              <div className="col-span-2">{c.akey || "—"}</div>
              <div className="col-span-3">
                {c.omniLink ? (
                  <a href={c.omniLink} target="_blank" rel="noreferrer" className="text-blue-600 dark:text-blue-300">
                    Open
                  </a>
                ) : (
                  "—"
                )}
              </div>
              <div className="col-span-2">
                <button onClick={() => onOpenCustomer(c.id)} className="text-xs px-2 py-1 rounded border">
                  Open
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AuditView({ audit }) {
  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-semibold">Audit Log</h2>
      {!audit.length ? (
        <EmptyState title="No audit entries yet" text="Actions appear here." />
      ) : (
        audit
          .slice()
          .reverse()
          .map((a) => (
            <div key={a.id} className="p-3 rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-sm">
              <p className="font-medium">{a.action}</p>
              <p>{a.message}</p>
              <p className="text-xs text-slate-500">{a.at}</p>
            </div>
          ))
      )}
    </div>
  );
}

function ChecklistView() {
  return <EmptyState title="Checklist View" text="Use customer/template modals to track statuses." />;
}

/** =========================================================
 * App
 * ========================================================= */
export default function App() {
  const [active, setActive] = useState("dashboard");
  const [query, setQuery] = useState("");
  const [exportType, setExportType] = useState("full");
  const [importMode, setImportMode] = useState("replace");
  const [autosaveStatus, setAutosaveStatus] = useState("Saved");
  const [recentDaysWindow, setRecentDaysWindow] = useState(() =>
    readStorage(STORAGE_KEYS.recentDaysWindow, 14)
  );

  const [dark, setDark] = useState(() => readStorage(STORAGE_KEYS.darkMode, false));
  const [templates, setTemplates] = useState(() => readStorage(STORAGE_KEYS.templates, defaultTemplates));
  const [customers, setCustomers] = useState(() => readStorage(STORAGE_KEYS.customers, defaultCustomers));
  const [audit, setAudit] = useState(() => readStorage(STORAGE_KEYS.audit, defaultAudit));
  const [lastBackupAt, setLastBackupAt] = useState(() => readStorage(STORAGE_KEYS.lastBackupAt, null));
  const [indexedContent, setIndexedContent] = useState(() =>
    readStorage(STORAGE_KEYS.indexedContent, defaultIndexedContent)
  );

  const [openCustomerId, setOpenCustomerId] = useState(null);
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

  const [toast, setToast] = useState({ show: false, message: "" });

  const pushAudit = (action, message) => {
    setAudit((prev) => [
      ...prev,
      { id: `a_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`, action, message, at: nowIso() },
    ]);
  };

  const activeTemplates = templates.filter((t) => !t.deletedAt);
  const deletedTemplates = templates.filter((t) => !!t.deletedAt);
  const backupStale = daysSince(lastBackupAt) > 14;

  const openCustomer = customers.find((c) => c.id === openCustomerId) || null;
  const openTemplate = templates.find((t) => t.id === templateDetailId) || null;

  const catalog = indexedContent.map(mapIndexedToCatalogItem);
  const filteredCatalog = catalog.filter((i) =>
    [i.title, i.summary, i.pathSummary, i.category].join(" ").toLowerCase().includes(query.toLowerCase())
  );

  const itemsByCategory = {
    blog: filteredCatalog.filter((i) => i.category === "blog"),
    docs: filteredCatalog.filter((i) => i.category === "docs"),
    guides: filteredCatalog.filter((i) => i.category === "guides"),
    resources: filteredCatalog.filter((i) => i.category === "resources"),
    help_kb: filteredCatalog.filter((i) => i.category === "help_kb"),
    demos: filteredCatalog.filter((i) => i.category === "demos"),
    other: filteredCatalog.filter(
      (i) => !["blog", "docs", "guides", "resources", "help_kb", "demos"].includes(i.category)
    ),
  };

  const templateFilteredCount = templates
    .filter((t) => !t.deletedAt)
    .filter((t) =>
      [t.name, t.group, ...(t.items || []).map((it) => it.label)].join(" ").toLowerCase().includes(query.toLowerCase())
    ).length;

  const customerFilteredCount = customers
    .filter((c) => [c.name, c.segment, c.akey, c.omniLink].join(" ").toLowerCase().includes(query.toLowerCase())).length;

  const counts = {
    dashboard: null,
    other: itemsByCategory.other.length,
    docs: itemsByCategory.docs.length,
    guides: itemsByCategory.guides.length,
    blog: itemsByCategory.blog.length,
    resources: itemsByCategory.resources.length,
    help_kb: itemsByCategory.help_kb.length,
    demos: itemsByCategory.demos.length,
    templates: templateFilteredCount,
    customers: customerFilteredCount,
    audit: null,
    checklist: null,
  };

  useMemo(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);

  const saveWithStatus = (key, value) => {
    setAutosaveStatus("Saving...");
    localStorage.setItem(key, JSON.stringify(value));
    setTimeout(() => setAutosaveStatus("Saved"), 120);
  };

  useEffect(() => saveWithStatus(STORAGE_KEYS.darkMode, dark), [dark]);
  useEffect(() => saveWithStatus(STORAGE_KEYS.templates, templates), [templates]);
  useEffect(() => saveWithStatus(STORAGE_KEYS.customers, customers), [customers]);
  useEffect(() => saveWithStatus(STORAGE_KEYS.audit, audit), [audit]);
  useEffect(() => saveWithStatus(STORAGE_KEYS.lastBackupAt, lastBackupAt), [lastBackupAt]);
  useEffect(() => saveWithStatus(STORAGE_KEYS.indexedContent, indexedContent), [indexedContent]);
  useEffect(() => saveWithStatus(STORAGE_KEYS.recentDaysWindow, recentDaysWindow), [recentDaysWindow]);

  useEffect(() => {
    const usage = {};
    customers.forEach((c) => {
      Object.keys(c.assignedTemplates || {}).forEach((tid) => {
        usage[tid] = (usage[tid] || 0) + 1;
      });
    });
    const next = templates.map((t) => ({ ...t, usage: usage[t.id] || 0 }));
    if (JSON.stringify(next) !== JSON.stringify(templates)) setTemplates(next);
  }, [customers]);

  const refreshSyncStatus = async () => {
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
    }
  };

  const refreshIndexedContentFromServer = async () => {
    try {
      const response = await apiGetContent(recentDaysWindow);
      const mapped = (response.items || []).map((x) => ({
        id: x.id,
        url: x.url,
        title: x.title,
        category: x.category || "other",
        pathSummary: x.pathSummary || "",
        summary: x.summary,
        pageLastUpdated: x.pageLastUpdated,
        contentHash: x.contentHash,
        updatedAt: x.updatedAt,
      }));
      setIndexedContent(mapped);
    } catch (e) {
      setSyncState((prev) => ({ ...prev, error: e.message || "Failed to load content" }));
    }
  };

  useEffect(() => {
    refreshSyncStatus();
    refreshIndexedContentFromServer();
  }, []);

  useEffect(() => {
    refreshIndexedContentFromServer();
  }, [recentDaysWindow]);

  useEffect(() => {
    if (!syncState.inProgress && !syncState.loading) return;

    const t = setInterval(async () => {
      try {
        const r = await apiGetSyncProgress();
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
      } catch {}
    }, 1000);

    return () => clearInterval(t);
  }, [syncState.inProgress, syncState.loading]);

  const runResync = async () => {
    try {
      setSyncState((prev) => ({
        ...prev,
        loading: true,
        inProgress: true,
        error: "",
        progress: { percent: 0, processed: 0, queued: 0, currentUrl: "", currentDepth: 0 },
      }));
      await apiRunSync();
      await refreshSyncStatus();
      await refreshIndexedContentFromServer();
      pushAudit("RESYNC_COMPLETED", "Performed incremental site resync.");
    } catch (e) {
      setSyncState((prev) => ({ ...prev, error: e.message || "Resync failed" }));
      pushAudit("RESYNC_FAILED", e.message || "Resync failed");
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

        const exists = (t.items || []).some(
          (it) =>
            (assignContent.id && it.sourceRefId === assignContent.id) ||
            it.label.toLowerCase() === assignContent.title.toLowerCase()
        );
        if (exists) return t;

        selectedNames.push(t.name);
        return { ...t, items: [...(t.items || []), toTemplateItemFromContent(assignContent, "catalog")] };
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

  const handleExport = (forcedType = null) => {
    const kind = forcedType || exportType;
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");

    if (kind === "full") {
      const payload = {
        exportType: "full_backup",
        schemaVersion: APP_SCHEMA_VERSION,
        exportedAt: nowIso(),
        data: { dark, templates, customers, audit, indexedContent, recentDaysWindow },
      };
      downloadJson(`sitenavigator-full-backup-${stamp}.json`, payload);
      setLastBackupAt(nowIso());
      return;
    }

    const templateCopy = templates.map((t) => ({ ...t, usage: 0, deletedAt: null }));
    const refIds = new Set();
    templateCopy.forEach((t) =>
      (t.items || []).forEach((it) => {
        if (it.sourceType === "indexed" && it.sourceRefId) refIds.add(it.sourceRefId);
      })
    );
    const refIndexed = indexedContent.filter((ic) => refIds.has(ic.id));

    const payload = {
      exportType: "templates_only",
      schemaVersion: TEMPLATE_EXPORT_SCHEMA_VERSION,
      exportedAt: nowIso(),
      data: { templates: templateCopy, indexedContent: refIndexed },
      note: "No customer-specific data included.",
    };
    downloadJson(`sitenavigator-template-export-${stamp}.json`, payload);
  };

  const handleImportFile = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const json = JSON.parse(await file.text());
      const { exportType: incomingType, schemaVersion, data } = json || {};
      if (!data || schemaVersion < 1 || schemaVersion > APP_SCHEMA_VERSION) {
        alert("Invalid import");
        return;
      }

      if (incomingType === "templates_only") {
        const incomingTemplates = (data.templates || []).map((t) => ({
          ...t,
          usage: 0,
          deletedAt: null,
        }));
        const incomingIndexed = isArray(data.indexedContent) ? data.indexedContent : [];
        if (importMode === "replace") {
          setTemplates(incomingTemplates);
          setIndexedContent(incomingIndexed);
        } else {
          setTemplates((prev) => mergeById(prev, incomingTemplates));
          setIndexedContent((prev) => mergeById(prev, incomingIndexed));
        }
        return;
      }

      if (incomingType === "full_backup") {
        if (importMode === "replace") {
          setDark(data.dark);
          setTemplates(data.templates);
          setCustomers(data.customers);
          setAudit(data.audit);
          setIndexedContent(data.indexedContent);
          setRecentDaysWindow(Math.max(1, Math.min(30, Number(data.recentDaysWindow || 14))));
        } else {
          setDark(data.dark);
          setTemplates((prev) => mergeById(prev, data.templates));
          setCustomers((prev) => mergeById(prev, data.customers));
          setAudit((prev) => mergeById(prev, data.audit));
          setIndexedContent((prev) => mergeById(prev, data.indexedContent));
        }
      }
    } catch {
      alert("Import failed");
    } finally {
      event.target.value = "";
    }
  };

  const restoreTemplate = (id) => {
    setTemplates((prev) => prev.map((t) => (t.id === id ? { ...t, deletedAt: null } : t)));
  };

  return (
    <div className="flex min-h-screen">
      <Toast show={toast.show} message={toast.message} onClose={() => setToast({ show: false, message: "" })} />
      <Sidebar active={active} setActive={setActive} counts={counts} />

      <main className="flex-1 p-6">
        <TopBar
          dark={dark}
          setDark={setDark}
          query={query}
          setQuery={setQuery}
          autosaveStatus={autosaveStatus}
          exportType={exportType}
          setExportType={setExportType}
          importMode={importMode}
          setImportMode={setImportMode}
          onExport={() => handleExport()}
          onImportFile={handleImportFile}
          recentDaysWindow={recentDaysWindow}
          setRecentDaysWindow={setRecentDaysWindow}
          onResync={runResync}
          syncState={syncState}
        />

        {active === "dashboard" && (
          <Dashboard
            itemsByCategory={itemsByCategory}
            backupStale={backupStale}
            onQuickExport={() => handleExport("full")}
          />
        )}

        {active === "other" && (
          <CatalogView title="Other" items={itemsByCategory.other} query={query} recentDaysWindow={recentDaysWindow} onAdd={openAssignModal} />
        )}
        {active === "docs" && (
          <CatalogView title="Docs" items={itemsByCategory.docs} query={query} recentDaysWindow={recentDaysWindow} onAdd={openAssignModal} />
        )}
        {active === "guides" && (
          <CatalogView title="Guides" items={itemsByCategory.guides} query={query} recentDaysWindow={recentDaysWindow} onAdd={openAssignModal} />
        )}
        {active === "blog" && (
          <CatalogView title="Blog" items={itemsByCategory.blog} query={query} recentDaysWindow={recentDaysWindow} onAdd={openAssignModal} />
        )}
        {active === "resources" && (
          <CatalogView title="Resources" items={itemsByCategory.resources} query={query} recentDaysWindow={recentDaysWindow} onAdd={openAssignModal} />
        )}
        {active === "help_kb" && (
          <CatalogView title="Help/KB Articles" items={itemsByCategory.help_kb} query={query} recentDaysWindow={recentDaysWindow} onAdd={openAssignModal} />
        )}
        {active === "demos" && (
          <CatalogView title="Demos" items={itemsByCategory.demos} query={query} recentDaysWindow={recentDaysWindow} onAdd={openAssignModal} />
        )}

        {active === "templates" && (
          <TemplatesView
            templates={templates}
            deletedTemplates={deletedTemplates}
            customers={customers}
            setTemplates={setTemplates}
            restoreTemplate={restoreTemplate}
            query={query}
            onOpenTemplateDetails={setTemplateDetailId}
          />
        )}

        {active === "customers" && (
          <CustomersView customers={customers} setCustomers={setCustomers} query={query} onOpenCustomer={setOpenCustomerId} />
        )}

        {active === "audit" && <AuditView audit={audit} />}
        {active === "checklist" && <ChecklistView />}

        <AssignToTemplateModal
          open={assignModalOpen}
          onClose={() => setAssignModalOpen(false)}
          content={assignContent}
          templates={templates}
          onAssign={assignCatalogItemToTemplates}
        />

        <TemplateDetailModal
          open={!!templateDetailId}
          onClose={() => setTemplateDetailId(null)}
          template={openTemplate}
          customers={customers}
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

        <CustomerModal
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