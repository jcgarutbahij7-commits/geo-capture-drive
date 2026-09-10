const MAX_BYTES = 195 * 1024;

/** Compresses a captured photo to a JPEG data URL under ~195 KB. */
export async function compressImage(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  let maxSide = 1280;
  let quality = 0.8;

  for (let attempt = 0; attempt < 9; attempt++) {
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Tidak bisa memproses photo");
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL("image/jpeg", quality);
    const bytes = Math.round((dataUrl.length - dataUrl.indexOf(",") - 1) * 0.75);
    if (bytes <= MAX_BYTES || attempt === 8) {
      bitmap.close();
      return dataUrl;
    }
    if (quality > 0.4) quality -= 0.12;
    else maxSide = Math.round(maxSide * 0.8);
  }
  throw new Error("Gagal mengompres photo");
}
