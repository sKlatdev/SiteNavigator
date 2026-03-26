import { useEffect, useMemo, useState } from "react";

import {
  apiDeleteCloneDuoDraft,
  apiExportCloneDuoDraft,
  apiGetCloneDuoDraft,
  apiSaveCloneDuoDraft,
  apiTransformCloneDuoDraft,
} from "../../../lib/api";
import { STORAGE_KEYS } from "../constants";
import { applyFieldOverride, markIssueResolved } from "./cloneDuoReviewState";

function isBlankValue(value) {
  if (Array.isArray(value)) return value.length === 0;
  return !String(value || "").trim();
}

export function useCloneDuoDraft(stagedItems) {
  const [draft, setDraft] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [busyAction, setBusyAction] = useState("");
  const [selectedSectionId, setSelectedSectionId] = useState("");
  const [selectedFieldId, setSelectedFieldId] = useState("");
  const [selectedIssueId, setSelectedIssueId] = useState("");

  function resetDraftState() {
    setDraft(null);
    setSelectedSectionId("");
    setSelectedFieldId("");
    setSelectedIssueId("");
    localStorage.removeItem(STORAGE_KEYS.cloneDuoDraftId);
  }

  useEffect(() => {
    const draftId = localStorage.getItem(STORAGE_KEYS.cloneDuoDraftId);
    if (!draftId) return;

    let cancelled = false;
    setLoading(true);
    apiGetCloneDuoDraft(JSON.parse(draftId))
      .then((response) => {
        if (cancelled || !response?.draft) return;
        setDraft(response.draft);
        setSelectedSectionId(response.draft.sections?.[0]?.sectionId || "");
        setSelectedFieldId(response.draft.fields?.[0]?.fieldId || "");
        setSelectedIssueId(response.draft.issues?.[0]?.id || "");
      })
      .catch(() => {
        resetDraftState();
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const currentSection = useMemo(
    () => draft?.sections?.find((section) => section.sectionId === selectedSectionId) || draft?.sections?.[0] || null,
    [draft, selectedSectionId]
  );

  const currentFields = useMemo(
    () => (draft?.fields || []).filter((field) => field.targetSectionId === currentSection?.sectionId),
    [draft, currentSection]
  );

  const currentScreenshots = useMemo(
    () => (draft?.screenshotAttachments || []).filter((attachment) => attachment.sectionId === currentSection?.sectionId),
    [draft, currentSection]
  );

  const currentIssues = useMemo(
    () => (draft?.issues || []).filter((issue) => !currentSection || issue.sectionId === currentSection.sectionId),
    [draft, currentSection]
  );

  const currentEvidence = useMemo(() => {
    const evidenceById = new Map((draft?.sourceBundle?.evidence || []).map((block) => [block.id, block]));
    return (currentSection?.evidenceIds || []).map((id) => evidenceById.get(id)).filter(Boolean);
  }, [draft, currentSection]);

  async function generateDraft() {
    if (!stagedItems.length) return;
    setLoading(true);
    setBusyAction("generate");
    setError("");
    try {
      const response = await apiTransformCloneDuoDraft({ sourceItems: stagedItems });
      setDraft(response.draft);
      setSelectedSectionId(response.draft.sections?.[0]?.sectionId || "");
      setSelectedFieldId(response.draft.fields?.[0]?.fieldId || "");
      setSelectedIssueId(response.draft.issues?.[0]?.id || "");
      localStorage.setItem(STORAGE_KEYS.cloneDuoDraftId, JSON.stringify(response.draft.draftId));
    } catch (nextError) {
      setError(nextError?.message || "Failed to generate draft.");
    } finally {
      setBusyAction("");
      setLoading(false);
    }
  }

  async function saveDraft() {
    if (!draft) return;
    setBusyAction("save");
    setError("");
    try {
      const response = await apiSaveCloneDuoDraft(draft);
      setDraft(response.draft);
      localStorage.setItem(STORAGE_KEYS.cloneDuoDraftId, JSON.stringify(response.draft.draftId));
    } catch (nextError) {
      setError(nextError?.message || "Failed to save draft.");
    } finally {
      setBusyAction("");
    }
  }

  async function exportDraft() {
    if (!draft) return null;
    setBusyAction("export");
    setError("");
    try {
      return await apiExportCloneDuoDraft(draft);
    } catch (nextError) {
      setError(nextError?.message || "Failed to export draft.");
      return null;
    } finally {
      setBusyAction("");
    }
  }

  async function deleteDraft() {
    if (!draft?.draftId) {
      resetDraftState();
      return true;
    }

    setBusyAction("delete");
    setError("");
    try {
      await apiDeleteCloneDuoDraft(draft.draftId);
      resetDraftState();
      return true;
    } catch (nextError) {
      setError(nextError?.message || "Failed to delete draft.");
      return false;
    } finally {
      setBusyAction("");
    }
  }

  function updateFieldValue(fieldId, reviewerEnteredValue) {
    setDraft((current) => {
      if (!current) return current;
      return {
        ...current,
        fields: current.fields.map((field) =>
          field.fieldId === fieldId
            ? {
                ...field,
                unresolved: field.unresolved
                  ? {
                      ...field.unresolved,
                      reviewerEnteredValue,
                    }
                  : field.unresolved,
              }
            : field
        ),
      };
    });
  }

  function acceptFieldOverride(fieldId) {
    setDraft((current) => {
      if (!current) return current;
      const fields = current.fields.map((field) => {
        if (field.fieldId !== fieldId) return field;
        const overrideValue = field.unresolved?.reviewerEnteredValue;
        if (isBlankValue(overrideValue)) return field;
        return {
          ...field,
          status: "resolved",
          value: overrideValue,
          unresolved: {
            ...field.unresolved,
            reviewerDecisionState: "accepted_override",
          },
        };
      });
      return applyFieldOverride(current, fieldId);
    });
  }

  function updateScreenshotReviewState(attachmentId, reviewState) {
    setDraft((current) => {
      if (!current) return current;
      return {
        ...current,
        screenshotAttachments: current.screenshotAttachments.map((attachment) =>
          attachment.id === attachmentId ? { ...attachment, reviewState } : attachment
        ),
      };
    });
  }

  function resolveIssue(issueId) {
    setDraft((current) => {
      if (!current) return current;
      return markIssueResolved(current, issueId);
    });
  }

  return {
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
  };
}