/**
 * Tinjauan HRD untuk absen tanpa QR (docs/alur.md 7.1b, aturan bisnis 13).
 * Antrean = absen berstatus tinjauan PENDING (hasil undian sampel acak). Hasil tinjauan TIDAK mengubah jam absen;
 * tindak lanjut lewat pengajuan koreksi. Setiap keputusan dicatat di audit log.
 * Aturan tambahan: peninjau tidak boleh meninjau absennya sendiri (ADMIN boleh), sama seperti persetujuan perangkat.
 */
import { AppError } from '../../core/errors';
import type { AuthUser } from '../../core/middleware/auth';
import type { ReviewDecision, ReviewStatus } from '../../core/risk-flags';
import type { AttendanceStatus } from '../../core/roles';
import type { AuditFn, TxRunner } from '../../core/service-deps';
import type { SelfieStorage } from './selfie-storage';

export interface ReviewSelfieRef {
  id: number;
  jenis: 'IN' | 'OUT';
  capturedAt: Date;
}

export interface ReviewQueueRow {
  attendanceId: number;
  nik: string;
  nama: string;
  shiftDate: string;
  shiftNama: string;
  locationNama: string;
  checkInAt: Date | null;
  checkOutAt: Date | null;
  checkInMethod: string;
  checkOutMethod: string | null;
  riskFlags: string | null;
  status: AttendanceStatus;
  lateMinutes: number;
  selfies: ReviewSelfieRef[];
}

export interface ReviewRepository {
  /** Absen berstatus PENDING (terlama dulu), lengkap dengan rujukan selfienya. */
  listPending(): Promise<ReviewQueueRow[]>;
  findReviewState(attendanceId: number): Promise<{ reviewStatus: ReviewStatus; employeeId: number } | null>;
  /** Ubah PENDING menjadi keputusan. False jika sudah tidak PENDING (keburu diubah). */
  markReviewed(
    data: { attendanceId: number; decision: ReviewDecision; reviewerUserId: number; reviewedAt: Date },
    tx?: unknown,
  ): Promise<boolean>;
  findSelfie(
    selfieId: number,
  ): Promise<{ id: number; attendanceId: number; jenis: 'IN' | 'OUT'; fileRef: string; expiresAt: Date } | null>;
}

export interface ReviewDeps {
  repo: ReviewRepository;
  storage: SelfieStorage;
  runInTransaction: TxRunner;
  audit: AuditFn;
  now?: () => Date;
}

/** Bentuk yang dikirim ke klien (tanggal sebagai ISO UTC). */
export interface ReviewQueueItem {
  attendanceId: number;
  nik: string;
  nama: string;
  shiftDate: string;
  shiftNama: string;
  locationNama: string;
  checkInAt: string | null;
  checkOutAt: string | null;
  checkInMethod: string;
  checkOutMethod: string | null;
  riskFlags: string[];
  status: AttendanceStatus;
  lateMinutes: number;
  selfies: { id: number; jenis: 'IN' | 'OUT'; capturedAt: string }[];
}

export function createReviewService(deps: ReviewDeps) {
  const { repo, storage, runInTransaction, audit } = deps;
  const clock = deps.now ?? (() => new Date());

  return {
    async listPending(): Promise<ReviewQueueItem[]> {
      const rows = await repo.listPending();
      return rows.map((r) => ({
        attendanceId: r.attendanceId,
        nik: r.nik,
        nama: r.nama,
        shiftDate: r.shiftDate,
        shiftNama: r.shiftNama,
        locationNama: r.locationNama,
        checkInAt: r.checkInAt ? r.checkInAt.toISOString() : null,
        checkOutAt: r.checkOutAt ? r.checkOutAt.toISOString() : null,
        checkInMethod: r.checkInMethod,
        checkOutMethod: r.checkOutMethod,
        riskFlags: r.riskFlags ? r.riskFlags.split(',').filter((f) => f !== '') : [],
        status: r.status,
        lateMinutes: r.lateMinutes,
        selfies: r.selfies.map((s) => ({ id: s.id, jenis: s.jenis, capturedAt: s.capturedAt.toISOString() })),
      }));
    },

    /** Byte JPEG satu selfie. Hanya untuk HRD/ADMIN (dijaga route). */
    async getSelfie(selfieId: number): Promise<{ bytes: Buffer }> {
      const selfie = await repo.findSelfie(selfieId);
      if (!selfie) throw AppError.notFound('Selfie tidak ditemukan.');
      if (selfie.expiresAt.getTime() <= clock().getTime()) {
        throw new AppError(410, 'SELFIE_EXPIRED', 'Selfie ini sudah lewat masa simpan dan akan/sudah dihapus.');
      }
      const bytes = await storage.read(selfie.fileRef);
      if (!bytes) throw AppError.notFound('File selfie tidak ditemukan.');
      return { bytes };
    },

    async mark(attendanceId: number, decision: ReviewDecision, user: AuthUser): Promise<void> {
      const state = await repo.findReviewState(attendanceId);
      if (!state) throw AppError.notFound('Absen tidak ditemukan.');
      if (state.employeeId === user.employeeId && user.role !== 'ADMIN') {
        throw AppError.forbidden('Kamu tidak bisa meninjau absenmu sendiri. Minta HRD atau ADMIN lain.');
      }
      if (state.reviewStatus !== 'PENDING') {
        throw AppError.conflict('Absen ini tidak sedang menunggu tinjauan.');
      }
      const reviewedAt = clock();
      await runInTransaction(async (tx) => {
        const ok = await repo.markReviewed({ attendanceId, decision, reviewerUserId: user.userId, reviewedAt }, tx);
        if (!ok) throw AppError.conflict('Absen ini sudah ditinjau orang lain. Muat ulang daftar.');
        await audit(
          {
            userId: user.userId,
            action: 'ATTENDANCE_REVIEW',
            entity: 'attendance',
            entityId: attendanceId,
            before: { reviewStatus: 'PENDING' },
            after: { reviewStatus: decision },
          },
          tx,
        );
      });
    },
  };
}
