import { saveReport } from "./local-store";
import { playUploadSuccess } from "./sound";
import type { Report } from "./types";

export type QueueEntry = {
  localId: string;
  label: string;
  state: "uploading" | "error";
  detail: string;
};

const entries = new Map<string, QueueEntry>();
const listeners = new Set<() => void>();
const running = new Set<string>();

function notify() {
  listeners.forEach((fn) => fn());
}

export function subscribeQueue(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function queueSnapshot() {
  return new Map(entries);
}

export function queueEntry(localId: string) {
  return entries.get(localId);
}

/**
 * Saves the report on the phone and uploads it to Google Drive in the background,
 * so the officer can immediately go back to the dashboard and start a new entry.
 */
export function enqueueUpload(report: Report) {
  if (running.has(report.localId)) return;
  running.add(report.localId);
  entries.set(report.localId, {
    localId: report.localId,
    label: `${report.cpclNo} - ${report.cpclName}`,
    state: "uploading",
    detail: "Mengirim...",
  });
  notify();

  void (async () => {
    try {
      await saveReport({ ...report, status: "pending" });
      notify();
      const { uploadReport } = await import("./upload");
      await uploadReport(report, (done, total) => {
        const cur = entries.get(report.localId);
        if (cur) entries.set(report.localId, { ...cur, detail: `Mengirim photo ${done}/${total}...` });
        notify();
      });
      entries.delete(report.localId);
      playUploadSuccess();
    } catch (e) {
      entries.set(report.localId, {
        localId: report.localId,
        label: `${report.cpclNo} - ${report.cpclName}`,
        state: "error",
        detail: e instanceof Error ? e.message : "jaringan bermasalah",
      });
    } finally {
      running.delete(report.localId);
      notify();
    }
  })();
}
