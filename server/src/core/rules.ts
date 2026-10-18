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
} as const;
