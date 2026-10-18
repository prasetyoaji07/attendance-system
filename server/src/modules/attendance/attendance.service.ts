/**
 * Logika bisnis check-in (docs/alur.md 7.1). Dependensi disuntik supaya bisa di-unit-test tanpa DB;
 * penyambungan ada di attendance.controller.ts.
 *
 * Urutan pemeriksaan mengikuti diagram alur:
 *   roster aktif -> sudah check-in? -> akurasi GPS -> jarak (Haversine) -> QR -> hitung telat -> simpan.
 * Tiga pemeriksaan di tengah (GPS, jarak, QR) ada di presence.ts karena dipakai juga oleh check-out.
 * JWT dicek middleware. Device binding menyusul (item terpisah di TASKS Fase 2).
 */
import { isDuplicateEntry } from '../../core/db-errors';
import { AppError } from '../../core/errors';
import type { AuthUser } from '../../core/middleware/auth';
import type { AttendanceStatus } from '../../core/roles';
import type { TxRunner } from '../../core/service-deps';
import { assertNoExistingCheckIn, computeDailyStatus } from '../../utils/daily-status';
import { addDays } from '../../utils/roster-rules';
import { buildShiftWindow, pickActiveRoster, type RosterWindow, type ShiftDef } from '../../utils/shift-time';
import type { CheckInInput } from './attendance.schema';
import { assertPresence } from './presence';

const WIB_OFFSET_MS = 7 * 3_600_000;

/** Roster beserta shift, lokasi, dan check-in yang sudah ada (jika ada). */
export interface RosterCandidate {
  rosterId: number;
  shiftDate: string; // 'YYYY-MM-DD' = tanggal MULAI shift
  shiftNama: string;
  shift: ShiftDef;
  location: { id: number; nama: string; lat: number; lng: number; radiusM: number };
  checkInAt: Date | null;
}

export interface NewCheckIn {
  rosterId: number;
  checkInAt: Date;
  lat: number;
  lng: number;
  distanceM: number;
  accuracyM: number;
  lateMinutes: number;
  status: AttendanceStatus;
}

export interface AttendanceRepository {
  /** Roster karyawan pada tanggal-tanggal mulai shift yang diberikan. */
  findCandidates(employeeId: number, shiftDates: string[]): Promise<RosterCandidate[]>;
  insertCheckIn(data: NewCheckIn, tx?: unknown): Promise<number>;
}

export interface AttendanceDeps {
  repo: AttendanceRepository;
  qrSecret: string;
  qrTtlSeconds: number;
  runInTransaction: TxRunner;
  /** Jam saat ini. Diganti di tes. */
  now?: () => Date;
}

export interface CheckInResult {
  attendanceId: number;
  rosterId: number;
  shiftDate: string;
  shiftNama: string;
  locationNama: string;
  checkInAt: string; // ISO UTC
  status: AttendanceStatus;
  lateMinutes: number;
  distanceM: number;
  message: string;
}

const wibDateOf = (d: Date) => new Date(d.getTime() + WIB_OFFSET_MS).toISOString().slice(0, 10);
const wibTimeOf = (d: Date) => new Date(d.getTime() + WIB_OFFSET_MS).toISOString().slice(11, 16);

export function createAttendanceService(deps: AttendanceDeps) {
  const { repo, qrSecret, qrTtlSeconds, runInTransaction } = deps;
  const clock = deps.now ?? (() => new Date());
  const alreadyMsg = 'Kamu sudah check-in untuk jadwal ini.';

  return {
    async checkIn(input: CheckInInput, user: AuthUser): Promise<CheckInResult> {
      const now = clock();

      // 1) Roster aktif. Tanggal mulai shift: kemarin (shift malam yang melewati tengah malam), hari ini,
      //    dan besok (shift yang mulai lewat tengah malam tetapi jendela check-in-nya sudah terbuka malam ini).
      const today = wibDateOf(now);
      const candidates = await repo.findCandidates(user.employeeId, [addDays(today, -1), today, addDays(today, 1)]);
      const windows = candidates.map((c) => ({ c, window: buildShiftWindow(c.shiftDate, c.shift) }));
      const byWindow = new Map<RosterWindow, RosterCandidate>(windows.map((x) => [x.window, x.c]));
      const picked = pickActiveRoster(now, windows.map((x) => x.window));
      if (!picked) {
        throw new AppError(422, 'NO_ACTIVE_ROSTER', 'Tidak ada jadwal yang bisa di-check-in sekarang. Cek lagi jadwalmu.');
      }
      const roster = byWindow.get(picked)!;

      // 2) Satu roster hanya satu check-in (aturan bisnis 3).
      assertNoExistingCheckIn({ checkInAt: roster.checkInAt });

      // 3-5) Akurasi GPS, jarak ke lokasi (geofence), dan QR dinamis.
      const { distanceM } = assertPresence(input, roster.location, now, { secret: qrSecret, ttlSeconds: qrTtlSeconds });

      // 6) Telat dan status dihitung oleh satu fungsi yang sama dengan penutupan harian.
      const daily = computeDailyStatus({
        now,
        window: picked,
        toleranceMinutes: roster.shift.lateToleranceMinutes,
        attendance: { checkInAt: now, checkOutAt: null },
      });
      const status = daily.status ?? 'HADIR';

      // 7) Simpan. UNIQUE(roster_id) di DB menangkap dua request yang datang bersamaan.
      let attendanceId: number;
      try {
        attendanceId = await runInTransaction((tx) =>
          repo.insertCheckIn(
            {
              rosterId: roster.rosterId,
              checkInAt: now,
              lat: input.lat,
              lng: input.lng,
              distanceM: Math.round(distanceM * 100) / 100,
              accuracyM: input.accuracyM,
              lateMinutes: daily.lateMinutes,
              status,
            },
            tx,
          ),
        );
      } catch (err) {
        if (isDuplicateEntry(err)) throw AppError.conflict(alreadyMsg);
        throw err;
      }

      const jam = wibTimeOf(now);
      return {
        attendanceId,
        rosterId: roster.rosterId,
        shiftDate: roster.shiftDate,
        shiftNama: roster.shiftNama,
        locationNama: roster.location.nama,
        checkInAt: now.toISOString(),
        status,
        lateMinutes: daily.lateMinutes,
        distanceM: Math.round(distanceM),
        message: daily.lateMinutes > 0 ? `Check-in ${jam}, terlambat ${daily.lateMinutes} menit` : `Check-in ${jam}, tepat waktu`,
      };
    },
  };
}
