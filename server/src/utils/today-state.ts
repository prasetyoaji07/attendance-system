/**
 * C0: status Beranda karyawan untuk GET /attendance/today (PURE, tanpa DB). Lihat docs/api.md.
 *
 * Memakai fungsi jendela yang sama dengan check-in (buildShiftWindow + pickActiveRoster) dan batas check-out
 * yang sama dengan check-out (closeDeadline). Roster yang diperiksa: tanggal mulai kemarin, hari ini, dan besok.
 *
 * Urutan penentuan (yang cocok duluan dipakai):
 *   1. Absen terakhir (check_in_at terbaru) sudah masuk, belum pulang, belum ditutup, dan belum lewat batas -> CHECKED_IN
 *   2. Ada roster yang jendelanya memuat sekarang                                                          -> NOT_CHECKED_IN / CHECKED_OUT
 *   3. Absen terakhir sudah pulang dan tanggal WIB pulangnya hari ini                                       -> CHECKED_OUT
 *   4. Absen terakhir terbuka tetapi ditutup otomatis atau sudah lewat batas (cron mungkin belum jalan)     -> AUTO_CLOSED
 *   5. Ada roster yang jendelanya belum terbuka (diambil yang terdekat)                                     -> UPCOMING
 *   6. Selain itu                                                                                           -> NO_SCHEDULE
 * Baris absen tanpa check_in_at (mis. ALPA/LIBUR dari seed) dianggap belum ada absen.
 */
import type { AttendanceStatus } from '../core/roles';
import { RULES } from '../core/rules';
import { closeDeadline, isPastCloseDeadline } from './auto-close';
import { buildShiftWindow, isBeforeShiftEnd, pickActiveRoster, type RosterWindow, type ShiftDef } from './shift-time';

const WIB_OFFSET_MS = 7 * 3_600_000;
const MS_HOUR = 3_600_000;

/** Tanggal 'YYYY-MM-DD' menurut WIB untuk sebuah instan. */
export const wibDateOf = (d: Date): string => new Date(d.getTime() + WIB_OFFSET_MS).toISOString().slice(0, 10);

export type TodayStatus = 'NO_SCHEDULE' | 'UPCOMING' | 'NOT_CHECKED_IN' | 'CHECKED_IN' | 'CHECKED_OUT' | 'AUTO_CLOSED';

export interface TodayLocation {
  id: number;
  nama: string;
  lat: number;
  lng: number;
  radiusM: number;
}

/** Baris attendance milik sebuah roster (jika ada). `checkInAt` bisa kosong untuk baris seperti ALPA/LIBUR. */
export interface TodayAttendanceRow {
  attendanceId: number;
  checkInAt: Date | null;
  checkOutAt: Date | null;
  status: AttendanceStatus | null;
  lateMinutes: number;
  earlyLeaveMinutes: number;
  autoClosed: boolean;
  needsCorrection: boolean;
}

/** Roster + shift + lokasi + absennya (jika ada). Dibuat oleh repository. */
export interface TodayCandidate {
  rosterId: number;
  shiftDate: string; // 'YYYY-MM-DD' = tanggal MULAI shift
  shiftNama: string;
  shift: ShiftDef;
  location: TodayLocation;
  attendance: TodayAttendanceRow | null;
}

export interface TodayResult {
  serverTime: string; // ISO UTC
  status: TodayStatus;
  roster: {
    rosterId: number;
    shiftDate: string;
    shiftNama: string;
    startTime: string;
    endTime: string;
    location: TodayLocation;
  } | null;
  /** Jendela check-in/check-out roster ini (ISO UTC). closesAt = batas akhir check-out. */
  window: { opensAt: string; closesAt: string } | null;
  canCheckIn: boolean;
  /** Hanya terisi saat CHECKED_IN. `early` = sekarang belum jam selesai (client minta alasan pulang awal). */
  checkOut: { allowed: boolean; early: boolean; deadlineAt: string } | null;
  attendance: {
    attendanceId: number;
    checkInAt: string;
    checkOutAt: string | null;
    status: AttendanceStatus | null;
    lateMinutes: number;
    earlyLeaveMinutes: number;
    autoClosed: boolean;
    needsCorrection: boolean;
  } | null;
}

type WithAttendance = TodayAttendanceRow & { checkInAt: Date };
interface Item {
  c: TodayCandidate;
  window: RosterWindow;
  att: WithAttendance | null;
}

