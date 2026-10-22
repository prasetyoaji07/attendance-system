import { describe, expect, it } from 'vitest';
import { AppError } from '../core/errors';
import type { AuthUser } from '../core/middleware/auth';
import type { ReviewStatus } from '../core/risk-flags';
import type { AuditEntry } from '../core/audit';
import { createReviewService, type ReviewQueueRow, type ReviewRepository } from '../modules/attendance/review.service';
import { createMemoryStorage, fakeJpegBytes } from './selfie-fixture';

const hrd: AuthUser = { userId: 1, employeeId: 1, role: 'HRD' };
const admin: AuthUser = { userId: 2, employeeId: 2, role: 'ADMIN' };
const NOW = new Date('2026-03-10T00:00:00Z');

const queueRow = (over: Partial<ReviewQueueRow> = {}): ReviewQueueRow => ({
  attendanceId: 500,
  nik: 'SIM0014',
  nama: 'Indah Hidayat',
  shiftDate: '2026-03-02',
  shiftNama: 'Siang',
  locationNama: 'Pabrik A',
  checkInAt: new Date('2026-03-02T06:58:00Z'),
  checkOutAt: null,
  checkInMethod: 'NO_QR',
  checkOutMethod: null,
  riskFlags: 'NO_QR',
  status: 'HADIR',
  lateMinutes: 0,
  selfies: [{ id: 70, jenis: 'IN', capturedAt: new Date('2026-03-02T06:58:00Z') }],
  ...over,
});

function setup(
  opts: {
    queue?: ReviewQueueRow[];
    state?: { reviewStatus: ReviewStatus; employeeId: number } | null;
    marked?: boolean;
    selfie?: { id: number; attendanceId: number; jenis: 'IN' | 'OUT'; fileRef: string; expiresAt: Date } | null;
  } = {},
) {
  const marks: { attendanceId: number; decision: string; reviewerUserId: number; reviewedAt: Date }[] = [];
  const audits: AuditEntry[] = [];
  const storage = createMemoryStorage();
  const repo: ReviewRepository = {
    listPending: async () => opts.queue ?? [],
    findReviewState: async () => (opts.state === undefined ? { reviewStatus: 'PENDING', employeeId: 14 } : opts.state),
    markReviewed: async (d) => {
      marks.push(d);
      return opts.marked ?? true;
    },
    findSelfie: async () => (opts.selfie === undefined ? null : opts.selfie),
  };
  const service = createReviewService({
    repo,
    storage,
    runInTransaction: (fn) => fn(undefined),
    audit: async (e) => {
      audits.push(e);
    },
    now: () => NOW,
  });
  return { service, marks, audits, storage };
}

async function expectError(p: Promise<unknown>, status: number, code: string) {
  const err = await p.then(
    () => null,
    (e: unknown) => e,
  );
  expect(err).toBeInstanceOf(AppError);
  expect((err as AppError).status).toBe(status);
  expect((err as AppError).code).toBe(code);
}

describe('daftar antrean tinjauan', () => {
  it('mengubah tanggal ke ISO dan flag ke larik', async () => {
    const t = setup({ queue: [queueRow()] });
    const [item] = await t.service.listPending();
    expect(item).toMatchObject({
      attendanceId: 500,
      nik: 'SIM0014',
      riskFlags: ['NO_QR'],
      checkInAt: '2026-03-02T06:58:00.000Z',
      checkOutAt: null,
    });
    expect(item!.selfies).toEqual([{ id: 70, jenis: 'IN', capturedAt: '2026-03-02T06:58:00.000Z' }]);
  });

  it('flag kosong jadi larik kosong; antrean kosong jadi larik kosong', async () => {
    const t = setup({ queue: [queueRow({ riskFlags: null })] });
    expect((await t.service.listPending())[0]!.riskFlags).toEqual([]);
    expect(await setup().service.listPending()).toEqual([]);
  });
});

