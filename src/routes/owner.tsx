import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  deleteReports,
  downloadExcel,
  getOwnerWa,
  listCompanies,
  listReports,
  setOwnerWa,
  type OwnerRow,
} from "@/lib/owner.functions";
import { announceOwnerData } from "@/lib/sound";
import { isValidWa, waLink } from "@/lib/types";

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

type SortMode = "az" | "za" | "count";

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
  const [ownerWa, setOwnerWaInput] = useState("");
  const [waNote, setWaNote] = useState<string | null>(null);
  const soundRef = useRef(true);

  // Filter & sort desa
  const [villageFilter, setVillageFilter] = useState("");
  const [sortMode, setSortMode] = useState<SortMode>("az");

  // Hapus data (dialog konfirmasi + password khusus)
  const [target, setTarget] = useState<{ company: string; village?: string } | null>(null);
  const [delPass, setDelPass] = useState("");
  const [delNote, setDelNote] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function confirmDelete() {
    if (!target) return;
    setDeleting(true);
    setDelNote(null);
    try {
      await deleteReports({
        data: {
          password: delPass,
          company: target.company,
          ...(target.village ? { village: target.village } : {}),
        },
      });
      setTarget(null);
      setDelPass("");
      known.current = new Set();
      const data = await listReports({ data: { password, company } });
      setRows(data);
      data.forEach((r) => known.current.add(r.id));
      setToast("Data berhasil dihapus");
      setTimeout(() => setToast(null), 3000);
    } catch (e) {
      setDelNote(e instanceof Error ? e.message : "Gagal menghapus data");
    } finally {
      setDeleting(false);
    }
  }

  useEffect(() => {
    void getOwnerWa().then((r) => setOwnerWaInput(r.ownerWa ?? ""));
  }, []);

  async function saveOwnerWa() {
    try {
      await setOwnerWa({ data: { password, ownerWa } });
      setWaNote("Nomor WA owner tersimpan.");
    } catch (e) {
      setWaNote(e instanceof Error ? e.message : "Gagal menyimpan nomor.");
    }
  }

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

  useEffect(() => {
    setVillageFilter("");
  }, [company]);

  async function download() {
    const { filename, content } = await downloadExcel({ data: { password, company } });
    const url = URL.createObjectURL(new Blob([content], { type: "application/vnd.ms-excel" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  const villages = useMemo(() => [...new Set(rows.map((r) => r.village))].sort(), [rows]);

  const visibleRows = useMemo(
    () => (villageFilter ? rows.filter((r) => r.village === villageFilter) : rows),
    [rows, villageFilter],
  );

  const groups = useMemo(() => {
    const map = new Map<string, OwnerRow[]>();
    for (const r of visibleRows) {
      const list = map.get(r.village) ?? [];
      list.push(r);
      map.set(r.village, list);
    }
    const arr = [...map.entries()];
    if (sortMode === "az") arr.sort((a, b) => a[0].localeCompare(b[0]));
    else if (sortMode === "za") arr.sort((a, b) => b[0].localeCompare(a[0]));
    else arr.sort((a, b) => b[1].length - a[1].length);
    return arr;
  }, [visibleRows, sortMode]);

  if (!unlocked) {
    return (
      <main className="mx-auto w-full max-w-md px-4 pb-28">
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
    <main className="owner-shell">
      <div className="owner-sticky-header">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-xl font-bold">Dashboard Owner</h1>
            <p className="text-xs opacity-90">Pilih perusahaan untuk melihat data masuk</p>
          </div>
          <div className="flex flex-wrap gap-2">
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
          <label className="label mt-2">Nomor WA Owner (08xxxxxxxxxx)</label>
          <input
            className="field"
            inputMode="numeric"
            placeholder="08xxxxxxxxxx"
            value={ownerWa}
            onChange={(e) => setOwnerWaInput(e.target.value.replace(/\D/g, ""))}
          />
          <button
            className="btn-soft"
            disabled={!isValidWa(ownerWa)}
            onClick={() => void saveOwnerWa()}
          >
            SIMPAN NOMOR WA OWNER
          </button>
          {waNote && <p className="text-xs text-muted-foreground">{waNote}</p>}
        </div>
      )}

      <div className="owner-grid mt-4">
        {/* Kolom kiri: Data Masuk + filter desa + unduh excel */}
        <div className="grid content-start gap-4">
          <div className="card grid gap-3">
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
              <>
                <label className="label">Filter Desa</label>
                <select
                  className="field"
                  value={villageFilter}
                  onChange={(e) => setVillageFilter(e.target.value)}
                >
                  <option value="">- SEMUA DESA -</option>
                  {villages.map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </select>
                <button className="btn-accent" onClick={() => void download()}>
                  UNDUH EXCEL {company}
                </button>
              </>
            )}
          </div>
        </div>

        {/* Kolom kanan: statistik + tabel group by desa */}
        <div className="min-w-0">
          {error && <p className="mb-3 text-sm text-destructive">{error}</p>}

          {company && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="card">
                  <p className="label">Jumlah Desa</p>
                  <p className="text-2xl font-bold">{groups.length}</p>
                </div>
                <div className="card">
                  <p className="label">Jumlah CPCL</p>
                  <p className="text-2xl font-bold">{visibleRows.length}</p>
                </div>
              </div>

              <div className="mt-4 flex items-center gap-2">
                <label className="label mb-0 shrink-0">Urutkan:</label>
                <select
                  className="field w-auto py-2 text-sm"
                  value={sortMode}
                  onChange={(e) => setSortMode(e.target.value as SortMode)}
                >
                  <option value="az">A-Z</option>
                  <option value="za">Z-A</option>
                  <option value="count">Jumlah CPCL Terbanyak</option>
                </select>
              </div>

              {groups.map(([village, items]) => (
                <div key={village} className="card mt-4 overflow-hidden p-0">
                  <div className="flex items-baseline justify-between bg-secondary px-4 py-3">
                    <h2 className="text-lg font-bold">{village}</h2>
                    <span className="text-sm font-semibold text-muted-foreground">
                      [{items.length} CPCL]
                    </span>
                  </div>
                  <div className="owner-table-wrap">
                    <table className="owner-table">
                      <thead>
                        <tr>
                          <th>No</th>
                          <th>Nama CPCL</th>
                          <th>Waktu</th>
                          <th>Alamat</th>
                          <th>Status</th>
                          <th>Aksi</th>
                        </tr>
                      </thead>
                      <tbody>
                        {items.map((r, i) => (
                          <tr key={r.id}>
                            <td>{i + 1}</td>
                            <td className="font-semibold">
                              {r.cpclNo} - {r.cpclName}
                              {r.pelimpahan !== "BUKAN" && (
                                <span className="block text-xs font-normal text-muted-foreground">
                                  Pelimpahan: {r.pelimpahan}
                                </span>
                              )}
                            </td>
                            <td className="whitespace-nowrap">{r.waktu}</td>
                            <td>{r.address}</td>
                            <td>
                              <span
                                className={r.status === "terkirim" ? "chip-sent" : "chip-pending"}
                              >
                                {r.status.toUpperCase()}
                              </span>
                            </td>
                            <td>
                              <a
                                className="btn-send w-auto px-3 py-2 text-sm"
                                href={waLink(
                                  r.officerPhone,
                                  `Halo *${r.officerName}*, laporan *${r.cpclName}* perlu revisi: `,
                                )}
                                target="_blank"
                                rel="noreferrer"
                              >
                                💬 CHAT WA
                              </a>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      </div>

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
