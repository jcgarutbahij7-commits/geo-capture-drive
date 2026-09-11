import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  downloadExcel,
  getOwnerWa,
  listCompanies,
  listReports,
  setOwnerWa,
  type OwnerRow,
} from "@/lib/owner.functions";
import { announceOwnerData } from "@/lib/sound";
import { isValidWa, mapsUrl, waLink } from "@/lib/types";

export const Route = createFileRoute("/owner")({
  head: () => ({
    meta: [
      { title: "Dashboard Owner - Rekap Data Lapangan per Perusahaan" },
      {
        name: "description",
        content:
          "Pantau data CPCL yang masuk dari petugas lapangan per perusahaan, dengan notifikasi suara dan unduhan Excel.",
      },
      { property: "og:title", content: "Dashboard Owner - Laporan Lapangan" },
      {
        property: "og:description",
        content: "Rekap desa, jumlah CPCL, dan unduhan Excel per perusahaan.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: OwnerDashboard,
});

const SOUND_KEY = "owner-sound-on";
const NAME_KEY = "owner-company-name";

function OwnerDashboard() {
  const [password, setPassword] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [companies, setCompanies] = useState<string[]>([]);
  const [company, setCompany] = useState("");
  const [rows, setRows] = useState<OwnerRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const known = useRef<Set<string>>(new Set());

  // Settings (saved automatically in the phone/browser storage)
  const [soundOn, setSoundOn] = useState(true);
  const [companyName, setCompanyName] = useState("PERUSAHAAN");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [toast, setToast] = useState<string | null>(null);
  const soundRef = useRef(true);

  useEffect(() => {
    const s = localStorage.getItem(SOUND_KEY);
    if (s !== null) setSoundOn(s === "1");
    const n = localStorage.getItem(NAME_KEY);
    if (n) setCompanyName(n);
  }, []);

  useEffect(() => {
    soundRef.current = soundOn;
    localStorage.setItem(SOUND_KEY, soundOn ? "1" : "0");
  }, [soundOn]);

  useEffect(() => {
    localStorage.setItem(NAME_KEY, companyName);
  }, [companyName]);

  const nameRef = useRef(companyName);
  useEffect(() => {
    nameRef.current = companyName;
  }, [companyName]);

  async function unlock() {
    setError(null);
    try {
      const list = await listCompanies({ data: { password } });
      setCompanies(list);
      setUnlocked(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Password salah");
    }
  }

  useEffect(() => {
    if (!unlocked || !company) return;
    let stop = false;
    const tick = async () => {
      try {
        const data = await listReports({ data: { password, company } });
        if (stop) return;
        const fresh = data.filter((r) => !known.current.has(r.id));
        const first = known.current.size === 0;
        data.forEach((r) => known.current.add(r.id));
        setRows(data);
        if (!first && fresh.length > 0) {
          const officer = fresh[0]?.officerName ?? "PETUGAS";
          setUnread((u) => u + fresh.length);
          setToast(`Data baru dari ${officer}`);
          setTimeout(() => setToast(null), 3000);
          if (soundRef.current) announceOwnerData(nameRef.current || "PERUSAHAAN", officer);
        }
      } catch (e) {
        if (!stop) setError(e instanceof Error ? e.message : "Gagal memuat data");
      }
    };
    known.current = new Set();
    void tick();
    const id = setInterval(() => void tick(), 10000);
    return () => {
      stop = true;
      clearInterval(id);
    };
  }, [unlocked, company, password]);

  async function download() {
    const { filename, content } = await downloadExcel({ data: { password, company } });
    const url = URL.createObjectURL(new Blob([content], { type: "application/vnd.ms-excel" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  const villages = [...new Set(rows.map((r) => r.village))];

  if (!unlocked) {
    return (
      <main className="app-shell">
        <div className="hero-bar">
          <h1 className="text-2xl font-bold">Dashboard Owner</h1>
          <p className="mt-1 text-sm opacity-90">Masukkan password owner</p>
        </div>
        <div className="card grid gap-3">
          <input
            className="field"
            type="password"
            placeholder="Password owner"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button className="btn-primary" onClick={() => void unlock()}>
            MASUK
          </button>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Link to="/" className="text-center text-sm font-semibold text-primary">
            Kembali ke dashboard petugas
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <div className="hero-bar">
        <h1 className="text-2xl font-bold">Dashboard Owner</h1>
        <p className="mt-1 text-sm opacity-90">Pilih perusahaan untuk melihat data masuk</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            className="rounded-full bg-background/90 px-3 py-1 text-xs font-bold text-foreground"
            onClick={() => setSoundOn((v) => !v)}
          >
            {soundOn ? "🔊 Notifikasi: ON" : "🔇 Notifikasi: OFF"}
          </button>
          <button
            className="rounded-full bg-background/90 px-3 py-1 text-xs font-bold text-foreground"
            onClick={() => setSettingsOpen((v) => !v)}
          >
            ⚙ Pengaturan
          </button>
        </div>
      </div>

      {settingsOpen && (
        <div className="card mt-4 grid gap-2">
          <label className="label">Nama Perusahaan (untuk suara notifikasi)</label>
          <input
            className="field uppercase"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value.toUpperCase())}
          />
          <p className="text-xs text-muted-foreground">
            Suara: "PT {companyName || "PERUSAHAAN"} - DATA DITERIMA DARI [NAMA PETUGAS]"
          </p>
        </div>
      )}

      <div className="card mt-4 grid gap-3">
        <div className="flex items-center justify-between">
          <button
            className="flex items-center gap-2 text-base font-bold"
            onClick={() => setUnread(0)}
          >
            Data Masuk
            {unread > 0 && (
              <span className="rounded-full bg-destructive px-2 py-0.5 text-xs font-bold text-destructive-foreground">
                {unread}
              </span>
            )}
          </button>
        </div>
        <label className="label">Perusahaan</label>
        <select className="field" value={company} onChange={(e) => setCompany(e.target.value)}>
          <option value="">- PILIH PERUSAHAAN -</option>
          {companies.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        {company && (
          <button className="btn-accent" onClick={() => void download()}>
            UNDUH EXCEL {company}
          </button>
        )}
      </div>

      {error && <p className="mt-3 text-sm text-destructive">{error}</p>}

      {company && (
        <>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="card">
              <p className="label">Jumlah Desa</p>
              <p className="text-2xl font-bold">{villages.length}</p>
            </div>
            <div className="card">
              <p className="label">Jumlah CPCL</p>
              <p className="text-2xl font-bold">{rows.length}</p>
            </div>
          </div>

          {villages.map((v) => {
            const items = rows.filter((r) => r.village === v);
            return (
              <div key={v} className="mt-4 card">
                <div className="flex items-baseline justify-between">
                  <h2 className="text-lg font-bold">{v}</h2>
                  <span className="text-sm text-muted-foreground">{items.length} CPCL</span>
                </div>
                <ul className="mt-2 grid gap-3">
                  {items.map((r) => (
                    <li key={r.id} className="border-t pt-2">
                      <p className="font-semibold">
                        {r.cpclNo} - {r.cpclName}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {r.waktu} - {r.officerName} ({r.officerPhone})
                      </p>
                      <p className="text-sm">Pelimpahan: {r.pelimpahan}</p>
                      <p className="text-sm">{r.address}</p>
                      {r.coordinate && (
                        <a
                          className="text-sm font-semibold text-primary underline"
                          href={mapsUrl(r.latitude, r.longitude)}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {r.coordinate}
                        </a>
                      )}
                      <p className="mt-1">
                        <span className={r.status === "terkirim" ? "chip-sent" : "chip-pending"}>
                          {r.status.toUpperCase()}
                        </span>
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </>
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full bg-primary px-5 py-3 text-sm font-bold text-primary-foreground shadow-lg">
          {toast}
        </div>
      )}

      <Link to="/" className="mt-6 block text-center text-sm font-semibold text-primary">
        Kembali ke dashboard petugas
      </Link>
    </main>
  );
}
