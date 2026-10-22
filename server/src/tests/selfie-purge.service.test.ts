import { describe, expect, it } from 'vitest';
import { createSelfiePurgeService, type ExpiredSelfie, type SelfiePurgeRepository } from '../modules/attendance/selfie-purge.service';
import type { SelfieStorage } from '../modules/attendance/selfie-storage';
import { createMemoryStorage, fakeJpegBytes } from './selfie-fixture';

const NOW = new Date('2026-04-10T00:00:00Z');
const day = (n: number) => new Date(NOW.getTime() + n * 86_400_000);

/** Repo palsu: hanya mengembalikan baris yang expires_at-nya sudah lewat. */
function fakeRepo(rows: { id: number; fileRef: string; expiresAt: Date }[]) {
  const deleted: number[] = [];
  const repo: SelfiePurgeRepository = {
    findExpired: async (now) =>
      rows.filter((r) => !deleted.includes(r.id) && r.expiresAt.getTime() <= now.getTime()).map((r): ExpiredSelfie => ({ id: r.id, fileRef: r.fileRef })),
    deleteByIds: async (ids) => {
      deleted.push(...ids);
    },
  };
  return { repo, deleted };
}

describe('pembersihan selfie yang lewat masa simpan', () => {
  it('menghapus file dan baris yang sudah kedaluwarsa, membiarkan yang belum', async () => {
    const storage = createMemoryStorage();
    for (const ref of ['a.jpg', 'b.jpg', 'c.jpg']) storage.files.set(ref, fakeJpegBytes(300));
    const { repo, deleted } = fakeRepo([
      { id: 1, fileRef: 'a.jpg', expiresAt: day(-1) },
      { id: 2, fileRef: 'b.jpg', expiresAt: day(0) }, // tepat sekarang = kedaluwarsa
      { id: 3, fileRef: 'c.jpg', expiresAt: day(5) },
    ]);
    const r = await createSelfiePurgeService({ repo, storage, now: () => NOW }).run();
    expect(r.deleted).toBe(2);
    expect(deleted.sort()).toEqual([1, 2]);
    expect([...storage.files.keys()]).toEqual(['c.jpg']);
  });

  it('tidak ada yang kedaluwarsa: 0 dihapus', async () => {
    const { repo } = fakeRepo([{ id: 1, fileRef: 'a.jpg', expiresAt: day(3) }]);
    const r = await createSelfiePurgeService({ repo, storage: createMemoryStorage(), now: () => NOW }).run();
    expect(r.deleted).toBe(0);
  });

  it('file gagal dihapus: barisnya dibiarkan, yang lain tetap diproses, dan tidak berputar tanpa akhir', async () => {
    const base = createMemoryStorage();
    base.files.set('ok.jpg', fakeJpegBytes(300));
    const storage: SelfieStorage = {
      ...base,
      remove: async (ref) => {
        if (ref === 'bad.jpg') throw new Error('izin ditolak');
        await base.remove(ref);
      },
    };
    const { repo, deleted } = fakeRepo([
      { id: 1, fileRef: 'bad.jpg', expiresAt: day(-2) },
      { id: 2, fileRef: 'ok.jpg', expiresAt: day(-2) },
    ]);
    const r = await createSelfiePurgeService({ repo, storage, now: () => NOW }).run();
    expect(r.deleted).toBe(1);
    expect(deleted).toEqual([2]);
  });
});
