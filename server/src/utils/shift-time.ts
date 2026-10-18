/**
 * FASE 1 (kerjakan dengan TDD): logika waktu shift. Lihat docs/alur.md bagian 7.1 dan 8.
 * Semua fungsi harus PURE (tanpa akses DB) dan bekerja di zona waktu Asia/Jakarta.
 * Isi fungsi di bawah masih TODO. Tulis test dulu di src/tests/attendance-rules.test.ts.
 */
export interface ShiftDef {
  startTime: string; // 'HH:mm'
  endTime: string; // 'HH:mm'; jika lebih kecil dari startTime berarti lintas tengah malam
  lateToleranceMinutes: number;
}

export interface RosterWindow {
  shiftDate: string; // 'YYYY-MM-DD' = tanggal MULAI shift (bukan tanggal kalender saat absen)
  startsAt: Date;
  endsAt: Date;
}

/** Ubah shift_date + ShiftDef menjadi waktu mulai/selesai absolut (tangani shift malam). */
export function buildShiftWindow(_shiftDate: string, _shift: ShiftDef): RosterWindow {
  throw new Error('TODO: buildShiftWindow');
}

/** Dari roster kemarin dan hari ini, pilih yang jendela check-in-nya memuat `now`. */
export function pickActiveRoster(_now: Date, _candidates: RosterWindow[]): RosterWindow | null {
  throw new Error('TODO: pickActiveRoster');
}

/** late = max(0, now - (startsAt + toleransi)) dalam menit bulat. */
export function calcLateMinutes(_checkInAt: Date, _window: RosterWindow, _toleranceMinutes: number): number {
  throw new Error('TODO: calcLateMinutes');
}
