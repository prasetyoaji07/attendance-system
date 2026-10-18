/**
 * Logika bisnis check-out (docs/alur.md 7.1/7.2). Dependensi disuntik supaya bisa di-unit-test tanpa DB;
 * penyambungan ada di attendance.controller.ts.
 *
 * Beda dengan check-in: yang dicari adalah ABSEN TERAKHIR milik karyawan (bukan roster lewat jendela),
 * supaya shift malam yang lewat tengah malam tetap menempel ke roster tanggal mulainya.
 *
 * Urutan: absen terakhir -> sudah check-out? -> masih dalam batas waktu? -> akurasi GPS -> jarak -> QR
 *         -> hitung pulang cepat + status -> simpan.
 * Batas waktu = selesai shift + RULES.checkinWindowHoursAfter. Lewat itu, absen perlu koreksi lewat HRD.
 */
import { AppError } from '../../core/errors';
import type { AuthUser } from '../../core/middleware/auth';
import type { AttendanceStatus } from '../../core/roles';
import type { TxRunner } from '../../core/service-deps';
import { isPastCloseDeadline } from '../../utils/auto-close';
import { computeDailyStatus } from '../../utils/daily-status';
import { buildShiftWindow, type ShiftDef } from '../../utils/shift-time';
import type { CheckOutInput } from './attendance.schema';
import { assertPresence, type PresenceLocation } from './presence';

const WIB_OFFSET_MS = 7 * 3_600_000;
const wibTimeOf = (d: Date) => new Date(d.getTime() + WIB_OFFSET_MS).toISOString().slice(11, 16);

/** Absen terakhir karyawan (urut check_in_at menurun) beserta shift dan lokasi rosternya. */
export interface AttendanceRecord {
  attendanceId: number;
  rosterId: number;
  shiftDate: string; // 'YYYY-MM-DD' = tanggal MULAI shift
  shiftNama: string;
  shift: ShiftDef;
  location: PresenceLocation;
  checkInAt: Date;
  checkOutAt: Date | null;
  autoClosed: boolean;
}

export interface NewCheckOut {
  attendanceId: number;
  checkOutAt: Date;
  lat: number;
  lng: number;
  earlyLeaveMinutes: number;
  status: AttendanceStatus;
}

export interface CheckOutRepository {
  /** Absen terakhir (check_in_at terbaru) milik karyawan, atau null jika belum pernah check-in. */
  findLatestAttendance(employeeId: number): Promise<AttendanceRecord | null>;
  /**
   * Isi data check-out hanya jika baris masih terbuka (check_out_at kosong dan belum auto-close).
   * Mengembalikan false jika tidak ada baris yang berubah (keburu check-out / ditutup otomatis).
   */
  updateCheckOut(data: NewCheckOut, tx?: unknown): Promise<boolean>;
}

export interface CheckOutDeps {
  repo: CheckOutRepository;
  qrSecret: string;
  qrTtlSeconds: number;
  runInTransaction: TxRunner;
  /** Jam saat ini. Diganti di tes. */
  now?: () => Date;
}

export interface CheckOutResult {
  attendanceId: number;
  rosterId: number;
  shiftDate: string;
  shiftNama: string;
  locationNama: string;
  checkInAt: string; // ISO UTC
  checkOutAt: string; // ISO UTC
  status: AttendanceStatus;
  lateMinutes: number;
  earlyLeaveMinutes: number;
  workedMinutes: number;
  distanceM: number;
  message: string;
}

const noOpenAttendance = () =>
  new AppError(422, 'NO_OPEN_ATTENDANCE', 'Kamu belum check-in, jadi belum bisa check-out.');

export function createCheckOutService(deps: CheckOutDeps) {
  const { repo, qrSecret, qrTtlSeconds, runInTransaction } = deps;
  const clock = deps.now ?? (() => new Date());

  return {
    async checkOut(input: CheckOutInput, user: AuthUser): Promise<CheckOutResult> {
      const now = clock();

      // 1) Absen terakhir.
      const latest = await repo.findLatestAttendance(user.employeeId);
      if (!latest) throw noOpenAttendance();
      const window = buildShiftWindow(latest.shiftDate, latest.shift);
      const pastDeadline = isPastCloseDeadline(now, window);

      // 2) Sudah check-out? Masih relevan (dalam batas waktu) -> 409. Sudah lama selesai -> tidak ada absen terbuka.
      if (latest.checkOutAt !== null) {
        if (pastDeadline) throw noOpenAttendance();
        throw AppError.conflict('Kamu sudah check-out untuk jadwal ini.');
      }

      // 3) Batas waktu. Absen yang sudah ditutup otomatis juga ditolak.
      if (latest.autoClosed || pastDeadline) {
        throw new AppError(
          422,
          'CHECKOUT_WINDOW_CLOSED',
          'Waktu check-out untuk jadwal ini sudah lewat. Ajukan koreksi absen ke HRD.',
        );
      }

      // 4-6) Akurasi GPS, jarak ke lokasi, dan QR dinamis (sama dengan check-in).
      const { distanceM } = assertPresence(input, latest.location, now, { secret: qrSecret, ttlSeconds: qrTtlSeconds });

      // 7) Pulang cepat dan status dari satu fungsi yang sama dengan check-in dan penutupan harian.
      const daily = computeDailyStatus({
        now,
        window,
        toleranceMinutes: latest.shift.lateToleranceMinutes,
        attendance: { checkInAt: latest.checkInAt, checkOutAt: now },
      });
      const status = daily.status ?? 'HADIR';

      // 8) Simpan. Kondisi di UPDATE menangkap dua request bersamaan atau auto-close yang menyalip.
      const updated = await runInTransaction((tx) =>
        repo.updateCheckOut(
          {
            attendanceId: latest.attendanceId,
            checkOutAt: now,
            lat: input.lat,
            lng: input.lng,
            earlyLeaveMinutes: daily.earlyLeaveMinutes,
            status,
          },
          tx,
        ),
      );
      if (!updated) {
        throw AppError.conflict('Absen ini sudah ditutup (check-out atau penutupan otomatis). Muat ulang halaman.');
      }

      const jam = wibTimeOf(now);
      return {
        attendanceId: latest.attendanceId,
        rosterId: latest.rosterId,
        shiftDate: latest.shiftDate,
        shiftNama: latest.shiftNama,
        locationNama: latest.location.nama,
        checkInAt: latest.checkInAt.toISOString(),
        checkOutAt: now.toISOString(),
        status,
        lateMinutes: daily.lateMinutes,
        earlyLeaveMinutes: daily.earlyLeaveMinutes,
        workedMinutes: Math.floor((now.getTime() - latest.checkInAt.getTime()) / 60_000),
        distanceM: Math.round(distanceM),
        message:
          daily.earlyLeaveMinutes > 0
            ? `Check-out ${jam}, pulang ${daily.earlyLeaveMinutes} menit lebih awal`
            : `Check-out ${jam}`,
      };
    },
  };
}
