import { describe, expect, it } from 'vitest';
import { AppError } from '../core/errors';
import type { AuthUser } from '../core/middleware/auth';
import { RULES } from '../core/rules';
import {
  createAttendanceService,
  type AttendanceRepository,
  type NewCheckIn,
  type RosterCandidate,
} from '../modules/attendance/attendance.service';
import { signQr } from '../utils/hmac-qr';
import { createMemoryStorage, fakeJpegBase64 } from './selfie-fixture';

const SECRET = 'x'.repeat(32);
const TTL = 45;
const user: AuthUser = { userId: 7, employeeId: 7, role: 'EMPLOYEE' };
const LOC = { id: 1, nama: 'Pabrik A', lat: -6.2, lng: 106.8, radiusM: 100 };
const PAGI = { startTime: '06:00', endTime: '14:00', lateToleranceMinutes: 5 };
const wib = (s: string) => new Date(`${s}+07:00`);

const roster = (over: Partial<RosterCandidate> = {}): RosterCandidate => ({
  rosterId: 11,
  shiftDate: '2026-03-02',
  shiftNama: 'Pagi',
  shift: PAGI,
  location: LOC,
  checkInAt: null,
  ...over,
});

function setup(opts: { rosters?: RosterCandidate[]; random?: number; insertError?: unknown } = {}) {
  const inserted: NewCheckIn[] = [];
  const storage = createMemoryStorage();
  const repo: AttendanceRepository = {
    findCandidates: async (_id, dates) => (opts.rosters ?? [roster()]).filter((r) => dates.includes(r.shiftDate)),
    insertCheckIn: async (d) => {
      if (opts.insertError) throw opts.insertError;
      inserted.push(d);
      return 900 + inserted.length;
    },
  };
  const now = wib('2026-03-02T06:00:00');
  const service = createAttendanceService({
    repo,
    qrSecret: SECRET,
    qrTtlSeconds: TTL,
    runInTransaction: (fn) => fn(undefined),
    selfieStorage: storage,
    random: () => opts.random ?? 0.99,
    now: () => now,
  });
  const qr = (locationId = LOC.id) => signQr(locationId, SECRET, TTL, now.getTime());
  /** Body jalur tanpa QR: tidak ada properti qr. */
  const noQr = (over: Record<string, unknown> = {}) =>
    ({ lat: -6.2, lng: 106.8, accuracyM: 10, selfie: fakeJpegBase64(), ...over }) as never;
  const withQr = (over: Record<string, unknown> = {}) => ({ lat: -6.2, lng: 106.8, accuracyM: 10, qr: qr(), ...over }) as never;
  return { service, inserted, storage, now, noQr, withQr, qr };
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

describe('check-in tanpa QR: hasil normal', () => {
  it('langsung sah: tersimpan dengan metode NO_QR, flag NO_QR, jam server, dan selfie', async () => {
    const t = setup();
    const r = await t.service.checkIn(t.noQr(), user);
    expect(r.status).toBe('HADIR');
    expect(r.method).toBe('NO_QR');
    expect(t.inserted).toHaveLength(1);
    const saved = t.inserted[0]!;
    expect(saved).toMatchObject({ method: 'NO_QR', riskFlags: 'NO_QR', checkInAt: t.now, rosterId: 11 });
    expect(saved.selfie).toBeDefined();
    expect(t.storage.files.has(saved.selfie!.fileRef)).toBe(true);
    expect(saved.selfie!.capturedAt).toEqual(t.now);
    expect(saved.selfie!.expiresAt.getTime() - t.now.getTime()).toBe(30 * 86_400_000);
  });

  it('telat tetap dihitung seperti biasa (shift mulai 05:40, jam server 06:00, toleransi 5 menit = telat 15)', async () => {
    const t = setup({ rosters: [roster({ shift: { startTime: '05:40', endTime: '13:40', lateToleranceMinutes: 5 } })] });
    const r = await t.service.checkIn(t.noQr(), user);
    expect(r.status).toBe('TELAT');
    expect(r.lateMinutes).toBe(15);
    expect(t.inserted[0]!.method).toBe('NO_QR');
  });
});

describe('check-in tanpa QR: undian tinjauan acak', () => {
  it(`angka undian < ${RULES.noQrReviewSampleRate}: review_status PENDING`, async () => {
    const t = setup({ random: 0.05 });
    await t.service.checkIn(t.noQr(), user);
    expect(t.inserted[0]!.reviewStatus).toBe('PENDING');
  });

  it('angka undian lebih besar: NOT_REQUIRED, dan tepat di batas 0.1 tidak terpilih', async () => {
    const a = setup({ random: 0.5 });
    await a.service.checkIn(a.noQr(), user);
    expect(a.inserted[0]!.reviewStatus).toBe('NOT_REQUIRED');
    const b = setup({ random: RULES.noQrReviewSampleRate });
    await b.service.checkIn(b.noQr(), user);
    expect(b.inserted[0]!.reviewStatus).toBe('NOT_REQUIRED');
  });

  it('absen tidak terpilih tetap berflag NO_QR (flag adalah penanda, bukan antrean)', async () => {
    const t = setup({ random: 0.9 });
    await t.service.checkIn(t.noQr(), user);
    expect(t.inserted[0]).toMatchObject({ riskFlags: 'NO_QR', reviewStatus: 'NOT_REQUIRED' });
  });
});

describe('check-in tanpa QR: selfie wajib dan valid', () => {
  it('tanpa selfie: 422 SELFIE_REQUIRED, tidak ada yang tersimpan', async () => {
    const t = setup();
    await expectError(t.service.checkIn(t.noQr({ selfie: undefined }), user), 422, 'SELFIE_REQUIRED');
    expect(t.inserted).toHaveLength(0);
    expect(t.storage.files.size).toBe(0);
  });

  it('selfie bukan JPEG: 422 SELFIE_INVALID, tidak ada yang tersimpan', async () => {
    const t = setup();
    await expectError(t.service.checkIn(t.noQr({ selfie: Buffer.alloc(1200, 1).toString('base64') }), user), 422, 'SELFIE_INVALID');
    expect(t.inserted).toHaveLength(0);
    expect(t.storage.files.size).toBe(0);
  });
});

describe('check-in tanpa QR: syarat lokasi tetap berlaku', () => {
  it('GPS lemah ditolak dan tidak ada selfie tersimpan', async () => {
    const t = setup();
    await expectError(t.service.checkIn(t.noQr({ accuracyM: 51 }), user), 422, 'GPS_ACCURACY_LOW');
    expect(t.storage.files.size).toBe(0);
  });

  it('di luar radius ditolak dan tidak ada selfie tersimpan', async () => {
    const t = setup();
    await expectError(t.service.checkIn(t.noQr({ lat: -6.199 }), user), 422, 'OUT_OF_RADIUS');
    expect(t.storage.files.size).toBe(0);
  });

  it('sudah check-in: 409 dan tidak ada selfie tersimpan', async () => {
    const t = setup({ rosters: [roster({ checkInAt: wib('2026-03-02T05:55:00') })] });
    await expectError(t.service.checkIn(t.noQr(), user), 409, 'CONFLICT');
    expect(t.storage.files.size).toBe(0);
  });

  it('tidak ada roster aktif: 422 NO_ACTIVE_ROSTER', async () => {
    const t = setup({ rosters: [] });
    await expectError(t.service.checkIn(t.noQr(), user), 422, 'NO_ACTIVE_ROSTER');
  });
});

describe('check-in: QR yang dikirim tidak dialihkan ke jalur tanpa QR (aturan 12)', () => {
  it('QR salah + selfie valid tetap 400 INVALID_QR, tidak ada yang tersimpan', async () => {
    const t = setup();
    await expectError(t.service.checkIn(t.noQr({ qr: 'asal-asalan' }), user), 400, 'INVALID_QR');
    expect(t.inserted).toHaveLength(0);
    expect(t.storage.files.size).toBe(0);
  });

  it('QR untuk lokasi lain + selfie tetap ditolak', async () => {
    const t = setup();
    await expectError(t.service.checkIn(t.noQr({ qr: t.qr(2) }), user), 400, 'INVALID_QR');
    expect(t.storage.files.size).toBe(0);
  });

  it('QR sah: jalur QR, selfie yang ikut terkirim diabaikan, tanpa flag dan tanpa tinjauan', async () => {
    const t = setup({ random: 0.01 });
    const r = await t.service.checkIn(t.withQr({ selfie: fakeJpegBase64() }), user);
    expect(r.method).toBe('QR');
    const saved = t.inserted[0]!;
    expect(saved).toMatchObject({ method: 'QR', riskFlags: null, reviewStatus: 'NOT_REQUIRED' });
    expect(saved.selfie).toBeUndefined();
    expect(t.storage.files.size).toBe(0);
  });
});

describe('check-in tanpa QR: kegagalan menyimpan', () => {
  it('error database: file selfie yang sudah ditulis dihapus lagi', async () => {
    const t = setup({ insertError: new Error('koneksi putus') });
    await expect(t.service.checkIn(t.noQr(), user)).rejects.toThrow('koneksi putus');
    expect(t.storage.files.size).toBe(0);
  });

  it('dua request bersamaan (ER_DUP_ENTRY): 409 dan file selfie dihapus', async () => {
    const t = setup({ insertError: Object.assign(new Error('dup'), { code: 'ER_DUP_ENTRY' }) });
    await expectError(t.service.checkIn(t.noQr(), user), 409, 'CONFLICT');
    expect(t.storage.files.size).toBe(0);
  });
});