describe('menandai hasil tinjauan', () => {
  it('SESUAI: tersimpan dengan peninjau dan waktu server, dan tercatat di audit log', async () => {
    const t = setup();
    await t.service.mark(500, 'SESUAI', hrd);
    expect(t.marks[0]).toEqual({ attendanceId: 500, decision: 'SESUAI', reviewerUserId: 1, reviewedAt: NOW });
    expect(t.audits[0]).toMatchObject({
      userId: 1,
      action: 'ATTENDANCE_REVIEW',
      entity: 'attendance',
      entityId: 500,
      before: { reviewStatus: 'PENDING' },
      after: { reviewStatus: 'SESUAI' },
    });
  });

  it('MENCURIGAKAN juga bisa; tidak ada perubahan jam absen (repo hanya menerima keputusan)', async () => {
    const t = setup();
    await t.service.mark(500, 'MENCURIGAKAN', admin);
    expect(t.marks[0]!.decision).toBe('MENCURIGAKAN');
    expect(Object.keys(t.marks[0]!).sort()).toEqual(['attendanceId', 'decision', 'reviewedAt', 'reviewerUserId']);
  });

  it('absen tidak ada: 404', async () => {
    await expectError(setup({ state: null }).service.mark(999, 'SESUAI', hrd), 404, 'NOT_FOUND');
  });

  it('absen yang tidak PENDING (sudah ditinjau / tidak perlu): 409, tidak ada yang ditulis', async () => {
    for (const reviewStatus of ['NOT_REQUIRED', 'SESUAI', 'MENCURIGAKAN'] as const) {
      const t = setup({ state: { reviewStatus, employeeId: 14 } });
      await expectError(t.service.mark(500, 'SESUAI', hrd), 409, 'CONFLICT');
      expect(t.marks).toHaveLength(0);
      expect(t.audits).toHaveLength(0);
    }
  });

  it('HRD tidak boleh meninjau absennya sendiri (403); ADMIN boleh', async () => {
    const own = { reviewStatus: 'PENDING' as const, employeeId: 1 };
    await expectError(setup({ state: own }).service.mark(500, 'SESUAI', hrd), 403, 'FORBIDDEN');
    const t = setup({ state: { reviewStatus: 'PENDING', employeeId: 2 } });
    await t.service.mark(500, 'SESUAI', admin);
    expect(t.marks).toHaveLength(1);
  });

  it('keburu ditinjau orang lain (update 0 baris): 409 dan audit tidak ditulis', async () => {
    const t = setup({ marked: false });
    await expectError(t.service.mark(500, 'SESUAI', hrd), 409, 'CONFLICT');
    expect(t.audits).toHaveLength(0);
  });
});

describe('melihat selfie', () => {
  const selfieRow = (over: Partial<{ expiresAt: Date; fileRef: string }> = {}) => ({
    id: 70,
    attendanceId: 500,
    jenis: 'IN' as const,
    fileRef: 'mem-1.jpg',
    expiresAt: new Date('2026-04-01T00:00:00Z'),
    ...over,
  });

  it('mengembalikan byte file', async () => {
    const t = setup({ selfie: selfieRow() });
    const bytes = fakeJpegBytes(800);
    t.storage.files.set('mem-1.jpg', bytes);
    expect((await t.service.getSelfie(70)).bytes.equals(bytes)).toBe(true);
  });

  it('selfie tidak ada di database: 404', async () => {
    await expectError(setup({ selfie: null }).service.getSelfie(70), 404, 'NOT_FOUND');
  });

  it('lewat masa simpan: 410 SELFIE_EXPIRED walau file masih ada', async () => {
    const t = setup({ selfie: selfieRow({ expiresAt: new Date('2026-03-09T00:00:00Z') }) });
    t.storage.files.set('mem-1.jpg', fakeJpegBytes(800));
    await expectError(t.service.getSelfie(70), 410, 'SELFIE_EXPIRED');
  });

  it('file hilang di penyimpanan: 404', async () => {
    await expectError(setup({ selfie: selfieRow() }).service.getSelfie(70), 404, 'NOT_FOUND');
  });
});
