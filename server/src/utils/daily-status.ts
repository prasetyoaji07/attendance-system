/**
 * FASE 1: status harian satu roster (PURE, tanpa DB). Lihat docs/alur.md bagian 7.2 dan 8.
 * Dipakai nanti oleh check-in/out dan cron penutupan harian (daily-close), supaya aturannya satu tempat.
 *
 * Aturan:
 * - Telat      : check-in setelah jam mulai + toleransi shift (calcLateMinutes).
 * - Pulang cepat: check-out sebelum jam selesai - toleransi shift yang sama. Menit dibulatkan ke bawah.
 * - Prioritas status saat hadir: TELAT > PULANG_CEPAT > HADIR. Menit telat dan menit pulang cepat tetap
 *   dilaporkan terpisah, jadi tidak ada yang hilang untuk rekap.
 * - Belum final selama shift belum selesai (now < endsAt). Status sementara tetap diberikan bila ada.
 * - Check-in tanpa check-out setelah shift selesai: status dari check-in, ditandai needsCorrection.
 * - Tanpa attendance setelah selesai: cuti/izin/sakit yang APPROVED > libur nasional > ALPA.
 *   Kehadiran nyata selalu menang atas cuti/izin/sakit.
 */
import { AppError } from '../core/errors';
import type { AttendanceStatus } from '../core/roles';
import { calcLateMinutes, type RosterWindow } from './shift-time';

const MS_MINUTE = 60_000;

export type LeaveStatus = 'CUTI' | 'IZIN' | 'SAKIT';

export interface AttendanceTimes {
  checkInAt: Date;
  checkOutAt: Date | null;
}

export interface DailyStatusInput {
  now: Date;
  window: RosterWindow;
  /** Toleransi shift (menit), dipakai untuk telat dan pulang cepat. */
  toleranceMinutes: number;
  attendance: AttendanceTimes | null;
  /** Pengajuan cuti/izin/sakit berstatus APPROVED yang mencakup tanggal roster ini. */
  approvedLeave?: LeaveStatus | null;
  /** Tanggal roster ini hari libur nasional (tabel holidays). */
  isHoliday?: boolean;
}

export interface DailyStatusResult {
  /** null = belum bisa ditentukan (shift belum selesai dan belum ada data). */
  status: AttendanceStatus | null;
  final: boolean;
  lateMinutes: number;
  earlyLeaveMinutes: number;
  /** Check-in tanpa check-out setelah shift selesai: perlu koreksi lewat pengajuan. */
  needsCorrection: boolean;
}

/** early = max(0, (selesai - toleransi) - checkOut) dalam menit bulat (dibulatkan ke bawah). */
export function calcEarlyLeaveMinutes(checkOutAt: Date, window: RosterWindow, toleranceMinutes: number): number {
  const threshold = window.endsAt.getTime() - toleranceMinutes * MS_MINUTE;
  const diff = threshold - checkOutAt.getTime();
  return diff <= 0 ? 0 : Math.floor(diff / MS_MINUTE);
}

export function computeDailyStatus(input: DailyStatusInput): DailyStatusResult {
  const { now, window, toleranceMinutes, attendance } = input;
  const ended = now.getTime() >= window.endsAt.getTime();

  if (attendance) {
    const { checkInAt, checkOutAt } = attendance;
    if (checkOutAt && checkOutAt.getTime() < checkInAt.getTime()) {
      throw new Error('Jam check-out lebih awal dari check-in');
    }
    const lateMinutes = calcLateMinutes(checkInAt, window, toleranceMinutes);
    const earlyLeaveMinutes = checkOutAt ? calcEarlyLeaveMinutes(checkOutAt, window, toleranceMinutes) : 0;
    const status: AttendanceStatus = lateMinutes > 0 ? 'TELAT' : earlyLeaveMinutes > 0 ? 'PULANG_CEPAT' : 'HADIR';
    return { status, final: ended, lateMinutes, earlyLeaveMinutes, needsCorrection: ended && checkOutAt === null };
  }

  const noShow: AttendanceStatus | null = input.approvedLeave ?? (input.isHoliday ? 'LIBUR' : null);
  return {
    status: ended ? (noShow ?? 'ALPA') : noShow,
    final: ended,
    lateMinutes: 0,
    earlyLeaveMinutes: 0,
    needsCorrection: false,
  };
}

/**
 * Aturan bisnis 3: satu roster hanya satu check-in. Dipanggil sebelum INSERT attendance;
 * UNIQUE(roster_id) di DB adalah lapis kedua jika dua request datang bersamaan.
 */
export function assertNoExistingCheckIn(existing: { checkInAt: Date | null } | null): void {
  if (existing?.checkInAt) {
    throw AppError.conflict('Kamu sudah check-in untuk jadwal ini.');
  }
}
