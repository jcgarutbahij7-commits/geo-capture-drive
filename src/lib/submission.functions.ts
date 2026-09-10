import { createServerFn } from "@tanstack/react-start";
import { buildXls, REKAP_HEADERS } from "./xls";
import { coordText, folderLabel, type ReportPayload } from "./types";

function waktu(iso?: string) {
  const d = iso ? new Date(iso) : new Date();
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(d);
}

function rowOf(r: {
  submitted_at: string;
  company: string;
  village: string;
  cpcl_no: string;
  cpcl_name: string;
  pelimpahan: boolean;
  pelimpahan_name: string | null;
  address: string;
  nik: string;
  cpcl_phone: string;
  latitude: number | null;
  longitude: number | null;
  officer_name: string;
  officer_phone: string;
}) {
  return [
    waktu(r.submitted_at),
    r.company,
    r.village,
    r.cpcl_no,
    r.cpcl_name,
    r.pelimpahan ? `YA - ${r.pelimpahan_name ?? ""}`.trim() : "BUKAN",
    r.address,
    r.nik,
    r.cpcl_phone,
    coordText(r.latitude, r.longitude),
    r.officer_name,
    r.officer_phone,
  ];
}

function toDbRow(d: ReportPayload) {
  return {
    local_id: d.localId,
    company: d.company.toUpperCase(),
    village: d.village.toUpperCase(),
    cpcl_no: d.cpclNo,
    cpcl_name: d.cpclName.toUpperCase(),
    pelimpahan: d.pelimpahan === "YA",
    pelimpahan_name: d.pelimpahan === "YA" ? d.pelimpahanName.toUpperCase() : null,
    nik: d.nik,
    address: d.address.toUpperCase(),
    cpcl_phone: d.cpclPhone,
    latitude: d.latitude,
    longitude: d.longitude,
    officer_name: d.officerName.toUpperCase(),
    officer_phone: d.officerPhone,
  };
}

/** Step 1: build the Drive folder tree, write the data sheet, register the row as pending. */
export const startUpload = createServerFn({ method: "POST" })
  .inputValidator((data: ReportPayload) => data)
  .handler(async ({ data }) => {
    const { ensureFolderPath, upsertFile } = await import("./drive.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const row = toDbRow(data);
    const label = folderLabel({
      cpclNo: row.cpcl_no,
      cpclName: row.cpcl_name,
      pelimpahan: row.pelimpahan ? "YA" : "BUKAN",
      pelimpahanName: row.pelimpahan_name ?? "",
    });
    const folderId = await ensureFolderPath([row.company, row.village, label]);

    const submittedAt = new Date().toISOString();
    const sheet = buildXls("DATA", REKAP_HEADERS, [
      rowOf({ ...row, submitted_at: submittedAt }),
    ]);
    await upsertFile(folderId, "DATA.xls", "application/vnd.ms-excel", sheet);
    await upsertFile(
      folderId,
      "DATA.txt",
      "text/plain",
      REKAP_HEADERS.map((h, i) => `${h}: ${rowOf({ ...row, submitted_at: submittedAt })[i]}`).join(
        "\n",
      ),
    );

    const { data: saved, error } = await supabaseAdmin
      .from("submissions")
      .upsert(
        { ...row, status: "pending", drive_folder_id: folderId, submitted_at: submittedAt },
        { onConflict: "local_id" },
      )
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    return { folderId, submissionId: saved.id };
  });

/** Step 2: upload one compressed photo. Called once per photo so a drop can resume. */
export const uploadPhoto = createServerFn({ method: "POST" })
  .inputValidator((data: { folderId: string; name: string; dataUrl: string }) => data)
  .handler(async ({ data }) => {
    const { upsertFile, dataUrlToBytes } = await import("./drive.server");
    await upsertFile(
      data.folderId,
      `${data.name}.jpg`,
      "image/jpeg",
      dataUrlToBytes(data.dataUrl),
    );
    return { ok: true as const };
  });

/** Step 3: mark as sent only after every photo landed in Drive, then refresh the company rekap. */
export const finishUpload = createServerFn({ method: "POST" })
  .inputValidator((data: { submissionId: string; photoCount: number }) => data)
  .handler(async ({ data }) => {
    const { ensureFolderPath, upsertFile } = await import("./drive.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: updated, error } = await supabaseAdmin
      .from("submissions")
      .update({ status: "terkirim", photo_count: data.photoCount })
      .eq("id", data.submissionId)
      .select("company")
      .single();
    if (error) throw new Error(error.message);

    const { data: rows } = await supabaseAdmin
      .from("submissions")
      .select("*")
      .eq("company", updated.company)
      .eq("status", "terkirim")
      .order("submitted_at", { ascending: true });

    const companyFolder = await ensureFolderPath([updated.company]);
    await upsertFile(
      companyFolder,
      `REKAP ${updated.company}.xls`,
      "application/vnd.ms-excel",
      buildXls("REKAP", REKAP_HEADERS, (rows ?? []).map(rowOf)),
    );

    return { ok: true as const };
  });
