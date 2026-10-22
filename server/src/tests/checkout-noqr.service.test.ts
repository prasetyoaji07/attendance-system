import { describe, expect, it } from 'vitest';
import { EARLY_LEAVE_REASONS } from '../core/early-leave-reasons';
import { AppError } from '../core/errors';
import type { AuthUser } from '../core/middleware/auth';
import { RULES } from '../core/rules';
import {
  createCheckOutService,
  type AttendanceRecord,
  type CheckOutRepository,
  type NewCheckOut,
} from '../modules/attendance/checkout.service';
import { signQr } from '../utils/hmac-qr';
import { createMemoryStorage, fakeJpegBase64 } from './selfie-fixture';

const SECRET = 'x'.repeat(32);
const TTL = 45;
const user: AuthUser = { userId: 7, employeeId: 7, role: 'EMPLOYEE' };
const LOC = { id: 1, nama: 'Pabrik A', lat: -6.2, lng: 106.8, radiusM: 100 };
const PAGI = { startTime: '06:00', endTime: '14:00', lateToleranceMinutes: 5 };
const wib = (s: string) => new Date(`${s}+07:00`);

const record = (over: Partial<AttendanceRecord> = {}): AttendanceRecord => ({
  attendanceId: 500,
  rosterId: 11,
  shiftDate: '2026-03-02',
  shiftNama: 'Pagi',
  shift: PAGI,
  location: LOC,
  checkInAt: wib('2026-03-02T05:58:00'),
  checkOutAt: null,
  autoClosed: false,
  ...over,
});

function setup(opts: { now?: string; updated?: boolean; updateError?: unknown; random?: number } = {}) {
  const updates: NewCheckOut[] = [];
  const storage = createMemoryStorage();
  const repo: CheckOutRepository = {
    findLatestAttendance: async () => record(),
    updateCheckOut: async (d) => {
      if (opts.updateError) throw opts.updateError;
      updates.push(d);
      return opts.updated ?? true;
    },
  };
  const now = wib(opts.now ?? '2026-03-02T15:00:00');
  const service = createCheckOutService({
    repo,
    qrSecret: SECRET,
    qrTtlSeconds: TTL,
    runInTransaction: (fn) => fn(undefined),
    selfieStorage: storage,
    random: () => opts.random ?? 0.99,
    now: () => now,
  });
  const qr = () => signQr(LOC.id, SECRET, TTL, now.getTime());
  const noQr = (over: Record<string, unknown> = {}) =>
    ({ lat: -6.2, lng: 106.8, accuracyM: 10, selfie: fakeJpegBase64(), ...over }) as never;
  const withQr = (over: Record<string, unknown> = {}) => ({ lat: -6.2, lng: 106.8, accuracyM: 10, qr: qr(), ...over }) as never;
  return { service, updates, storage, now, noQr, withQr };
}

async function expectError(p: Promise<unknown>, status: number, code: string) {
  const err = await p.then(
    () => null,
    (e: unknown) => e,
  );
  expect(err).toBeInstanceOf(AppError);
  expect((err as AppError).status).toBe(status);
  expect((err as AppError).code).toBe(code);
  return err as AppError;
}

