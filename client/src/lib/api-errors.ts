import { ApiError } from '@/lib/api';

/** Pesan ramah untuk kode error perangkat (docs/api.md, bagian Devices). Dipakai banner dan, nanti, check-in/out. */
const MESSAGES: Record<string, string> = {
  DEVICE_REQUIRED: 'Perangkat ini belum dikenali server. Muat ulang halaman lalu login lagi ya.',
  DEVICE_NOT_REGISTERED: 'Perangkat ini belum terdaftar. Login ulang supaya didaftarkan, lalu coba lagi.',
  DEVICE_PENDING: 'Perangkat ini masih menunggu persetujuan HRD. Kamu bisa absen setelah disetujui.',
};

/** Pesan untuk ditampilkan ke pengguna. Kode yang tidak dikenal memakai pesan dari server. */
export function friendlyError(err: unknown, fallback = 'Terjadi kesalahan. Coba lagi ya.'): string {
  if (err instanceof ApiError) return MESSAGES[err.code] ?? err.message;
  return fallback;
}
