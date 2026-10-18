/**
 * FASE 1: logika waktu shift. Lihat docs/alur.md bagian 7.1 dan 8.
 * Semua fungsi PURE (tanpa DB) dan bekerja di zona waktu Asia/Jakarta (WIB, UTC+7, tanpa DST).
 * Date yang masuk/keluar adalah instan absolut (UTC di DB); WIB hanya dipakai saat menafsirkan jam shift.
 */
import { RULES } from '../core/rules';

export interface ShiftDef {
  startTime: string; // 'HH:mm'
  endTime: string; // 'HH:mm'; jika lebih kecil/sama dengan startTime berarti lintas tengah malam
  lateToleranceMinutes: number;
}

export interface RosterWindow {
  shiftDate: string; // 'YYYY-MM-DD' = tanggal MULAI shift (bukan tanggal kalender saat absen)
  startsAt: Date;
  endsAt: Date;
}

const WIB_OFFSET_HOURS = 7;
const MS_MINUTE = 60_000;
const MS_HOUR = 3_600_000;

function parseDate(s: string): [number, number, number] {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) throw new Error(`shiftDate tidak valid: "${s}" (format YYYY-MM-DD)`);
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const check = new Date(Date.UTC(y, mo - 1, d));
  if (check.getUTCFullYear() !== y || check.getUTCMonth() !== mo - 1 || check.getUTCDate() !== d) {
    throw new Error(`shiftDate tidak valid: "${s}" (tanggal tidak ada di kalender)`);
  }
  return [y, mo, d];
}

function parseTime(s: string): [number, number] {
  const m = /^(\d{2}):(\d{2})$/.exec(s);
  const h = m ? Number(m[1]) : NaN;
  const min = m ? Number(m[2]) : NaN;
  if (!m || h > 23 || min > 59) throw new Error(`Jam tidak valid: "${s}" (format HH:mm)`);
  return [h, min];
}

/** WIB (tanggal + jam) -> instan absolut. `dayOffset` > 0 untuk hari berikutnya. */
function wibToDate(y: number, mo: number, d: number, h: number, min: number, dayOffset = 0): Date {
  return new Date(Date.UTC(y, mo - 1, d + dayOffset, h - WIB_OFFSET_HOURS, min));
}

/** True jika shift selesai di hari berikutnya (selesai <= mulai, mis. 22:00-06:00). */
export function isOvernight(startTime: string, endTime: string): boolean {
  const [sh, sm] = parseTime(startTime);
  const [eh, em] = parseTime(endTime);
  return eh * 60 + em <= sh * 60 + sm;
}

/** Ubah shift_date + ShiftDef menjadi waktu mulai/selesai absolut (tangani shift malam). */
export function buildShiftWindow(shiftDate: string, shift: ShiftDef): RosterWindow {
  const [y, mo, d] = parseDate(shiftDate);
  const [sh, sm] = parseTime(shift.startTime);
  const [eh, em] = parseTime(shift.endTime);

  return {
    shiftDate,
    startsAt: wibToDate(y, mo, d, sh, sm),
    endsAt: wibToDate(y, mo, d, eh, em, isOvernight(shift.startTime, shift.endTime) ? 1 : 0),
  };
}

/**
 * Dari roster kemarin dan hari ini, pilih yang jendela check-in-nya memuat `now`.
 * Jendela = [mulai - 2 jam, selesai + 2 jam] (batas inklusif). Angka dari RULES.
 * Jika dua jendela tumpang tindih (mis. akhir shift malam dan awal shift pagi),
 * dipilih roster yang jam mulainya paling dekat dengan `now`.
 */
export function pickActiveRoster(now: Date, candidates: RosterWindow[]): RosterWindow | null {
  const t = now.getTime();
  const before = RULES.checkinWindowHoursBefore * MS_HOUR;
  const after = RULES.checkinWindowHoursAfter * MS_HOUR;

  let best: RosterWindow | null = null;
  let bestDist = Infinity;
  for (const c of candidates) {
    if (t < c.startsAt.getTime() - before || t > c.endsAt.getTime() + after) continue;
    const dist = Math.abs(t - c.startsAt.getTime());
    if (dist < bestDist) {
      best = c;
      bestDist = dist;
    }
  }
  return best;
}

/** late = max(0, now - (startsAt + toleransi)) dalam menit bulat (dibulatkan ke bawah). */
export function calcLateMinutes(checkInAt: Date, window: RosterWindow, toleranceMinutes: number): number {
  const deadline = window.startsAt.getTime() + toleranceMinutes * MS_MINUTE;
  const diff = checkInAt.getTime() - deadline;
  return diff <= 0 ? 0 : Math.floor(diff / MS_MINUTE);
}
