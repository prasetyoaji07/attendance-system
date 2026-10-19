/**
 * GET /attendance/today: status Beranda karyawan (docs/api.md). HANYA MEMBACA: tidak ada transaksi, tidak ada audit log.
 * Dependensi disuntik supaya bisa di-unit-test tanpa DB; penyambungan ada di attendance.controller.ts.
 *
 * Roster yang diperiksa memakai tanggal mulai yang sama dengan check-in: kemarin, hari ini, dan besok (WIB).
 * Aturannya ada di utils/today-state.ts (pure).
 */
import type { AuthUser } from '../../core/middleware/auth';
import { addDays } from '../../utils/roster-rules';
import { resolveTodayState, wibDateOf, type TodayCandidate, type TodayResult } from '../../utils/today-state';

export interface TodayRepository {
  /** Roster karyawan pada tanggal-tanggal mulai shift yang diberikan, lengkap dengan shift, lokasi, dan absennya (jika ada). */
  findTodayCandidates(employeeId: number, shiftDates: string[]): Promise<TodayCandidate[]>;
}

export interface TodayDeps {
  repo: TodayRepository;
  /** Jam saat ini. Diganti di tes. */
  now?: () => Date;
}

export function createTodayService(deps: TodayDeps) {
  const { repo } = deps;
  const clock = deps.now ?? (() => new Date());

  return {
    async getToday(user: AuthUser): Promise<TodayResult> {
      const now = clock();
      const today = wibDateOf(now);
      const candidates = await repo.findTodayCandidates(user.employeeId, [addDays(today, -1), today, addDays(today, 1)]);
      return resolveTodayState(now, candidates);
    },
  };
}

export type TodayService = ReturnType<typeof createTodayService>;
