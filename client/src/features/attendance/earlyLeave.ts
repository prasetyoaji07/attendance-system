/**
 * Alasan pulang sebelum jam selesai. SALINAN dari server/src/core/early-leave-reasons.ts
 * (kode harus persis sama; server menolak kode lain). Label ikut disalin.
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
