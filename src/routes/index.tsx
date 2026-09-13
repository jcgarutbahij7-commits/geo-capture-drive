import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { loadProfile, loadReports, saveProfile } from "@/lib/local-store";
import { isValidWa, mapsUrl, waLink, type Profile, type Report } from "@/lib/types";
import { driveStatus, getOwnerWa, verifyPassword } from "@/lib/owner.functions";
import {
  enqueueUpload,
  queueSnapshot,
  retryUpload,
  startBackgroundSender,
  subscribeQueue,
  type QueueEntry,
} from "@/lib/upload-queue";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Laporan Lapangan - Kirim Photo & Data ke Google Drive" },
      {
        name: "description",
        content:
          "Aplikasi petugas lapangan untuk mengirim photo dan data CPCL langsung ke Google Drive, dengan draft offline dan status pengiriman.",
      },
      { property: "og:title", content: "Laporan Lapangan - Petugas" },
      {
        property: "og:description",
        content: "Kirim photo dan data CPCL ke Google Drive langsung dari handphone.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Dashboard,
});

const HIDDEN_KEY = "hidden-report-ids";
const DAY_MS = 24 * 60 * 60 * 1000;

function statusChip(r: Report, entry?: QueueEntry) {
  if (entry?.state === "uploading")
    return <span className="chip-pending">MENGIRIM KE PERUSAHAAN...</span>;
  if (entry?.state === "error")
    return <span className="chip-pending bg-destructive text-destructive-foreground">GAGAL ✗</span>;
  if (r.status === "sent") return <span className="chip-sent">TERKIRIM ✓</span>;
  if (r.status === "pending") return <span className="chip-pending">MENUNGGU</span>;
  return <span className="chip-draft">TERSIMPAN</span>;
}

function isActiveReport(r: Report, entry?: QueueEntry) {
  if (entry?.state === "error") return true;
  if (r.status !== "sent") return true;
  return false;
}

function isAutoHidden(r: Report) {
  if (r.status !== "sent") return false;
  return Date.now() - new Date(r.savedAt).getTime() > DAY_MS;
}

