/**
 * Hapus selfie yang sudah lewat masa simpan (30 hari). Jalankan dari folder server:
 *   npx tsx scripts/purge-selfies.ts
 */
import { pool } from '../src/core/db';
import { selfiePurgeRepository } from '../src/modules/attendance/selfie.repository';
import { selfieStorage } from '../src/modules/attendance/selfie-runtime';
import { createSelfiePurgeService } from '../src/modules/attendance/selfie-purge.service';

async function main() {
  const service = createSelfiePurgeService({ repo: selfiePurgeRepository, storage: selfieStorage });
  const { deleted } = await service.run();
  console.log(`Selfie dihapus: ${deleted}`);
}

main()
  .catch((err) => {
    console.error('Gagal membersihkan selfie:', err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
