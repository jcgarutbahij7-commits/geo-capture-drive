import { finishUpload, startUpload, uploadPhoto } from "./submission.functions";
import { saveReport } from "./local-store";
import { PHOTO_FIELDS, type PhotoKey, type Report } from "./types";

/**
 * Uploads one report to Google Drive photo-by-photo. Everything stays in phone
 * storage; the status only becomes "sent" after all photos are accepted by Drive.
 */
export async function uploadReport(
  report: Report,
  onProgress?: (done: number, total: number) => void,
): Promise<Report> {
  const keys = PHOTO_FIELDS.map((f) => f.key).filter((k) => report.photos[k]);
  let current: Report = { ...report, status: "pending" };
  await saveReport(current);

  const { folderId, submissionId } = await startUpload({
    data: {
      localId: current.localId,
      company: current.company,
      officerName: current.officerName,
      officerPhone: current.officerPhone,
      village: current.village,
      cpclNo: current.cpclNo,
      cpclName: current.cpclName,
      pelimpahan: current.pelimpahan,
      pelimpahanName: current.pelimpahanName,
      nik: current.nik,
      address: current.address,
      cpclPhone: current.cpclPhone,
      latitude: current.latitude,
      longitude: current.longitude,
    },
  });

  current = { ...current, driveFolderId: folderId, serverId: submissionId };
  await saveReport(current);

  const uploaded = new Set<PhotoKey>(current.uploaded ?? []);
  let done = 0;
  for (const key of keys) {
    if (!uploaded.has(key)) {
      await uploadPhoto({
        data: { folderId, name: key.toUpperCase(), dataUrl: current.photos[key]! },
      });
      uploaded.add(key);
      current = { ...current, uploaded: [...uploaded] };
      await saveReport(current);
    }
    done += 1;
    onProgress?.(done, keys.length);
  }

  if (uploaded.size < keys.length) throw new Error("Sebagian photo belum terkirim");

  await finishUpload({ data: { submissionId, photoCount: keys.length } });
  current = { ...current, status: "sent" };
  await saveReport(current);
  return current;
}
