import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { loadProfile, loadReports, saveProfile } from "@/lib/local-store";
import { mapsUrl, type Profile, type Report } from "@/lib/types";
import { uploadReport } from "@/lib/upload";
import { driveStatus, verifyPassword } from "@/lib/owner.functions";
import { playUploadSuccess } from "@/lib/sound";

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

function statusChip(r: Report) {
  if (r.status === "sent") return <span className="chip-sent">TERKIRIM</span>;
  if (r.status === "pending") return <span className="chip-pending">PENDING</span>;
  return <span className="chip-draft">TERSIMPAN</span>;
}

function Dashboard() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [editing, setEditing] = useState(false);
  const [reports, setReports] = useState<Report[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [setupOpen, setSetupOpen] = useState(false);
  const [setupPass, setSetupPass] = useState("");
  const [setup, setSetup] = useState<{
    serviceAccountConfigured: boolean;
    serviceAccountEmail: string | null;
    rootFolderConfigured: boolean;
  } | null>(null);

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
  }, [refresh]);

  async function send(report: Report) {
    setBusy(report.localId);
    setMessage(null);
    try {
      await uploadReport(report, (done, total) =>
        setMessage(`Mengirim photo ${done}/${total} untuk ${report.cpclName}...`),
      );
      playUploadSuccess();
      setMessage(`Data ${report.cpclNo} - ${report.cpclName} berhasil terkirim ke Google Drive.`);
    } catch (e) {
      setMessage(
        `Gagal mengirim ${report.cpclNo}: ${e instanceof Error ? e.message : "jaringan bermasalah"}. Draft tetap aman di handphone.`,
      );
    } finally {
      setBusy(null);
      await refresh();
    }
  }

  async function sendAll() {
    const pending = reports.filter((r) => r.status !== "sent");
    for (const r of pending) await send(r);
  }

  async function openSetup() {
    const { ok } = await verifyPassword({ data: { password: setupPass } });
    if (!ok) {
      setMessage("Password setup salah.");
      return;
    }
    setSetup(await driveStatus({ data: { password: setupPass } }));
    setSetupOpen(true);
  }

  const pendingCount = reports.filter((r) => r.status !== "sent").length;

  return (
    <main className="app-shell">
      <div className="hero-bar">
        <p className="text-xs font-semibold tracking-widest uppercase opacity-80">
          Laporan Lapangan
        </p>
        <h1 className="mt-1 text-2xl font-bold">{profile?.company || "DASHBOARD PETUGAS"}</h1>
        <p className="mt-1 text-sm opacity-90">
          {profile ? `${profile.officerName} - ${profile.officerPhone}` : "Lengkapi data petugas"}
        </p>
      </div>

      {editing || !profile ? (
        <ProfileForm
          initial={profile}
          onSaved={async (p) => {
            await saveProfile(p);
            setProfile(p);
            setEditing(false);
          }}
        />
      ) : (
        <div className="card flex items-center justify-between">
          <div>
            <p className="label">Petugas</p>
            <p className="font-semibold">{profile.officerName}</p>
            <p className="text-sm text-muted-foreground">{profile.officerPhone}</p>
          </div>
          <button className="btn-soft w-auto px-4 py-2 text-sm" onClick={() => setEditing(true)}>
            Edit
          </button>
        </div>
      )}

      {profile && !editing && (
        <div className="mt-4 grid gap-3">
          <Link to="/form" className="btn-primary">
            + ISIAN BARU
          </Link>
          <button className="btn-accent" onClick={sendAll} disabled={busy !== null || !pendingCount}>
            KIRIM SEMUA ({pendingCount})
          </button>
        </div>
      )}

      {message && (
        <p className="mt-4 rounded-xl bg-secondary px-4 py-3 text-sm text-secondary-foreground">
          {message}
        </p>
      )}

      <h2 className="mt-6 mb-2 text-lg font-bold">Status Pengiriman</h2>
      {reports.length === 0 ? (
        <p className="text-sm text-muted-foreground">Belum ada data.</p>
      ) : (
        <ul className="grid gap-3">
          {reports.map((r) => (
            <li key={r.localId} className="card">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-bold">
                    {r.cpclNo} - {r.cpclName}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {r.village} - {new Date(r.savedAt).toLocaleString("id-ID")}
                  </p>
                </div>
                {statusChip(r)}
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
              {r.status !== "sent" && (
                <button
                  className="btn-outline mt-3"
                  onClick={() => void send(r)}
                  disabled={busy !== null}
                >
                  {busy === r.localId ? "MENGIRIM..." : "KIRIM ULANG"}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      <div className="mt-8 card">
        <h2 className="text-base font-bold">Setup Google Drive</h2>
        {setupOpen && setup ? (
          <div className="mt-2 grid gap-2 text-sm">
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
            <button className="btn-soft" onClick={() => setSetupOpen(false)}>
              Sembunyikan
            </button>
          </div>
        ) : (
          <div className="mt-2 grid gap-2">
            <input
              className="field"
              type="password"
              placeholder="Password setup"
              value={setupPass}
              onChange={(e) => setSetupPass(e.target.value)}
            />
            <button className="btn-soft" onClick={() => void openSetup()}>
              Buka Setup
            </button>
          </div>
        )}
      </div>

      <Link to="/owner" className="mt-4 block text-center text-sm font-semibold text-primary">
        Dashboard Owner
      </Link>
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
        <label className="label">Nomor Handphone Petugas</label>
        <input
          className="field"
          inputMode="numeric"
          pattern="[0-9]*"
          value={phone}
          onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
        />
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
