import { ApiError } from '@/lib/api';

/**
 * Pesan ramah untuk kode error yang butuh arahan tambahan di layar (perangkat, sesi).
 * Kode lain (OUT_OF_RADIUS, GPS_ACCURACY_LOW, INVALID_QR, NO_ACTIVE_ROSTER, CONFLICT, NO_OPEN_ATTENDANCE,
 * CHECKOUT_WINDOW_CLOSED, EARLY_LEAVE_REASON_REQUIRED) sengaja memakai pesan dari server: sudah berbahasa
 * Indonesia, ramah, dan memuat angka (jarak, akurasi, jam).
 */
const MESSAGES: Record<string, string> = {
  DEVICE_REQUIRED: 'Perangkat ini belum dikenali server. Muat ulang halaman lalu login lagi ya.',
  DEVICE_NOT_REGISTERED: 'Perangkat ini belum terdaftar. Login ulang supaya didaftarkan, lalu coba lagi.',
  DEVICE_PENDING: 'Perangkat ini masih menunggu persetujuan HRD. Kamu bisa absen setelah disetujui.',
  UNAUTHORIZED: 'Sesimu sudah habis. Login ulang ya, lalu coba absen lagi.',
};

/** Pesan untuk ditampilkan ke pengguna. Kode yang tidak dikenal memakai pesan dari server. */
export function friendlyError(err: unknown, fallback = 'Terjadi kesalahan. Coba lagi ya.'): string {
  if (err instanceof ApiError) return MESSAGES[err.code] ?? err.message;
  return fallback;
}
