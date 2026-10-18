/**
 * Penutupan otomatis absen yang check-in-nya ada tetapi check-out-nya tidak ada setelah batas waktu
 * (selesai shift + RULES.checkinWindowHoursAfter). Dependensi disuntik agar bisa di-unit-test tanpa DB.
 *
 * - check_out_at DIBIARKAN kosong: jam pulang tidak boleh dikarang.
 * - Baris ditandai auto_closed=1 dan needs_correction=1 (masuk antrean koreksi HRD, Fase 3).
 * - Idempoten: baris yang sudah ditutup tidak muncul lagi, dan UPDATE hanya mengenai baris yang masih terbuka.
 * - Tiap absen ditutup dalam transaksinya sendiri (update + audit), jadi satu kegagalan tidak menghentikan yang lain.
 */
import type { AuditFn, TxRunner } from '../../core/service-deps';
import { pickAutoCloseTargets, type OpenAttendanceRow } from '../../utils/auto-close';

export interface AutoCloseRepository {
  /** Semua absen yang sudah check-in, belum check-out, dan belum ditutup. */
  findOpen(): Promise<OpenAttendanceRow[]>;
  /** Tutup satu absen jika masih terbuka. false = tidak ada baris yang berubah (sudah check-out / sudah ditutup). */
  markAutoClosed(attendanceId: number, tx?: unknown): Promise<boolean>;
}

export interface AutoCloseDeps {
  repo: AutoCloseRepository;
  audit: AuditFn;
  runInTransaction: TxRunner;
  /** Jam saat ini. Diganti di tes. */
  now?: () => Date;
}

export interface AutoCloseResult {
  checked: number; // jumlah absen terbuka yang diperiksa
  due: number; // jumlah yang sudah lewat batas
  closed: number[]; // id yang berhasil ditutup
  failed: number[]; // id yang gagal ditutup (error DB)
}

export function createAutoCloseService(deps: AutoCloseDeps) {
  const { repo, audit, runInTransaction } = deps;
  const clock = deps.now ?? (() => new Date());

  return {
    /** Tutup yang sudah lewat batas pada waktu `at` (default: sekarang). */
    async run(at?: Date): Promise<AutoCloseResult> {
      const now = at ?? clock();
      const open = await repo.findOpen();
      const targets = pickAutoCloseTargets(now, open);

      const closed: number[] = [];
      const failed: number[] = [];
      for (const id of targets) {
        try {
          const changed = await runInTransaction(async (tx) => {
            const did = await repo.markAutoClosed(id, tx);
            if (did) {
              await audit(
                {
                  userId: null,
                  action: 'ATTENDANCE_AUTO_CLOSE',
                  entity: 'attendance',
                  entityId: id,
                  after: { autoClosed: true, needsCorrection: true },
                },
                tx,
              );
            }
            return did;
          });
          if (changed) closed.push(id);
        } catch {
          failed.push(id);
        }
      }
      return { checked: open.length, due: targets.length, closed, failed };
    },

    /** Daftar yang AKAN ditutup, tanpa menulis apa pun (untuk uji dan pemeriksaan). */
    async preview(at?: Date): Promise<{ checked: number; due: number[] }> {
      const open = await repo.findOpen();
      return { checked: open.length, due: pickAutoCloseTargets(at ?? clock(), open) };
    },
  };
}

export type AutoCloseService = ReturnType<typeof createAutoCloseService>;
