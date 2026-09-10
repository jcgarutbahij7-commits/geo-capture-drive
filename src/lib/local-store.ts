import { get, set } from "idb-keyval";
import type { Profile, Report } from "./types";

const PROFILE_KEY = "petugas-profile";
const REPORTS_KEY = "laporan-lapangan-reports";

export async function loadProfile(): Promise<Profile | null> {
  return (await get<Profile>(PROFILE_KEY)) ?? null;
}

export async function saveProfile(profile: Profile) {
  await set(PROFILE_KEY, profile);
}

export async function loadReports(): Promise<Report[]> {
  return (await get<Report[]>(REPORTS_KEY)) ?? [];
}

export async function saveReport(report: Report) {
  const all = await loadReports();
  const idx = all.findIndex((r) => r.localId === report.localId);
  if (idx >= 0) all[idx] = report;
  else all.unshift(report);
  await set(REPORTS_KEY, all);
  return all;
}

export function newLocalId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
