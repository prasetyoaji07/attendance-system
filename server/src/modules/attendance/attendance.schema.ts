import { z } from 'zod';

/** Body POST /attendance/check-in. Koordinat dan akurasi dari Geolocation API, `qr` dari hasil scan layar lokasi. */
export const checkInSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  /** Akurasi GPS dalam meter (coords.accuracy). Ditolak jika lebih besar dari RULES.maxGpsAccuracyM. */
  accuracyM: z.number().min(0).max(100_000),
  qr: z.string().min(1, 'QR wajib diisi').max(200),
});
export type CheckInInput = z.infer<typeof checkInSchema>;
