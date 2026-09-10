import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { compressImage } from "@/lib/image";
import { loadProfile, newLocalId, saveReport } from "@/lib/local-store";
import { PHOTO_FIELDS, type PhotoKey, type Profile, type Report } from "@/lib/types";
import { enqueueUpload } from "@/lib/upload-queue";

export const Route = createFileRoute("/form")({
  head: () => ({
    meta: [
      { title: "Isian Baru - Laporan Lapangan CPCL" },
      {
        name: "description",
        content:
          "Formulir data CPCL dan 13 photo wajib, dengan koordinat GPS otomatis dan penyimpanan di handphone.",
      },
      { property: "og:title", content: "Isian Baru - Laporan Lapangan" },
      {
        property: "og:description",
        content: "Formulir data CPCL dan photo lapangan dengan koordinat GPS.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: FormPage,
});

type Draft = {
  village: string;
  cpclNo: string;
  cpclName: string;
  pelimpahan: "YA" | "BUKAN";
  pelimpahanName: string;
  nik: string;
  address: string;
  cpclPhone: string;
};

const emptyDraft: Draft = {
  village: "",
  cpclNo: "",
  cpclName: "",
  pelimpahan: "BUKAN",
  pelimpahanName: "",
  nik: "",
  address: "",
  cpclPhone: "",
};

function FormPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [step, setStep] = useState<1 | 2>(1);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [photos, setPhotos] = useState<Partial<Record<PhotoKey, string>>>({});
  const [coords, setCoords] = useState<{ lat: number; lng: number; acc: number } | null>(null);
  const [gpsNote, setGpsNote] = useState("");
  const [dialog, setDialog] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const localId = useRef(newLocalId());

  useEffect(() => {
    void loadProfile().then(setProfile);
  }, []);

  // GPS starts running in the background as soon as slide 2 opens.
  useEffect(() => {
    if (step !== 2 || typeof navigator === "undefined" || !navigator.geolocation) return;
    setGpsNote("GPS berjalan, mencari koordinat akurat...");
    const id = navigator.geolocation.watchPosition(
      (pos) => {
        setCoords((prev) =>
          !prev || pos.coords.accuracy <= prev.acc
            ? { lat: pos.coords.latitude, lng: pos.coords.longitude, acc: pos.coords.accuracy }
            : prev,
        );
        setGpsNote(`Akurasi ${Math.round(pos.coords.accuracy)} meter`);
      },
      (err) => setGpsNote(`GPS: ${err.message}`),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, [step]);

  const step1Valid =
    draft.village.trim() &&
    draft.cpclNo.trim() &&
    draft.cpclName.trim() &&
    draft.nik.trim() &&
    draft.address.trim() &&
    draft.cpclPhone.trim() &&
    (draft.pelimpahan === "BUKAN" || draft.pelimpahanName.trim());

  const allPhotos = PHOTO_FIELDS.every((f) => photos[f.key]);

  function buildReport(status: Report["status"]): Report {
    return {
      localId: localId.current,
      company: profile?.company ?? "",
      officerName: profile?.officerName ?? "",
      officerPhone: profile?.officerPhone ?? "",
      ...draft,
      latitude: coords?.lat ?? null,
      longitude: coords?.lng ?? null,
      photos,
      uploaded: [],
      status,
      savedAt: new Date().toISOString(),
    };
  }

  function reset() {
    localId.current = newLocalId();
    setDraft(emptyDraft);
    setPhotos({});
    setCoords(null);
    setStep(1);
  }

  function backToDashboard() {
    reset();
    setTimeout(() => void router.navigate({ to: "/" }), 500);
  }

  async function handleSave() {
    setBusy(true);
    await saveReport(buildReport("draft"));
    setDialog("Berhasil tersimpan di handphone. Kembali ke dashboard...");
    setBusy(false);
    backToDashboard();
  }

  function handleSubmit() {
    setBusy(true);
    enqueueUpload(buildReport("pending"));
    setDialog("Data tersimpan. Pengiriman ke Google Drive jalan di latar belakang...");
    setBusy(false);
    backToDashboard();
  }

  if (!profile) {
    return (
      <main className="app-shell pt-10">
        <p className="text-sm">Lengkapi data petugas dulu di dashboard.</p>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <div className="hero-bar">
        <p className="text-xs font-semibold tracking-widest uppercase opacity-80">
          {profile.company}
        </p>
        <h1 className="mt-1 text-2xl font-bold">
          {step === 1 ? "Data CPCL" : "Kirim Photo"}
        </h1>
        <p className="mt-1 text-sm opacity-90">Slide {step} dari 2</p>
      </div>

      {step === 1 ? (
        <div className="card grid gap-3">
          <Text
            label="1. Nama Desa"
            value={draft.village}
            upper
            onChange={(v) => setDraft({ ...draft, village: v })}
          />
          <Text
            label="2. Nomor CPCL"
            value={draft.cpclNo}
            numeric
            onChange={(v) => setDraft({ ...draft, cpclNo: v })}
          />
          <Text
            label="3. Nama CPCL"
            value={draft.cpclName}
            upper
            onChange={(v) => setDraft({ ...draft, cpclName: v })}
          />
          <div>
            <label className="label">4. Pelimpahan</label>
            <select
              className="field"
              value={draft.pelimpahan}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  pelimpahan: e.target.value as "YA" | "BUKAN",
                  pelimpahanName: e.target.value === "YA" ? draft.pelimpahanName : "",
                })
              }
            >
              <option value="BUKAN">BUKAN</option>
              <option value="YA">YA</option>
            </select>
            {draft.pelimpahan === "YA" && (
              <input
                className="field mt-2 uppercase"
                placeholder="NAMA PELIMPAHAN"
                value={draft.pelimpahanName}
                onChange={(e) =>
                  setDraft({ ...draft, pelimpahanName: e.target.value.toUpperCase() })
                }
              />
            )}
          </div>
          <Text
            label="5. NIK CPCL"
            value={draft.nik}
            numeric
            onChange={(v) => setDraft({ ...draft, nik: v })}
          />
          <Text
            label="6. Alamat CPCL"
            value={draft.address}
            upper
            onChange={(v) => setDraft({ ...draft, address: v })}
          />
          <Text
            label="7. Nomor Handphone CPCL"
            value={draft.cpclPhone}
            numeric
            onChange={(v) => setDraft({ ...draft, cpclPhone: v })}
          />
          <button className="btn-primary" disabled={!step1Valid} onClick={() => setStep(2)}>
            SELANJUTNYA
          </button>
        </div>
      ) : (
        <div className="grid gap-3">
          <p className="rounded-xl bg-secondary px-4 py-3 text-sm text-secondary-foreground">
            {gpsNote || "Menyiapkan GPS..."}
            {coords && (
              <>
                <br />
                Koordinat: {coords.lat.toFixed(6)}, {coords.lng.toFixed(6)}
              </>
            )}
          </p>

          {PHOTO_FIELDS.map((f, i) => (
            <PhotoBox
              key={f.key}
              index={i + 1}
              label={f.label}
              value={photos[f.key]}
              onPick={(dataUrl) => setPhotos((p) => ({ ...p, [f.key]: dataUrl }))}
            />
          ))}

          <button
            className="btn-outline"
            onClick={() =>
              navigator.geolocation.getCurrentPosition(
                (pos) => {
                  setCoords({
                    lat: pos.coords.latitude,
                    lng: pos.coords.longitude,
                    acc: pos.coords.accuracy,
                  });
                  setGpsNote(`Koordinat diambil, akurasi ${Math.round(pos.coords.accuracy)} meter`);
                },
                (err) => setGpsNote(`GPS: ${err.message}`),
                { enableHighAccuracy: true },
              )
            }
          >
            14. AMBIL KOORDINAT SEKARANG
          </button>

          <button
            className="btn-soft"
            disabled={!allPhotos || !coords || busy}
            onClick={() => void handleSave()}
          >
            15. SIMPAN DI HANDPHONE
          </button>
          <button
            className="btn-primary"
            disabled={!allPhotos || !coords || busy}
            onClick={() => void handleSubmit()}
          >
            {busy ? "MENGIRIM..." : "16. KIRIM KE GOOGLE DRIVE"}
          </button>
          {(!allPhotos || !coords) && (
            <p className="text-center text-xs text-muted-foreground">
              Semua 13 photo dan koordinat wajib terisi.
            </p>
          )}
          <button className="btn-outline" onClick={() => setStep(1)}>
            KEMBALI KE SLIDE 1
          </button>
        </div>
      )}

      {dialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/50 px-6">
          <div className="card w-full max-w-sm">
            <p className="text-base font-semibold">{dialog}</p>
          </div>
        </div>
      )}
    </main>
  );
}

function Text({
  label,
  value,
  onChange,
  upper,
  numeric,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  upper?: boolean;
  numeric?: boolean;
}) {
  return (
    <div>
      <label className="label">{label}</label>
      <input
        className={`field ${upper ? "uppercase" : ""}`}
        inputMode={numeric ? "numeric" : "text"}
        pattern={numeric ? "[0-9]*" : undefined}
        value={value}
        onChange={(e) =>
          onChange(
            numeric ? e.target.value.replace(/\D/g, "") : upper ? e.target.value.toUpperCase() : e.target.value,
          )
        }
      />
    </div>
  );
}

function PhotoBox({
  index,
  label,
  value,
  onPick,
}: {
  index: number;
  label: string;
  value?: string | undefined;
  onPick: (dataUrl: string) => void;
}) {
  const [working, setWorking] = useState(false);
  const inputId = `photo-${index}`;

  return (
    <div className="card flex items-center gap-3">
      <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-muted">
        {value ? (
          <img src={value} alt={label} className="h-full w-full object-cover" />
        ) : (
          <span className="text-xs text-muted-foreground">Kosong</span>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold">
          {index}. {label}
        </p>
        <p className="mb-2 text-xs text-muted-foreground">
          {working ? "Mengompres..." : value ? "Sudah diisi (di bawah 200 KB)" : "Wajib diisi"}
        </p>
        <label htmlFor={inputId} className="btn-soft py-2 text-sm">
          {value ? "GANTI PHOTO" : "AMBIL PHOTO"}
        </label>
        <input
          id={inputId}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            setWorking(true);
            try {
              onPick(await compressImage(file));
            } finally {
              setWorking(false);
              e.target.value = "";
            }
          }}
        />
      </div>
    </div>
  );
}
