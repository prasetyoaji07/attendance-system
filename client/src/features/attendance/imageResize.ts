/**
 * Ambil satu frame dari video kamera lalu kecilkan jadi JPEG (tanpa paket tambahan).
 * Target <= ~200 KB supaya aman di bawah batas server 300.000 byte (RULES.maxSelfieBytes).
 */
export interface JpegShot {
  /** Isi JPEG dalam base64 (tanpa awalan "data:"), siap dikirim ke server. */
  base64: string;
  /** Data URL untuk pratinjau di <img>. */
  previewUrl: string;
  bytes: number;
}

const TARGET_BYTES = 200_000;
/** Sisi terpanjang maksimum (piksel). Bukan gaya, hanya ukuran gambar. */
const MAX_SIDE = 960;
const SCALES = [1, 0.75, 0.5];
const QUALITIES = [0.8, 0.7, 0.6, 0.5];

function toBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Gagal membuat JPEG'))), 'image/jpeg', quality);
  });
}

function readDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error('Gagal membaca foto'));
    r.readAsDataURL(blob);
  });
}

export async function captureJpeg(video: HTMLVideoElement): Promise<JpegShot> {
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  if (vw === 0 || vh === 0) throw new Error('Kamera belum siap');

  const base = Math.min(1, MAX_SIDE / Math.max(vw, vh));
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas tidak tersedia');

  let chosen: Blob | undefined;
  for (const scale of SCALES) {
    canvas.width = Math.max(1, Math.round(vw * base * scale));
    canvas.height = Math.max(1, Math.round(vh * base * scale));
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    for (const q of QUALITIES) {
      const blob = await toBlob(canvas, q);
      chosen = blob;
      if (blob.size <= TARGET_BYTES) break;
    }
    if (chosen && chosen.size <= TARGET_BYTES) break;
  }
  if (!chosen) throw new Error('Gagal membuat JPEG');

  const previewUrl = await readDataUrl(chosen);
  const base64 = previewUrl.slice(previewUrl.indexOf(',') + 1);
  return { base64, previewUrl, bytes: chosen.size };
}