function build(now: Date, status: TodayStatus, it: Item | null): TodayResult {
  const serverTime = now.toISOString();
  if (!it) {
    return { serverTime, status, roster: null, window: null, canCheckIn: false, checkOut: null, attendance: null };
  }
  const { c, window: w, att } = it;
  const deadlineAt = closeDeadline(w).toISOString();
  return {
    serverTime,
    status,
    roster: {
      rosterId: c.rosterId,
      shiftDate: c.shiftDate,
      shiftNama: c.shiftNama,
      startTime: c.shift.startTime,
      endTime: c.shift.endTime,
      location: c.location,
    },
    window: { opensAt: new Date(w.startsAt.getTime() - RULES.checkinWindowHoursBefore * MS_HOUR).toISOString(), closesAt: deadlineAt },
    canCheckIn: status === 'NOT_CHECKED_IN',
    checkOut: status === 'CHECKED_IN' ? { allowed: true, early: isBeforeShiftEnd(now, w), deadlineAt } : null,
    attendance: att
      ? {
          attendanceId: att.attendanceId,
          checkInAt: att.checkInAt.toISOString(),
          checkOutAt: att.checkOutAt ? att.checkOutAt.toISOString() : null,
          status: att.status,
          lateMinutes: att.lateMinutes,
          earlyLeaveMinutes: att.earlyLeaveMinutes,
          autoClosed: att.autoClosed,
          needsCorrection: att.needsCorrection,
        }
      : null,
  };
}

export function resolveTodayState(now: Date, candidates: TodayCandidate[]): TodayResult {
  const items: Item[] = candidates.map((c) => ({
    c,
    window: buildShiftWindow(c.shiftDate, c.shift),
    att: c.attendance && c.attendance.checkInAt ? { ...c.attendance, checkInAt: c.attendance.checkInAt } : null,
  }));

  // Absen terakhir = check_in_at terbaru (sama seperti check-out memilih absennya).
  let latest: (Item & { att: WithAttendance }) | null = null;
  for (const it of items) {
    if (it.att && (!latest || it.att.checkInAt.getTime() > latest.att.checkInAt.getTime())) {
      latest = it as Item & { att: WithAttendance };
    }
  }

  // 1) Sudah masuk, belum pulang, dan masih dalam batas check-out.
  if (latest && latest.att.checkOutAt === null && !latest.att.autoClosed && !isPastCloseDeadline(now, latest.window)) {
    return build(now, 'CHECKED_IN', latest);
  }

  // 2) Jendela roster yang memuat sekarang (fungsi yang sama dengan check-in).
  const picked = pickActiveRoster(
    now,
    items.map((i) => i.window),
  );
  const active = picked ? items.find((i) => i.window === picked) : undefined;
  if (active) {
    if (active.att?.checkOutAt) return build(now, 'CHECKED_OUT', active);
    if (active.att?.autoClosed) return build(now, 'AUTO_CLOSED', active);
    // Kasus langka (jendela dua shift tumpang tindih): absen terbuka milik roster ini.
    if (active.att) return build(now, 'CHECKED_IN', active);
    return build(now, 'NOT_CHECKED_IN', active);
  }

  // 3) Sudah pulang, dan pulangnya hari ini (WIB): tetap tampil "sudah pulang" sepanjang hari.
  if (latest && latest.att.checkOutAt && wibDateOf(latest.att.checkOutAt) === wibDateOf(now)) {
    return build(now, 'CHECKED_OUT', latest);
  }

  // 4) Absen terbuka yang sudah ditutup otomatis atau lewat batas (cron 15 menit mungkin belum sempat jalan).
  if (latest && latest.att.checkOutAt === null) {
    return build(now, 'AUTO_CLOSED', latest);
  }

  // 5) Jadwal berikutnya yang jendelanya belum terbuka.
  const opensBefore = RULES.checkinWindowHoursBefore * MS_HOUR;
  let upcoming: Item | null = null;
  for (const it of items) {
    if (it.att) continue;
    if (now.getTime() >= it.window.startsAt.getTime() - opensBefore) continue;
    if (!upcoming || it.window.startsAt.getTime() < upcoming.window.startsAt.getTime()) upcoming = it;
  }
  if (upcoming) return build(now, 'UPCOMING', upcoming);

  // 6) Tidak ada apa-apa.
  return build(now, 'NO_SCHEDULE', null);
}
