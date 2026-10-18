/**
 * FASE 1: aturan roster yang PURE (tanpa DB). Lihat docs/alur.md bagian 5 dan 8 (aturan 4).
 * - generateRosterEntries: ubah pola rotasi (shift_patterns.urutan) menjadi baris roster per tanggal.
 * - findRestViolations: cari pasangan shift berurutan dengan jeda kurang dari minimal (default 11 jam).
 * Hari "libur" di pola TIDAK menghasilkan baris roster (tidak ada roster = tidak wajib hadir).
 */
import { RULES } from '../core/rules';
import { buildShiftWindow, type RosterWindow, type ShiftDef } from './shift-time';

/** Nama khusus di `urutan` untuk hari tanpa shift (tidak peka huruf besar/kecil). */
export const OFF_DAY_NAME = 'libur';

const MS_HOUR = 3_600_000;
const MS_DAY = 86_400_000;

const normalize = (name: string) => name.trim().toLowerCase();
export const isOffDay = (name: string) => normalize(name) === OFF_DAY_NAME;

function parseIsoDate(s: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) throw new Error(`Tanggal tidak valid: "${s}" (format YYYY-MM-DD)`);
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const t = Date.UTC(y, mo - 1, d);
  const check = new Date(t);
  if (check.getUTCFullYear() !== y || check.getUTCMonth() !== mo - 1 || check.getUTCDate() !== d) {
    throw new Error(`Tanggal tidak valid: "${s}" (tanggal tidak ada di kalender)`);
  }
  return t;
}

/** Geser tanggal 'YYYY-MM-DD' sebanyak `days` hari (boleh negatif). */
export function addDays(date: string, days: number): string {
  return new Date(parseIsoDate(date) + days * MS_DAY).toISOString().slice(0, 10);
}

/** Selisih hari kalender `to - from`. */
export function daysBetween(from: string, to: string): number {
  return Math.round((parseIsoDate(to) - parseIsoDate(from)) / MS_DAY);
}

/** Semua tanggal dari `from` sampai `to`, inklusif. */
export function dateRange(from: string, to: string): string[] {
  const n = daysBetween(from, to);
  if (n < 0) throw new Error('Tanggal akhir tidak boleh sebelum tanggal awal');
  return Array.from({ length: n + 1 }, (_, i) => addDays(from, i));
}

/** Posisi di pola untuk `date`. Tanggal sebelum anchor tetap valid (modulo positif). */
export function patternSlot(date: string, anchorDate: string, offset: number, length: number): number {
  if (length <= 0) throw new Error('Pola kosong');
  const raw = daysBetween(anchorDate, date) + offset;
  return ((raw % length) + length) % length;
}

export interface PatternShift {
  id: number;
  nama: string;
  def: ShiftDef;
}

/** Nama di `urutan` yang bukan "libur" dan tidak cocok dengan shift mana pun (unik, urutan kemunculan). */
export function findUnknownShifts(urutan: string[], shiftNames: string[]): string[] {
  const known = new Set(shiftNames.map(normalize));
  const unknown: string[] = [];
  for (const raw of urutan) {
    const name = raw.trim();
    if (isOffDay(name) || known.has(normalize(name)) || unknown.includes(name)) continue;
    unknown.push(name);
  }
  return unknown;
}

export interface PlannedRoster {
  employeeId: number;
  shiftDate: string;
  shiftId: number;
  shiftName: string;
  window: RosterWindow;
}

export interface GenerateOptions {
  employeeId: number;
  urutan: string[];
  shifts: PatternShift[];
  /** Tanggal yang dianggap awal pola (posisi 0 sebelum offset). */
  anchorDate: string;
  /** Geser posisi pola per karyawan supaya tim tidak semuanya di shift yang sama. */
  offset: number;
  from: string;
  to: string;
}

export function generateRosterEntries(o: GenerateOptions): PlannedRoster[] {
  const byName = new Map(o.shifts.map((s) => [normalize(s.nama), s]));
  const entries: PlannedRoster[] = [];
  for (const date of dateRange(o.from, o.to)) {
    const name = o.urutan[patternSlot(date, o.anchorDate, o.offset, o.urutan.length)];
    if (isOffDay(name)) continue;
    const shift = byName.get(normalize(name));
    if (!shift) throw new Error(`Shift "${name}" tidak ditemukan`);
    entries.push({
      employeeId: o.employeeId,
      shiftDate: date,
      shiftId: shift.id,
      shiftName: shift.nama,
      window: buildShiftWindow(date, shift.def),
    });
  }
  return entries;
}

export interface RestCheckItem {
  employeeId: number;
  shiftDate: string;
  window: RosterWindow;
  /** true = baris yang akan dibuat. Pasangan yang keduanya sudah ada di DB tidak dilaporkan. */
  isNew: boolean;
}

export interface RestViolation {
  employeeId: number;
  previousDate: string;
  nextDate: string;
  /** Jam jeda (2 desimal). Negatif jika dua shift tumpang tindih. */
  restHours: number;
  minRestHours: number;
}

/** Jeda = mulai shift berikutnya - selesai shift sebelumnya, per karyawan, berurutan waktu. */
export function findRestViolations(
  items: RestCheckItem[],
  minRestHours: number = RULES.minRestHoursBetweenShifts,
): RestViolation[] {
  const byEmployee = new Map<number, RestCheckItem[]>();
  for (const it of items) {
    const list = byEmployee.get(it.employeeId) ?? [];
    list.push(it);
    byEmployee.set(it.employeeId, list);
  }

  const violations: RestViolation[] = [];
  const minMs = minRestHours * MS_HOUR;
  for (const [employeeId, list] of byEmployee) {
    list.sort((a, b) => a.window.startsAt.getTime() - b.window.startsAt.getTime());
    for (let i = 1; i < list.length; i++) {
      const prev = list[i - 1];
      const next = list[i];
      if (!prev.isNew && !next.isNew) continue;
      const restMs = next.window.startsAt.getTime() - prev.window.endsAt.getTime();
      if (restMs < minMs) {
        violations.push({
          employeeId,
          previousDate: prev.shiftDate,
          nextDate: next.shiftDate,
          restHours: Math.round((restMs / MS_HOUR) * 100) / 100,
          minRestHours,
        });
      }
    }
  }
  return violations;
}