function Dashboard() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [editing, setEditing] = useState(false);
  const [reports, setReports] = useState<Report[]>([]);
  const [queue, setQueue] = useState<Map<string, QueueEntry>>(new Map());
  const [message, setMessage] = useState<string | null>(null);
  const [setupOpen, setSetupOpen] = useState(false);
  const [setupPass, setSetupPass] = useState("");
  const [setup, setSetup] = useState<{
    serviceAccountConfigured: boolean;
    serviceAccountEmail: string | null;
    rootFolderConfigured: boolean;
  } | null>(null);

  const [ownerWa, setOwnerWa] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    void getOwnerWa()
      .then((r) => setOwnerWa(r.ownerWa))
      .catch(() => setOwnerWa(null));
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(HIDDEN_KEY);
      if (raw) setHiddenIds(new Set(JSON.parse(raw)));
    } catch {
      /* ignore */
    }
  }, []);

  const refresh = useCallback(async () => {
    setReports(await loadReports());
  }, []);

  useEffect(() => {
    void (async () => {
      const p = await loadProfile();
      setProfile(p);
      if (!p) setEditing(true);
      await refresh();
    })();
    setQueue(queueSnapshot());
    startBackgroundSender();
    return subscribeQueue(() => {
      setQueue(queueSnapshot());
      void refresh();
    });
  }, [refresh]);

  const sortedReports = useMemo(() => {
    const list = [...reports];
    list.sort((a, b) => {
      const aActive = isActiveReport(a, queue.get(a.localId));
      const bActive = isActiveReport(b, queue.get(b.localId));
      if (aActive && !bActive) return -1;
      if (!aActive && bActive) return 1;
      return new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime();
    });
    return list;
  }, [reports, queue]);

  const visibleReports = useMemo(() => {
    if (showAll) return sortedReports;
    return sortedReports
      .filter((r) => {
        if (hiddenIds.has(r.localId)) return false;
        if (isAutoHidden(r)) return false;
        return true;
      })
      .slice(0, 5);
  }, [sortedReports, hiddenIds, showAll]);

  function toggleArchive(localId: string) {
    const next = new Set(hiddenIds);
    if (next.has(localId)) next.delete(localId);
    else next.add(localId);
    setHiddenIds(next);
    try {
      localStorage.setItem(HIDDEN_KEY, JSON.stringify([...next]));
    } catch {
      /* ignore */
    }
  }

  function send(report: Report) {
    setMessage("Laporan terkirim ke antrian");
    retryUpload(report);
    setTimeout(() => setMessage(null), 3000);
  }

  function sendAll() {
    setMessage("Laporan terkirim ke antrian");
    reports.filter((r) => r.status !== "sent").forEach((r) => enqueueUpload(r));
    setTimeout(() => setMessage(null), 3000);
  }

  async function openSetup() {
    const { ok } = await verifyPassword({ data: { password: setupPass } });
    if (!ok) {
      setMessage("Kode admin salah.");
      return;
    }
    setSetup(await driveStatus({ data: { password: setupPass } }));
    setSetupOpen(true);
  }

  const pendingCount = reports.filter((r) => r.status !== "sent").length;

  return (
    <main className="app-shell">
      <div className="hero-bar">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-xl font-bold">{profile?.company || "DASHBOARD PETUGAS"}</h1>
          <button
            className="shrink-0 rounded-full bg-white/20 px-3 py-1 text-xs font-bold"
            onClick={() => setEditing(true)}
          >
            Edit Profil
          </button>
        </div>
        <p className="mt-1 text-sm opacity-90">
          {profile ? `${profile.officerName} - ${profile.officerPhone}` : "Lengkapi data petugas"}
        </p>
        {ownerWa && (
          <a
            className="btn-send mt-3 w-auto px-4 py-2 text-sm"
            href={waLink(ownerWa, `Halo Pak, saya *${profile?.officerName ?? "PETUGAS"}*`)}
            target="_blank"
            rel="noreferrer"
          >
            💬 HUBUNGI ADMIN
          </a>
        )}
      </div>

      <div className="sticky-header">
        <h2 className="text-base font-bold">Dashboard Petugas</h2>
        <div className="mt-3 flex gap-3">
          <Link
            to="/form"
            className="flex-1 rounded-xl bg-[#16a34a] px-4 py-3 text-center font-bold text-white"
          >
            + ISIAN BARU
          </Link>
          <button
            className="flex-1 rounded-xl bg-green-300 px-4 py-3 font-bold text-green-900 disabled:opacity-60"
            onClick={sendAll}
            disabled={!profile || !pendingCount}
          >
            KIRIM KE PERUSAHAAN ({pendingCount})
          </button>
        </div>
      </div>

      {(editing || !profile) && (
        <ProfileForm
          initial={profile}
          onSaved={async (p) => {
            await saveProfile(p);
            setProfile(p);
            setEditing(false);
          }}
        />
      )}

      {message && (
        <p className="mt-4 rounded-xl bg-secondary px-4 py-3 text-sm text-secondary-foreground">
          {message}
        </p>
      )}

      <h2 className="section-title">Status Pengiriman</h2>
      {visibleReports.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {showAll ? "Belum ada riwayat." : "Belum ada data aktif."}
        </p>
      ) : (
        <ul className="grid gap-3">
          {visibleReports.map((r) => (
            <li key={r.localId} className="card">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-bold">
                    {r.cpclNo} - {r.cpclName}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {r.village} - {new Date(r.savedAt).toLocaleString("id-ID")}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  {statusChip(r, queue.get(r.localId))}
                  {r.status === "sent" && (
                    <button
                      className="btn-archive"
                      title={hiddenIds.has(r.localId) ? "Kembalikan" : "Arsipkan"}
                      onClick={() => toggleArchive(r.localId)}
                    >
                      {hiddenIds.has(r.localId) ? "↩️" : "🗄️"}
                    </button>
                  )}
                </div>
              </div>
              <p className="mt-2 text-sm">
                Pelimpahan: {r.pelimpahan === "YA" ? `YA - ${r.pelimpahanName}` : "BUKAN"}
              </p>
              <p className="text-sm">{r.address}</p>
              {r.latitude != null && (
                <a
                  className="text-sm font-semibold text-primary underline"
                  href={mapsUrl(r.latitude, r.longitude)}
                  target="_blank"
                  rel="noreferrer"
                >
                  {r.latitude.toFixed(6)}, {r.longitude?.toFixed(6)}
                </a>
              )}
              {queue.get(r.localId)?.state === "uploading" ? (
                <p className="mt-3 text-sm font-semibold text-primary">
                  {queue.get(r.localId)?.detail}
                </p>
              ) : (
                r.status !== "sent" && (
                  <>
                    {queue.get(r.localId)?.state === "error" && (
                      <p className="mt-2 text-sm text-destructive">
                        {queue.get(r.localId)?.detail}
                      </p>
                    )}
                    <button className="btn-send mt-3" onClick={() => send(r)}>
                      📤 KIRIM ULANG KE PERUSAHAAN
                    </button>
                  </>
                )
              )}
            </li>
          ))}
        </ul>
      )}

      {reports.length > 0 && (
        <button
          className="btn-outline-gray mt-4"
          onClick={() => setShowAll((s) => !s)}
        >
          {showAll ? "SEMBUNYIKAN RIWAYAT LAMA" : "🗄️ LIHAT SEMUA RIWAYAT"}
        </button>
      )}

      <Link to="/owner" className="mt-6 block text-center text-sm font-semibold text-primary">
        Dashboard Owner
      </Link>

      <div className="admin-section">
        <p className="mb-2 font-semibold">Pengaturan Admin</p>
        {setupOpen && setup ? (
          <div className="grid gap-2">
            <p>
              Folder utama: <b>Laporan Lapangan</b> (disinkronkan ke D:\Laporan Lapangan)
            </p>
            <p>
              Service Account: {setup.serviceAccountConfigured ? "Aktif" : "Belum diatur"}
              {setup.serviceAccountEmail ? ` - ${setup.serviceAccountEmail}` : ""}
            </p>
            <p>ID folder utama: {setup.rootFolderConfigured ? "Sudah diatur" : "Belum diatur"}</p>
            <p className="text-muted-foreground">
              Struktur folder: Nama Perusahaan &gt; Nama Desa &gt; [nomor cpcl] - [nama cpcl] - [nama
              pelimpahan]
            </p>
            <button className="btn-admin" onClick={() => setSetupOpen(false)}>
              Sembunyikan
            </button>
          </div>
        ) : (
          <div className="grid gap-2">
            <input
              className="field"
              style={{ fontSize: 14, paddingTop: 10, paddingBottom: 10 }}
              type="password"
              placeholder="Kode Admin"
              value={setupPass}
              onChange={(e) => setSetupPass(e.target.value)}
            />
            <button className="btn-admin" onClick={() => void openSetup()}>
              Masuk Admin
            </button>
          </div>
        )}
      </div>
    </main>
  );
}

