import { useDeferredValue } from "react";
import { CheckCircle2, ClipboardList, Download, ExternalLink, FileWarning, Save, Sparkles, Trash2 } from "lucide-react";

import { downloadJson } from "../utils";
import { useCloneDuoDraft } from "./useCloneDuoDraft";

export function CloneDuoWorkspace({ stagedItems, onRemove, onClearStaged }) {
  const {
    draft,
    loading,
    error,
    busyAction,
    selectedSectionId,
    selectedFieldId,
    selectedIssueId,
    setSelectedSectionId,
    setSelectedFieldId,
    setSelectedIssueId,
    currentSection,
    currentFields,
    currentScreenshots,
    currentIssues,
    currentEvidence,
    generateDraft,
    saveDraft,
    exportDraft,
    deleteDraft,
    updateFieldValue,
    acceptFieldOverride,
    updateScreenshotReviewState,
    resolveIssue,
  } = useCloneDuoDraft(stagedItems);
  const deferredDraft = useDeferredValue(draft);

  async function handleExport() {
    const payload = await exportDraft();
    if (!payload) return;
    downloadText(payload.sidecar.markdownFileName, payload.markdown, "text/markdown");
    downloadJson(payload.sidecar.sidecarFileName, payload.sidecar);
  }

  async function handleDeleteDraft() {
    await deleteDraft();
  }

  return (
    <div className="space-y-4">
      <section className="glass-surface p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700 dark:border-sky-700/60 dark:bg-sky-950/40 dark:text-sky-200">
              <Sparkles size={14} />
              Clone to Duo SAML Drafts
            </div>
            <div>
              <h2 className="type-display">Clone to Duo Template</h2>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                Generate a review-first Duo SSO SAML draft from staged competitor documentation, keep unresolved values explicit, and review screenshots in section context.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={generateDraft}
              disabled={!stagedItems.length || loading}
              className="rounded-lg bg-sky-600 px-3 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              {busyAction === "generate" ? "Generating..." : "Generate Review Draft"}
            </button>
            <button
              type="button"
              onClick={saveDraft}
              disabled={!draft || busyAction === "save"}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 disabled:cursor-not-allowed disabled:text-slate-400 dark:border-slate-700 dark:text-slate-200"
            >
              <Save size={14} />
              {busyAction === "save" ? "Saving..." : "Save Draft"}
            </button>
            <button
              type="button"
              onClick={handleDeleteDraft}
              disabled={!draft || busyAction === "delete"}
              className="inline-flex items-center gap-2 rounded-lg border border-rose-300 px-3 py-2 text-sm font-semibold text-rose-700 disabled:cursor-not-allowed disabled:text-slate-400 dark:border-rose-700/70 dark:text-rose-300"
            >
              <Trash2 size={14} />
              {busyAction === "delete" ? "Deleting..." : "Delete Draft"}
            </button>
            <button
              type="button"
              onClick={handleExport}
              disabled={!draft || !draft.summary?.readyToExport || busyAction === "export"}
              className="inline-flex items-center gap-2 rounded-lg border border-emerald-300 px-3 py-2 text-sm font-semibold text-emerald-700 disabled:cursor-not-allowed disabled:text-slate-400 dark:border-emerald-700/70 dark:text-emerald-300"
            >
              <Download size={14} />
              {busyAction === "export" ? "Exporting..." : "Export Markdown + Sidecar"}
            </button>
            <button
              type="button"
              onClick={onClearStaged}
              disabled={!stagedItems.length}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 disabled:cursor-not-allowed disabled:text-slate-400 dark:border-slate-700 dark:text-slate-200"
            >
              <Trash2 size={14} />
              Clear Source Set
            </button>
          </div>
        </div>
        {error ? (
          <p role="alert" className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-700/50 dark:bg-rose-950/40 dark:text-rose-200">
            {error}
          </p>
        ) : null}
        {draft?.summary ? (
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <SummaryCard label="Blueprint" value={draft.blueprintFamily} />
            <SummaryCard label="Unresolved Fields" value={String(draft.summary.unresolvedFieldCount)} tone={draft.summary.unresolvedFieldCount ? "amber" : "emerald"} />
            <SummaryCard label="Blocking Issues" value={String(draft.summary.blockingIssueCount)} tone={draft.summary.blockingIssueCount ? "rose" : "emerald"} />
          </div>
        ) : null}
      </section>

      <div className="grid gap-4 xl:grid-cols-[1.1fr_1.4fr_1.2fr]">
        <section className="glass-surface space-y-4 p-4">
          <PanelHeader icon={ClipboardList} title="Source Set" subtitle="Staged competitor pages drive the transform." />
          {!stagedItems.length ? (
            <EmptyPanel text="Use Stage Clone on competitor result cards to build the source set." />
          ) : (
            <div className="space-y-3">
              {stagedItems.map((item) => (
                <article key={item.id} className="rounded-xl border border-white/40 bg-white/40 p-3 dark:border-slate-800 dark:bg-slate-950/40">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{item.title}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">{item.vendor || "Competitor"}</p>
                      {item.url ? (
                        <a href={item.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-cyan-700 hover:underline dark:text-cyan-300">
                          <ExternalLink size={12} />
                          Open source page
                        </a>
                      ) : null}
                    </div>
                    <button
                      type="button"
                      onClick={() => onRemove(item.id)}
                      className="rounded-lg border border-rose-300 px-2 py-1 text-xs font-semibold text-rose-700 dark:border-rose-800 dark:text-rose-300"
                    >
                      Remove
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}

          <PanelHeader icon={FileWarning} title="Issues" subtitle="Open problems block trustworthy output." />
          {!deferredDraft?.issues?.length ? (
            <EmptyPanel text="Generate a draft to review issues." />
          ) : (
            <div className="space-y-2">
              {currentIssues.map((issue) => (
                <button
                  key={issue.id}
                  type="button"
                  onClick={() => setSelectedIssueId(issue.id)}
                  className={`w-full rounded-xl border px-3 py-3 text-left ${selectedIssueId === issue.id ? "border-sky-400 bg-sky-50 dark:border-sky-700 dark:bg-sky-950/40" : "border-white/40 bg-white/35 dark:border-slate-800 dark:bg-slate-950/30"}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{issue.summary}</p>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{issue.type.replace(/_/g, " ")} · {issue.severity}</p>
                    </div>
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        resolveIssue(issue.id);
                      }}
                      className="inline-flex items-center gap-1 rounded-lg border border-emerald-300 px-2 py-1 text-xs font-semibold text-emerald-700 dark:border-emerald-700/70 dark:text-emerald-300"
                    >
                      <CheckCircle2 size={12} />
                      Resolve
                    </button>
                  </div>
                  <p className="mt-2 text-xs text-slate-600 dark:text-slate-300">{issue.recommendation}</p>
                </button>
              ))}
            </div>
          )}
        </section>

        <section className="glass-surface space-y-4 p-4">
          <PanelHeader icon={ClipboardList} title="Draft Sections" subtitle="Review generated Duo sections in target order." />
          {!deferredDraft?.sections?.length ? (
            <EmptyPanel text={loading ? "Generating draft sections..." : "Generate a draft to review section output."} />
          ) : (
            <>
              <div className="flex flex-wrap gap-2">
                {deferredDraft.sections
                  .slice()
                  .sort((left, right) => left.order - right.order)
                  .map((section) => (
                    <button
                      key={section.sectionId}
                      type="button"
                      onClick={() => setSelectedSectionId(section.sectionId)}
                      aria-label={`Open section ${section.title}`}
                      className={`rounded-full border px-3 py-1 text-xs font-semibold ${selectedSectionId === section.sectionId ? "border-sky-400 bg-sky-50 text-sky-700 dark:border-sky-700 dark:bg-sky-950/40 dark:text-sky-200" : "border-slate-300 text-slate-600 dark:border-slate-700 dark:text-slate-300"}`}
                    >
                      {section.title}
                    </button>
                  ))}
              </div>
              {currentSection ? (
                <article className="space-y-3 rounded-xl border border-white/40 bg-white/35 p-4 dark:border-slate-800 dark:bg-slate-950/30">
                  <div>
                    <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{currentSection.title}</p>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{currentSection.unresolvedFieldIds.length} unresolved field(s) · {currentSection.screenshotAttachmentIds.length} screenshot(s)</p>
                  </div>
                  <pre className="max-h-[28rem] overflow-auto whitespace-pre-wrap rounded-lg border border-white/40 bg-white/55 p-3 text-xs text-slate-700 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-200">{currentSection.markdown}</pre>
                </article>
              ) : null}

              <PanelHeader icon={ClipboardList} title="Evidence" subtitle="Only evidence attached to the current section is shown here." />
              {!currentEvidence.length ? (
                <EmptyPanel text="No evidence blocks are attached to the selected section yet." />
              ) : (
                <div className="space-y-2">
                  {currentEvidence.map((block) => (
                    <article key={block.id} className="rounded-xl border border-white/40 bg-white/35 p-3 dark:border-slate-800 dark:bg-slate-950/30">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{block.type.replace(/_/g, " ")}</p>
                      <p className="mt-2 text-sm text-slate-700 dark:text-slate-200">{block.text || block.citationLabel}</p>
                      <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">{block.citationLabel}</p>
                    </article>
                  ))}
                </div>
              )}
            </>
          )}
        </section>

        <section className="glass-surface space-y-4 p-4">
          <PanelHeader icon={FileWarning} title="Required Fields" subtitle="Resolve or explicitly keep unresolved before export." />
          {!currentFields.length ? (
            <EmptyPanel text="Select a section with mapped SAML fields to review them here." />
          ) : (
            <div className="space-y-3">
              {currentFields.map((field) => (
                <article
                  key={field.fieldId}
                  className={`rounded-xl border p-3 ${selectedFieldId === field.fieldId ? "border-sky-400 bg-sky-50 dark:border-sky-700 dark:bg-sky-950/40" : "border-white/40 bg-white/35 dark:border-slate-800 dark:bg-slate-950/30"}`}
                >
                  <button type="button" onClick={() => setSelectedFieldId(field.fieldId)} className="w-full text-left">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{field.label}</p>
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{field.group.replace(/_/g, " ")} · {field.status.replace(/_/g, " ")}</p>
                      </div>
                      <StatusPill status={field.status} />
                    </div>
                  </button>
                  {field.status === "resolved" ? (
                    <p className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700 dark:border-emerald-800/60 dark:bg-emerald-950/40 dark:text-emerald-200">{formatFieldValue(field.value)}</p>
                  ) : (
                    <div className="mt-3 space-y-3">
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200">
                        Reviewer Fill-In
                        <input
                          type="text"
                          aria-label={`Fill ${field.label}`}
                          value={field.unresolved?.reviewerEnteredValue || ""}
                          onChange={(event) => updateFieldValue(field.fieldId, event.target.value)}
                          placeholder={field.unresolved?.fillPrompt || field.expectedFormatHint}
                          className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                        />
                      </label>
                      {field.unresolved?.recommendedValueOrPattern ? (
                        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-700/50 dark:bg-amber-950/40 dark:text-amber-200">
                          <p className="font-semibold">Recommendation</p>
                          <p className="mt-1">{field.unresolved.recommendedValueOrPattern}</p>
                        </div>
                      ) : null}
                      {field.unresolved?.rationale ? (
                        <p className="text-xs text-slate-600 dark:text-slate-300">{field.unresolved.rationale}</p>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => acceptFieldOverride(field.fieldId)}
                        disabled={!field.unresolved?.reviewerEnteredValue}
                        aria-label={`Accept override for ${field.label}`}
                        className="inline-flex items-center gap-2 rounded-lg border border-emerald-300 px-3 py-2 text-xs font-semibold text-emerald-700 disabled:cursor-not-allowed disabled:text-slate-400 dark:border-emerald-700/70 dark:text-emerald-300"
                      >
                        <CheckCircle2 size={12} />
                        Accept Override
                      </button>
                    </div>
                  )}
                </article>
              ))}
            </div>
          )}

          <PanelHeader icon={ClipboardList} title="Section Screenshots" subtitle="Screenshots stay attached to the current section only." />
          {!currentScreenshots.length ? (
            <EmptyPanel text="No screenshots were attached to the selected section." />
          ) : (
            <div className="space-y-3">
              {currentScreenshots.map((attachment) => (
                <article key={attachment.id} className="rounded-xl border border-white/40 bg-white/35 p-3 dark:border-slate-800 dark:bg-slate-950/30">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{attachment.attachmentReason.replace(/_/g, " ")}</p>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{attachment.reviewState.replace(/_/g, " ")}</p>
                    </div>
                    <select
                      aria-label={`Screenshot review state ${attachment.attachmentReason.replace(/_/g, " ")}`}
                      value={attachment.reviewState}
                      onChange={(event) => updateScreenshotReviewState(attachment.id, event.target.value)}
                      className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                    >
                      <option value="pending">Pending</option>
                      <option value="keep_internal">Keep Internal</option>
                      <option value="replace_later">Replace Later</option>
                      <option value="exclude">Exclude</option>
                    </select>
                  </div>
                  <p className="mt-2 text-xs text-slate-600 dark:text-slate-300">Evidence ID: {attachment.evidenceId}</p>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function SummaryCard({ label, value, tone = "slate" }) {
  const tones = {
    slate: "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-800 dark:bg-slate-950/40 dark:text-slate-200",
    amber: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-700/50 dark:bg-amber-950/40 dark:text-amber-200",
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-700/50 dark:bg-emerald-950/40 dark:text-emerald-200",
    rose: "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-700/50 dark:bg-rose-950/40 dark:text-rose-200",
  };
  return (
    <div className={`rounded-xl border px-3 py-3 ${tones[tone] || tones.slate}`}>
      <p className="text-[11px] font-semibold uppercase tracking-wide">{label}</p>
      <p className="mt-1 text-lg font-semibold">{value}</p>
    </div>
  );
}

function PanelHeader({ icon: Icon, title, subtitle }) {
  return (
    <div>
      <div className="inline-flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
        <Icon size={14} />
        {title}
      </div>
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{subtitle}</p>
    </div>
  );
}

function EmptyPanel({ text }) {
  return <div className="rounded-xl border border-dashed border-slate-300 px-4 py-6 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">{text}</div>;
}

function StatusPill({ status }) {
  const tone = status === "resolved"
    ? "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-700/50 dark:bg-emerald-950/40 dark:text-emerald-200"
    : status === "unresolved_ambiguous"
      ? "border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-700/50 dark:bg-amber-950/40 dark:text-amber-200"
      : "border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-700/50 dark:bg-rose-950/40 dark:text-rose-200";
  return <span className={`rounded-full border px-2 py-1 text-[11px] font-semibold ${tone}`}>{status.replace(/_/g, " ")}</span>;
}

function formatFieldValue(value) {
  if (Array.isArray(value)) return value.join(", ");
  return String(value || "");
}

function downloadText(fileName, content, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}