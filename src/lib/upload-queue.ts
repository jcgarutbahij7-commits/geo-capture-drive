import { loadReports, saveReport } from "./local-store";
import { playUploadSuccess } from "./sound";
import type { Report } from "./types";

export type QueueEntry = {
  localId: string;
  label: string;
  state: "uploading" | "error";
  detail: string;
  attempts: number;
};

const MAX_ATTEMPTS = 3;

const entries = new Map<string, QueueEntry>();
const listeners = new Set<() => void>();
const running = new Set<string>();
const reports = new Map<string, Report>();

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
 * Saves the report on the phone and sends it to the company in the background,
 * so the officer can immediately go back to the dashboard and start a new entry.
 */
export function enqueueUpload(report: Report, attempt = 1) {
  if (running.has(report.localId)) return;
  running.add(report.localId);
  reports.set(report.localId, report);
  entries.set(report.localId, {
    localId: report.localId,
    label: `${report.cpclNo} - ${report.cpclName}`,
    state: "uploading",
    detail: "Mengirim ke Perusahaan...",
    attempts: attempt,
  });
  notify();

  void (async () => {
    try {
      await saveReport({ ...report, status: "pending" });
      notify();
      const { uploadReport } = await import("./upload");
      await uploadReport(report, (done, total) => {
        const cur = entries.get(report.localId);
        if (cur)
          entries.set(report.localId, {
            ...cur,
            detail: `Mengirim ke Perusahaan photo ${done}/${total}...`,
          });
        notify();
      });
      entries.delete(report.localId);
      reports.delete(report.localId);
      playUploadSuccess();
    } catch (e) {
      entries.set(report.localId, {
        localId: report.localId,
        label: `${report.cpclNo} - ${report.cpclName}`,
        state: "error",
        detail:
          attempt >= MAX_ATTEMPTS
            ? "Gagal Kirim - Tap untuk Kirim Ulang"
            : `Gagal, mencoba lagi otomatis (${attempt}/${MAX_ATTEMPTS})`,
        attempts: attempt,
      });
      if (attempt < MAX_ATTEMPTS) {
        setTimeout(() => {
          running.delete(report.localId);
          enqueueUpload(report, attempt + 1);
        }, 5000);
      }
      void e;
    } finally {
      if (!running.has(report.localId) || entries.get(report.localId)?.state !== "uploading")
        running.delete(report.localId);
      notify();
    }
  })();
}

let started = false;

/** Background sender: every 10 seconds, retries anything still not delivered. */
export function startBackgroundSender() {
  if (started || typeof window === "undefined") return;
  started = true;

  const tick = async () => {
    if (!navigator.onLine) return;
    for (const entry of [...entries.values()]) {
      if (entry.state === "error" && entry.attempts >= MAX_ATTEMPTS) continue;
    }
    const all = await loadReports();
    for (const r of all) {
      if (r.status === "sent") continue;
      const entry = entries.get(r.localId);
      if (entry) continue;
      if (r.status === "pending") enqueueUpload(r, 1);
    }
  };

  void tick();
  window.setInterval(() => void tick(), 10000);
  window.addEventListener("online", () => void tick());
}

export function retryUpload(report: Report) {
  running.delete(report.localId);
  entries.delete(report.localId);
  enqueueUpload(report, 1);
}