describe('check-out tanpa QR: hasil normal', () => {
  it('sesudah jam selesai: sah, metode NO_QR, selfie OUT tersimpan, jam = jam server', async () => {
    const t = setup();
    const r = await t.service.checkOut(t.noQr(), user);
    expect(r.method).toBe('NO_QR');
    expect(r.status).toBe('HADIR');
    const saved = t.updates[0]!;
    expect(saved).toMatchObject({ attendanceId: 500, method: 'NO_QR', checkOutAt: t.now });
    expect(saved.selfie).toBeDefined();
    expect(t.storage.files.has(saved.selfie!.fileRef)).toBe(true);
    expect(saved.selfie!.expiresAt.getTime() - t.now.getTime()).toBe(RULES.selfieRetentionDays * 86_400_000);
  });

  it('undian: kecil = reviewPending true, besar = false', async () => {
    const a = setup({ random: 0.05 });
    await a.service.checkOut(a.noQr(), user);
    expect(a.updates[0]!.reviewPending).toBe(true);
    const b = setup({ random: 0.5 });
    await b.service.checkOut(b.noQr(), user);
    expect(b.updates[0]!.reviewPending).toBe(false);
  });

  it('pulang sebelum jam selesai tanpa alasan: tetap EARLY_LEAVE_REASON_REQUIRED, belum ada yang tersimpan', async () => {
    const t = setup({ now: '2026-03-02T13:00:00' });
    await expectError(t.service.checkOut(t.noQr(), user), 422, 'EARLY_LEAVE_REASON_REQUIRED');
    expect(t.storage.files.size).toBe(0);
  });

  it('pulang sebelum jam selesai dengan alasan: sah, alasan tersimpan, selfie tersimpan', async () => {
    const t = setup({ now: '2026-03-02T13:00:00' });
    const r = await t.service.checkOut(t.noQr({ earlyLeaveReason: EARLY_LEAVE_REASONS[0] }), user);
    expect(r.earlyLeaveReason).toBe(EARLY_LEAVE_REASONS[0]);
    expect(t.updates[0]!.earlyLeaveReason).toBe(EARLY_LEAVE_REASONS[0]);
    expect(t.storage.files.size).toBe(1);
  });
});

describe('check-out tanpa QR: selfie dan syarat lokasi', () => {
  it('tanpa selfie: 422 SELFIE_REQUIRED', async () => {
    const t = setup();
    await expectError(t.service.checkOut(t.noQr({ selfie: undefined }), user), 422, 'SELFIE_REQUIRED');
    expect(t.updates).toHaveLength(0);
  });

  it('selfie bukan JPEG: 422 SELFIE_INVALID', async () => {
    const t = setup();
    await expectError(t.service.checkOut(t.noQr({ selfie: Buffer.alloc(1200, 1).toString('base64') }), user), 422, 'SELFIE_INVALID');
  });

  it('GPS lemah dan di luar radius tetap ditolak tanpa menyimpan selfie', async () => {
    const t = setup();
    await expectError(t.service.checkOut(t.noQr({ accuracyM: 80 }), user), 422, 'GPS_ACCURACY_LOW');
    await expectError(t.service.checkOut(t.noQr({ lat: -6.199 }), user), 422, 'OUT_OF_RADIUS');
    expect(t.storage.files.size).toBe(0);
  });
});

describe('check-out: QR yang dikirim tidak dialihkan ke jalur tanpa QR (aturan 12)', () => {
  it('QR salah + selfie valid tetap 400 INVALID_QR', async () => {
    const t = setup();
    await expectError(t.service.checkOut(t.noQr({ qr: 'asal-asalan' }), user), 400, 'INVALID_QR');
    expect(t.storage.files.size).toBe(0);
  });

  it('QR sah: jalur QR, tanpa selfie dan tanpa tinjauan walau undian kecil', async () => {
    const t = setup({ random: 0.01 });
    const r = await t.service.checkOut(t.withQr({ selfie: fakeJpegBase64() }), user);
    expect(r.method).toBe('QR');
    expect(t.updates[0]).toMatchObject({ method: 'QR', reviewPending: false });
    expect(t.updates[0]!.selfie).toBeUndefined();
    expect(t.storage.files.size).toBe(0);
  });
});

describe('check-out tanpa QR: kegagalan menyimpan', () => {
  it('absen keburu ditutup (update false): 409 dan file selfie dihapus', async () => {
    const t = setup({ updated: false });
    await expectError(t.service.checkOut(t.noQr(), user), 409, 'CONFLICT');
    expect(t.storage.files.size).toBe(0);
  });

  it('error database: file selfie dihapus lagi', async () => {
    const t = setup({ updateError: new Error('koneksi putus') });
    await expect(t.service.checkOut(t.noQr(), user)).rejects.toThrow('koneksi putus');
    expect(t.storage.files.size).toBe(0);
  });
});
