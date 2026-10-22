/**
 * Hapus selfie yang sudah lewat masa simpan (RULES.selfieRetentionDays). File dihapus dulu, baru barisnya;
 * kalau file gagal dihapus, barisnya dibiarkan supaya dicoba lagi pada jalan berikutnya.
 * Dijalankan manual lewat scripts/purge-selfies.ts.
 */
import type { SelfieStorage } from './selfie-storage';

export interface ExpiredSelfie {
  id: number;
  fileRef: string;
}

export interface SelfiePurgeRepository {
  /** Satu gelombang selfie yang expires_at-nya <= now. */
  findExpired(now: Date): Promise<ExpiredSelfie[]>;
  deleteByIds(ids: number[]): Promise<void>;
}

export interface SelfiePurgeDeps {
  repo: SelfiePurgeRepository;
  storage: SelfieStorage;
  now?: () => Date;
}

export function createSelfiePurgeService(deps: SelfiePurgeDeps) {
  const { repo, storage } = deps;
  const clock = deps.now ?? (() => new Date());

  return {
    async run(): Promise<{ deleted: number }> {
      let deleted = 0;
      for (;;) {
        const batch = await repo.findExpired(clock());
        if (batch.length === 0) break;
        const doneIds: number[] = [];
        for (const row of batch) {
          try {
            await storage.remove(row.fileRef);
            doneIds.push(row.id);
          } catch {
            // Dibiarkan; baris ini muncul lagi pada jalan berikutnya.
          }
        }
        if (doneIds.length === 0) break; // tidak ada kemajuan, hindari putaran tanpa akhir
        await repo.deleteByIds(doneIds);
        deleted += doneIds.length;
      }
      return { deleted };
    },
  };
}
