/**
 * FASE 2: batas akhir check-out dan pemilihan absen yang harus ditutup otomatis (PURE, tanpa DB).
 * Lihat docs/alur.md bagian 7.2.
 *
 * Batas akhir = selesai shift + RULES.checkinWindowHoursAfter (jendela yang sama dengan check-in).
 * Lewat dari batas itu, check-out ditolak dan absen yang belum check-out ditutup otomatis oleh cron.
 * Jam pulang TIDAK dikarang: check_out_at tetap kosong dan absen ditandai perlu koreksi.
 */
import { RULES } from '../core/rules';
import { buildShiftWindow, type RosterWindow, type ShiftDef } from './shift-time';

const MS_HOUR = 3_600_000;

/** Absen yang sudah check-in tetapi belum check-out dan belum ditutup. */
export interface OpenAttendanceRow {
  attendanceId: number;
  shiftDate: string; // 'YYYY-MM-DD' = tanggal MULAI shift
  shift: ShiftDef;
}

export function closeDeadline(window: RosterWindow): Date {
  return new Date(window.endsAt.getTime() + RULES.checkinWindowHoursAfter * MS_HOUR);
}

/** Tepat di batas masih dianggap belum lewat (inklusif, sama seperti jendela check-in). */
export function isPastCloseDeadline(now: Date, window: RosterWindow): boolean {
  return now.getTime() > closeDeadline(window).getTime();
}

/** Id absen yang batas akhirnya sudah lewat pada waktu `now`. */
export function pickAutoCloseTargets(now: Date, rows: OpenAttendanceRow[]): number[] {
  return rows
    .filter((r) => isPastCloseDeadline(now, buildShiftWindow(r.shiftDate, r.shift)))
    .map((r) => r.attendanceId);
}
