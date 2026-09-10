const MAX_BYTES = 100 * 1024;
const MAX_SIDE = 1024;

export type CompressedPhoto = { dataUrl: string; bytes: number };

function byteSize(dataUrl: string) {
  return Math.round((dataUrl.length - dataUrl.indexOf(",") - 1) * 0.75);
}

/** Compresses a captured photo to a fast-to-send JPEG under ~100 KB. */
export async function compressImage(file: File): Promise<CompressedPhoto> {
  const bitmap = await createImageBitmap(file);
  let maxSide = MAX_SIDE;
  const qualities = [0.6, 0.5, 0.4];
  let last: CompressedPhoto | null = null;

  try {
    for (let round = 0; round < 4; round++) {
      for (const quality of qualities) {
        const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(bitmap.width * scale));
        canvas.height = Math.max(1, Math.round(bitmap.height * scale));
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("Tidak bisa memproses photo");
        ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL("image/jpeg", quality);
        last = { dataUrl, bytes: byteSize(dataUrl) };
        if (last.bytes <= MAX_BYTES) return last;
      }
      maxSide = Math.round(maxSide * 0.8);
    }
    if (last) return last;
    throw new Error("Gagal mengompres photo");
  } finally {
    bitmap.close();
  }
}

export function sizeLabel(bytes: number) {
  return `Ukuran: ${Math.max(1, Math.round(bytes / 1024))}KB - Siap Kirim Cepat`;
}
