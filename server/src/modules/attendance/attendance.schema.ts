import { z } from 'zod';
import { EARLY_LEAVE_REASONS } from '../../core/early-leave-reasons';

/** Body POST /attendance/check-in. Koordinat dan akurasi dari Geolocation API, `qr` dari hasil scan layar lokasi. */
export const checkInSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  /** Akurasi GPS dalam meter (coords.accuracy). Ditolak jika lebih besar dari RULES.maxGpsAccuracyM. */
  accuracyM: z.number().min(0).max(100_000),
  qr: z.string().min(1, 'QR wajib diisi').max(200),
});
export type CheckInInput = z.infer<typeof checkInSchema>;

/**
 * Body POST /attendance/check-out: sama dengan check-in (kehadiran di lokasi dibuktikan lagi saat pulang)
 * ditambah `earlyLeaveReason` (kode dropdown, tanpa teks bebas). Wajib-tidaknya diputuskan server dari jam server
 * (service): wajib jika sekarang belum jam selesai shift; jika sudah jam selesai, alasan diabaikan.
 */
export const checkOutSchema = checkInSchema.extend({
  earlyLeaveReason: z.enum(EARLY_LEAVE_REASONS).optional(),
});
export type CheckOutInput = z.infer<typeof checkOutSchema>;
