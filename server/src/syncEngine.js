import {
  getSyncProgress as getLegacySyncProgress,
  runIncrementalSync as runLegacyIncrementalSync,
} from "./crawler.js";
import {
  canUseKetchSync,
  getSyncProgress as getKetchSyncProgress,
  runKetchIncrementalSync,
} from "./ketchSync.js";

function selectedEngine() {
  const requested = String(process.env.SITENAVIGATOR_SYNC_ENGINE || "auto").trim().toLowerCase();
  if (requested === "legacy") return "legacy";
  if (requested === "ketch") return "ketch";
  return canUseKetchSync() ? "ketch" : "legacy";
}

export function getSelectedSyncEngine() {
  return selectedEngine();
}

export function getSyncProgress() {
  return selectedEngine() === "ketch" ? getKetchSyncProgress() : getLegacySyncProgress();
}

export async function runIncrementalSync() {
  return selectedEngine() === "ketch" ? runKetchIncrementalSync() : runLegacyIncrementalSync();
}