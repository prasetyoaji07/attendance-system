/**
 * Konstanta aturan bisnis. Semua angka adalah ASUMSI SIMULASI (lihat docs/alur.md bagian 2).
 * Jangan hardcode angka ini di service. Impor dari sini.
 * Nanti bisa dipindah ke tabel konfigurasi.
 */
export const RULES = {
  timezone: 'Asia/Jakarta',
  lateToleranceMinutes: 5,
  maxGpsAccuracyM: 50,
  defaultRadiusM: 100,
  qrTtlSeconds: 45,
  checkinWindowHoursBefore: 2,
  checkinWindowHoursAfter: 2,
  minRestHoursBetweenShifts: 11,
  maxRosterRangeDays: 62,
  maxOvertimeHoursPerDay: 4,
  annualLeaveQuotaDays: 12,
  payrollCutoffStartDay: 21,
  payrollCutoffEndDay: 20,
  /** Absen tanpa QR (docs/alur.md 7.1b). */
  selfieRetentionDays: 30,
  /** Peluang sebuah absen tanpa QR masuk antrean tinjauan acak (0.1 = 10%). */
  noQrReviewSampleRate: 0.1,
  /** Batas ukuran selfie setelah dikecilkan di HP, dalam byte (JPEG hasil decode). */
  maxSelfieBytes: 300_000,
} as const;
