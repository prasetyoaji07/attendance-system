/**
 * Logika bisnis check-out (docs/alur.md 7.1/7.1b/7.2). Dependensi disuntik supaya bisa di-unit-test tanpa DB;
 * penyambungan ada di attendance.controller.ts.
 *
 * Beda dengan check-in: yang dicari adalah ABSEN TERAKHIR milik karyawan (bukan roster lewat jendela),
 * supaya shift malam yang lewat tengah malam tetap menempel ke roster tanggal mulainya.
 *
 * Urutan: absen terakhir -> sudah check-out? -> masih dalam batas waktu? -> akurasi GPS -> jarak -> QR (jika dikirim)
 *         -> alasan pulang awal (jika belum jam selesai) -> selfie (jika tanpa QR) -> hitung pulang cepat + status -> simpan.
 * Batas waktu = selesai shift + RULES.checkinWindowHoursAfter. Lewat itu, absen perlu koreksi lewat HRD.
 *
 * Alasan pulang awal (C0b): server yang memutuskan dari jam server. Sekarang < jam selesai shift persis
 * (isBeforeShiftEnd, sama dengan `checkOut.early` di GET /attendance/today) -> alasan WAJIB. Sudah jam selesai
 * atau lewat -> alasan yang dikirim diabaikan (disimpan null). Alasan tidak mengubah status; PULANG_CEPAT
 * tetap dari computeDailyStatus (selesai dikurangi toleransi).
 *
 * Jalur tanpa QR (7.1b): sama seperti check-in. Check-out tanpa QR memberi flag NO_QR dan boleh memicu tinjauan
 * (undian acak); absen yang sudah berstatus tinjauan tidak diturunkan lagi.
 */
import { AppError } from '../../core/errors';
import type { EarlyLeaveReason } from '../../core/early-leave-reasons';
import type { AuthUser } from '../../core/middleware/auth';
import type { CheckMethod } from '../../core/risk-flags';
import type { AttendanceStatus } from '../../core/roles';
import { RULES } from '../../core/rules';
import type { TxRunner } from '../../core/service-deps';
import { isPastCloseDeadline } from '../../utils/auto-close';
import { computeDailyStatus } from '../../utils/daily-status';
import { buildShiftWindow, isBeforeShiftEnd, type ShiftDef } from '../../utils/shift-time';
import type { CheckOutInput } from './attendance.schema';
import { assertPresence, type PresenceLocation } from './presence';
import { decodeSelfie, selfieExpiry, type NewSelfie } from './selfie';
import type { SelfieStorage } from './selfie-storage';

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
  /** Null jika check-out tidak sebelum jam selesai shift. */
  earlyLeaveReason: EarlyLeaveReason | null;
  status: AttendanceStatus;
  /** Jalur absen pulang. Kosong dianggap 'QR'. */
  method?: CheckMethod;
  /** True jika undian memilih absen ini untuk tinjauan (hanya berefek bila status tinjauan masih NOT_REQUIRED). */
  reviewPending?: boolean;
  /** Ada hanya di jalur tanpa QR; ditulis ke attendance_selfies (jenis OUT) di transaksi yang sama. */
  selfie?: NewSelfie;
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
  /** Wajib ada agar jalur tanpa QR bisa dipakai. */
  selfieStorage?: SelfieStorage;
  /** Pengundi tinjauan acak, hasil 0 sampai <1. Diganti di tes. */
  random?: () => number;
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
  /** Alasan yang tersimpan; null jika check-out tidak sebelum jam selesai shift. */
  earlyLeaveReason: EarlyLeaveReason | null;
  workedMinutes: number;
  distanceM: number;
  method: CheckMethod;
  message: string;
}

const noOpenAttendance = () =>
  new AppError(422, 'NO_OPEN_ATTENDANCE', 'Kamu belum check-in, jadi belum bisa check-out.');

export function createCheckOutService(deps: CheckOutDeps) {
  const { repo, qrSecret, qrTtlSeconds, runInTransaction, selfieStorage } = deps;
  const clock = deps.now ?? (() => new Date());
  const random = deps.random ?? Math.random;

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

      // 4-6) Akurasi GPS, jarak ke lokasi, dan QR dinamis (QR hanya diperiksa jika dikirim; sama dengan check-in).
      const { distanceM } = assertPresence(input, latest.location, now, { secret: qrSecret, ttlSeconds: qrTtlSeconds });

      // 7) Alasan pulang awal: wajib jika sekarang belum jam selesai shift; kalau sudah, alasan yang dikirim diabaikan.
      const beforeEnd = isBeforeShiftEnd(now, window);
      if (beforeEnd && !input.earlyLeaveReason) {
        throw new AppError(
          422,
          'EARLY_LEAVE_REASON_REQUIRED',
          `Kamu pulang sebelum jam selesai shift (${wibTimeOf(window.endsAt)}). Pilih alasan pulang lebih awal dulu ya.`,
        );
      }
      const earlyLeaveReason: EarlyLeaveReason | null = beforeEnd ? (input.earlyLeaveReason ?? null) : null;

      // 7b) Jalur tanpa QR: selfie wajib dan harus JPEG yang wajar (gagal cepat, belum ada yang disimpan).
      const method: CheckMethod = input.qr === undefined ? 'NO_QR' : 'QR';
      const selfieBytes = method === 'NO_QR' ? decodeSelfie(input.selfie) : null;

      // 8) Pulang cepat dan status dari satu fungsi yang sama dengan check-in dan penutupan harian.
      const daily = computeDailyStatus({
        now,
        window,
        toleranceMinutes: latest.shift.lateToleranceMinutes,
        attendance: { checkInAt: latest.checkInAt, checkOutAt: now },
      });
      const status = daily.status ?? 'HADIR';

      // 8b) Simpan file selfie (jika ada). Dibersihkan lagi kalau penyimpanan ke database gagal.
      let selfie: NewSelfie | undefined;
      if (selfieBytes) {
        if (!selfieStorage) throw new Error('selfieStorage belum disuntik ke check-out service');
        selfie = { fileRef: await selfieStorage.save(selfieBytes), capturedAt: now, expiresAt: selfieExpiry(now) };
      }
      const discardSelfie = async () => {
        if (selfie && selfieStorage) await selfieStorage.remove(selfie.fileRef).catch(() => undefined);
      };
      const reviewPending = method === 'NO_QR' && random() < RULES.noQrReviewSampleRate;

      // 9) Simpan. Kondisi di UPDATE menangkap dua request bersamaan atau auto-close yang menyalip.
      let updated: boolean;
      try {
        updated = await runInTransaction((tx) =>
          repo.updateCheckOut(
            {
              attendanceId: latest.attendanceId,
              checkOutAt: now,
              lat: input.lat,
              lng: input.lng,
              earlyLeaveMinutes: daily.earlyLeaveMinutes,
              earlyLeaveReason,
              status,
              method,
              reviewPending,
              ...(selfie ? { selfie } : {}),
            },
            tx,
          ),
        );
      } catch (err) {
        await discardSelfie();
        throw err;
      }
      if (!updated) {
        await discardSelfie();
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
        earlyLeaveReason,
        workedMinutes: Math.floor((now.getTime() - latest.checkInAt.getTime()) / 60_000),
        distanceM: Math.round(distanceM),
        method,
        message:
          daily.earlyLeaveMinutes > 0
            ? `Check-out ${jam}, pulang ${daily.earlyLeaveMinutes} menit lebih awal`
            : `Check-out ${jam}`,
      };
    },
  };
}
