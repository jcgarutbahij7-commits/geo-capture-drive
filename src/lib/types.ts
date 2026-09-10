export const PHOTO_FIELDS = [
  { key: "selfie", label: "Photo Selfie" },
  { key: "material", label: "Photo Material" },
  { key: "ktp", label: "Photo KTP" },
  { key: "grounding", label: "Photo Grounding" },
  { key: "mcb", label: "Photo MCB" },
  { key: "fitting", label: "Photo Fitting" },
  { key: "kabel", label: "Photo Kabel" },
  { key: "saklar_tunggal", label: "Photo Saklar Tunggal" },
  { key: "saklar_ganda", label: "Photo Saklar Ganda" },
  { key: "stopkontak", label: "Photo Stopkontak" },
  { key: "tdos", label: "Photo TDOS" },
  { key: "bast", label: "Photo BAST" },
  { key: "pelaksanaan", label: "Photo Pelaksanaan" },
] as const;

export type PhotoKey = (typeof PHOTO_FIELDS)[number]["key"];

export type Profile = {
  company: string;
  officerName: string;
  officerPhone: string;
};

export type LocalStatus = "draft" | "pending" | "sent";

export type Report = {
  localId: string;
  company: string;
  officerName: string;
  officerPhone: string;
  village: string;
  cpclNo: string;
  cpclName: string;
  pelimpahan: "YA" | "BUKAN";
  pelimpahanName: string;
  nik: string;
  address: string;
  cpclPhone: string;
  latitude: number | null;
  longitude: number | null;
  photos: Partial<Record<PhotoKey, string>>;
  uploaded: PhotoKey[];
  status: LocalStatus;
  savedAt: string;
  driveFolderId?: string;
  serverId?: string;
};

export type ReportPayload = Omit<Report, "photos" | "uploaded" | "status" | "savedAt">;

export function folderLabel(r: {
  cpclNo: string;
  cpclName: string;
  pelimpahan: string;
  pelimpahanName: string;
}) {
  const base = `${r.cpclNo} - ${r.cpclName}`;
  return r.pelimpahan === "YA" && r.pelimpahanName ? `${base} - ${r.pelimpahanName}` : base;
}

export function coordText(lat: number | null, lng: number | null) {
  if (lat == null || lng == null) return "";
  return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
}

export function mapsUrl(lat: number | null, lng: number | null) {
  if (lat == null || lng == null) return "";
  return `https://www.google.com/maps?q=${lat},${lng}`;
}