function ProfileForm({
  initial,
  onSaved,
}: {
  initial: Profile | null;
  onSaved: (p: Profile) => void | Promise<void>;
}) {
  const [company, setCompany] = useState(initial?.company ?? "");
  const [name, setName] = useState(initial?.officerName ?? "");
  const [phone, setPhone] = useState(initial?.officerPhone ?? "");

  const valid = company.trim() && name.trim() && phone.trim();

  return (
    <div className="card grid gap-3">
      <h2 className="text-lg font-bold">Data Petugas</h2>
      <div>
        <label className="label">Nama Perusahaan</label>
        <input
          className="field uppercase"
          value={company}
          onChange={(e) => setCompany(e.target.value.toUpperCase())}
        />
      </div>
      <div>
        <label className="label">Nama Petugas</label>
        <input
          className="field uppercase"
          value={name}
          onChange={(e) => setName(e.target.value.toUpperCase())}
        />
      </div>
      <div>
        <label className="label">Nomor WA Petugas (08xxxxxxxxxx)</label>
        <input
          className="field"
          inputMode="numeric"
          pattern="[0-9]*"
          placeholder="08xxxxxxxxxx"
          value={phone}
          onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
        />
        {phone && !isValidWa(phone) && (
          <p className="mt-1 text-xs text-destructive">Format harus 08xxxxxxxxxx</p>
        )}
      </div>
      <button
        className="btn-primary"
        disabled={!valid}
        onClick={() =>
          void onSaved({
            company: company.trim(),
            officerName: name.trim(),
            officerPhone: phone.trim(),
          })
        }
      >
        SIMPAN DATA PETUGAS
      </button>
    </div>
  );
}
