/**
 * FASE 2: penutupan otomatis absen tanpa check-out. Logika ada di
 * modules/attendance/auto-close.service.ts; file ini hanya menyambungkan ke DB dan menjadwalkan.
 */
import { auditFn, runInTransaction } from '../core/db-helpers';
import { autoCloseRepository } from '../modules/attendance/checkout.repository';
import { createAutoCloseService, type AutoCloseResult } from '../modules/attendance/auto-close.service';

export const autoCloseService = createAutoCloseService({
  repo: autoCloseRepository,
  audit: auditFn,
  runInTransaction,
});

/** Dipanggil cron. Tidak pernah melempar error supaya cron tetap hidup. */
export async function runAutoClose(): Promise<AutoCloseResult | null> {
  try {
    const r = await autoCloseService.run();
    if (r.closed.length > 0 || r.failed.length > 0) {
      console.log(
        `[auto-close] ${r.closed.length} ditutup, ${r.failed.length} gagal, dari ${r.checked} absen terbuka`,
      );
    }
    return r;
  } catch (err) {
    console.error('[auto-close] gagal', err);
    return null;
  }
}
