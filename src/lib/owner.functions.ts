import { createServerFn } from "@tanstack/react-start";
import { buildXls, REKAP_HEADERS } from "./xls";
import { coordText } from "./types";

async function checkPassword(password: string) {
  const { createHash, timingSafeEqual } = await import("node:crypto");
  const expected = process.env["OWNER_PASSWORD"];
  if (!expected) throw new Error("OWNER_PASSWORD belum diatur");
  const a = createHash("sha256").update(password, "utf8").digest();
  const b = createHash("sha256").update(expected, "utf8").digest();
  return timingSafeEqual(a, b);
}

export type OwnerRow = {
  id: string;
  waktu: string;
  submittedAt: string;
  company: string;
  village: string;
  cpclNo: string;
  cpclName: string;
  pelimpahan: string;
  address: string;
  nik: string;
  cpclPhone: string;
  coordinate: string;
  latitude: number | null;
  longitude: number | null;
  officerName: string;
  officerPhone: string;
  status: string;
};

function fmt(iso: string) {
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

export const verifyPassword = createServerFn({ method: "POST" })
  .inputValidator((data: { password: string }) => data)
  .handler(async ({ data }) => ({ ok: await checkPassword(data.password) }));

export const listCompanies = createServerFn({ method: "POST" })
  .inputValidator((data: { password: string }) => data)
  .handler(async ({ data }) => {
    if (!(await checkPassword(data.password))) throw new Error("Password salah");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin.from("submissions").select("company");
    if (error) throw new Error(error.message);
    return [...new Set((rows ?? []).map((r) => r.company))].sort();
  });

export const listReports = createServerFn({ method: "POST" })
  .inputValidator((data: { password: string; company: string }) => data)
  .handler(async ({ data }): Promise<OwnerRow[]> => {
    if (!(await checkPassword(data.password))) throw new Error("Password salah");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("submissions")
      .select("*")
      .eq("company", data.company)
      .order("submitted_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (rows ?? []).map((r) => ({
      id: r.id,
      waktu: fmt(r.submitted_at),
      submittedAt: r.submitted_at,
      company: r.company,
      village: r.village,
      cpclNo: r.cpcl_no,
      cpclName: r.cpcl_name,
      pelimpahan: r.pelimpahan ? `YA - ${r.pelimpahan_name ?? ""}`.trim() : "BUKAN",
      address: r.address,
      nik: r.nik,
      cpclPhone: r.cpcl_phone,
      coordinate: coordText(r.latitude, r.longitude),
      latitude: r.latitude,
      longitude: r.longitude,
      officerName: r.officer_name,
      officerPhone: r.officer_phone,
      status: r.status,
    }));
  });

export const downloadExcel = createServerFn({ method: "POST" })
  .inputValidator((data: { password: string; company: string }) => data)
  .handler(async ({ data }) => {
    if (!(await checkPassword(data.password))) throw new Error("Password salah");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("submissions")
      .select("*")
      .eq("company", data.company)
      .order("submitted_at", { ascending: true });
    if (error) throw new Error(error.message);
    const xls = buildXls(
      "REKAP",
      REKAP_HEADERS,
      (rows ?? []).map((r) => [
        fmt(r.submitted_at),
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
      ]),
    );
    return { filename: `REKAP ${data.company}.xls`, content: xls };
  });

export const driveStatus = createServerFn({ method: "POST" })
  .inputValidator((data: { password: string }) => data)
  .handler(async ({ data }) => {
    if (!(await checkPassword(data.password))) throw new Error("Password salah");
    const connected = Boolean(
      process.env["GOOGLE_DRIVE_API_KEY"] && process.env["LOVABLE_API_KEY"],
    );
    let email: string | null = null;
    if (connected) {
      try {
        const { driveAccount } = await import("./drive.server");
        email = await driveAccount();
      } catch {
        email = null;
      }
    }
    return {
      serviceAccountConfigured: connected,
      serviceAccountEmail: email,
      rootFolderConfigured: connected,
    };
  });
