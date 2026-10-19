/**
 * Alasan pulang sebelum jam selesai shift (C0b). Dropdown saja, tanpa teks bebas.
 * Satu tempat untuk: validasi zod di server dan label di client (client menyalin label ini).
 * Menambah alasan baru cukup di sini (kolom DB `early_leave_reason` berupa VARCHAR, bukan ENUM).
 *
 * Catatan: SAKIT_KECELAKAAN hanya DISIMPAN. Ini BUKAN sistem tanggap darurat; flag/notifikasi menyusul (Fase 3/5).
 */
export const EARLY_LEAVE_REASONS = [
  'SAKIT_KECELAKAAN',
  'URUSAN_KELUARGA',
  'DISURUH_ATASAN',
  'KERJAAN_SELESAI',
  'LAINNYA',
] as const;
export type EarlyLeaveReason = (typeof EARLY_LEAVE_REASONS)[number];

export const EARLY_LEAVE_REASON_LABELS: Record<EarlyLeaveReason, string> = {
  SAKIT_KECELAKAAN: 'Sakit / kecelakaan kerja',
  URUSAN_KELUARGA: 'Urusan keluarga mendesak',
  DISURUH_ATASAN: 'Disuruh atasan pulang',
  KERJAAN_SELESAI: 'Pekerjaan sudah selesai',
  LAINNYA: 'Lainnya',
};
