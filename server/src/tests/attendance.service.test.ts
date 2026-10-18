import { describe, expect, it } from 'vitest';
import { AppError } from '../core/errors';
import type { AuthUser } from '../core/middleware/auth';
import {
  createAttendanceService,
  type AttendanceRepository,
  type NewCheckIn,
  type RosterCandidate,
} from '../modules/attendance/attendance.service';
import { signQr } from '../utils/hmac-qr';

const SECRET = 'x'.repeat(32);
const TTL = 45;
const user: AuthUser = { userId: 7, employeeId: 7, role: 'EMPLOYEE' };

// Lokasi pabrik fiktif, radius 100 m. 0.0005 derajat lintang = sekitar 55 m, 0.001 = sekitar 111 m.
const LOC = { id: 1, nama: 'Pabrik A', lat: -6.2, lng: 106.8, radiusM: 100 };
const PAGI = { startTime: '06:00', endTime: '14:00', lateToleranceMinutes: 5 };
const MALAM = { startTime: '22:00', endTime: '06:00', lateToleranceMinutes: 5 };

/** Waktu WIB ke instan absolut. */
const wib = (s: string) => new Date(`${s}+07:00`);

const roster = (over: Partial<RosterCandidate> & { rosterId: number; shiftDate: string }): RosterCandidate => ({
  shiftNama: 'Pagi',
  shift: PAGI,
  location: LOC,
  checkInAt: null,
  ...over,
});

function setup(opts: { rosters: RosterCandidate[]; now: string; insertError?: unknown }) {
  const inserted: NewCheckIn[] = [];
  const asked: { employeeId: number; dates: string[] }[] = [];
  const repo: AttendanceRepository = {
    findCandidates: async (employeeId, dates) => {
      asked.push({ employeeId, dates });
      return opts.rosters.filter((r) => dates.includes(r.shiftDate));
    },
    insertCheckIn: async (d) => {
      if (opts.insertError) throw opts.insertError;
      inserted.push(d);
      return 900 + inserted.length;
    },
  };
  const now = wib(opts.now);
  const service = createAttendanceService({
    repo,
    qrSecret: SECRET,
    qrTtlSeconds: TTL,
    runInTransaction: (fn) => fn(undefined),
    now: () => now,
  });
  const qr = (locationId = LOC.id, at = now.getTime()) => signQr(locationId, SECRET, TTL, at);
  const body = (over: Record<string, unknown> = {}) => ({ lat: -6.2, lng: 106.8, accuracyM: 10, qr: qr(), ...over }) as never;
  return { service, inserted, asked, now, qr, body };
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

describe('check-in: hasil normal', () => {
  it('sebelum jam mulai: HADIR, telat 0', async () => {
    const t = setup({ rosters: [roster({ rosterId: 11, shiftDate: '2026-03-02' })], now: '2026-03-02T05:58:00' });
    const r = await t.service.checkIn(t.body(), user);
    expect(r.status).toBe('HADIR');
    expect(r.lateMinutes).toBe(0);
    expect(r.message).toBe('Check-in 05:58, tepat waktu');
    expect(t.inserted).toHaveLength(1);
    expect(t.inserted[0].rosterId).toBe(11);
  });

  it('dalam toleransi 5 menit: tetap HADIR', async () => {
    const t = setup({ rosters: [roster({ rosterId: 11, shiftDate: '2026-03-02' })], now: '2026-03-02T06:05:00' });
    const r = await t.service.checkIn(t.body(), user);
    expect(r.status).toBe('HADIR');
    expect(r.lateMinutes).toBe(0);
  });

  it('06:08 = telat 3 menit (rumus: sekarang - (mulai + toleransi))', async () => {
    const t = setup({ rosters: [roster({ rosterId: 11, shiftDate: '2026-03-02' })], now: '2026-03-02T06:08:00' });
    const r = await t.service.checkIn(t.body(), user);
    expect(r.status).toBe('TELAT');
    expect(r.lateMinutes).toBe(3);
    expect(r.message).toBe('Check-in 06:08, terlambat 3 menit');
    expect(t.inserted[0]).toMatchObject({ lateMinutes: 3, status: 'TELAT' });
  });

  it('menyimpan koordinat, akurasi, jarak (2 desimal), dan jam check-in', async () => {
    const t = setup({ rosters: [roster({ rosterId: 11, shiftDate: '2026-03-02' })], now: '2026-03-02T06:00:00' });
    await t.service.checkIn(t.body({ lat: -6.1995, lng: 106.8, accuracyM: 12.5 }), user);
    const saved = t.inserted[0];
    expect(saved).toMatchObject({ lat: -6.1995, lng: 106.8, accuracyM: 12.5, checkInAt: t.now });
    expect(saved.distanceM).toBeGreaterThan(50);
    expect(saved.distanceM).toBeLessThan(60);
    expect(Number.isInteger(saved.distanceM * 100) || Math.abs(saved.distanceM * 100 - Math.round(saved.distanceM * 100)) < 1e-6).toBe(true);
  });

  it('hanya mencari roster milik karyawan yang login', async () => {
    const t = setup({ rosters: [roster({ rosterId: 11, shiftDate: '2026-03-02' })], now: '2026-03-02T06:00:00' });
    await t.service.checkIn(t.body(), user);
    expect(t.asked[0].employeeId).toBe(7);
    expect(t.asked[0].dates).toEqual(['2026-03-01', '2026-03-02', '2026-03-03']);
  });
});

describe('check-in: roster aktif', () => {
  it('tidak ada roster: 422 NO_ACTIVE_ROSTER', async () => {
    const t = setup({ rosters: [], now: '2026-03-02T06:00:00' });
    await expectError(t.service.checkIn(t.body(), user), 422, 'NO_ACTIVE_ROSTER');
    expect(t.inserted).toHaveLength(0);
  });

  it('terlalu pagi (jendela baru buka 2 jam sebelum mulai): ditolak, tepat 2 jam: boleh', async () => {
    const early = setup({ rosters: [roster({ rosterId: 11, shiftDate: '2026-03-02' })], now: '2026-03-02T03:59:00' });
    await expectError(early.service.checkIn(early.body(), user), 422, 'NO_ACTIVE_ROSTER');
    const edge = setup({ rosters: [roster({ rosterId: 11, shiftDate: '2026-03-02' })], now: '2026-03-02T04:00:00' });
    expect((await edge.service.checkIn(edge.body(), user)).status).toBe('HADIR');
  });

  it('shift malam: check-in setelah tengah malam memakai roster KEMARIN', async () => {
    const t = setup({
      rosters: [roster({ rosterId: 21, shiftDate: '2026-03-01', shiftNama: 'Malam', shift: MALAM })],
      now: '2026-03-02T00:30:00',
    });
    const r = await t.service.checkIn(t.body(), user);
    expect(r.rosterId).toBe(21);
    expect(r.shiftDate).toBe('2026-03-01');
    expect(r.lateMinutes).toBe(145); // 22:00 + 5 menit toleransi -> 00:30 = 145 menit
    expect(r.status).toBe('TELAT');
  });

  it('shift malam: check-in 21:59 di hari mulainya = HADIR', async () => {
    const t = setup({
      rosters: [roster({ rosterId: 21, shiftDate: '2026-03-01', shiftNama: 'Malam', shift: MALAM })],
      now: '2026-03-01T21:59:00',
    });
    const r = await t.service.checkIn(t.body(), user);
    expect(r.status).toBe('HADIR');
  });

  it('shift yang mulai lewat tengah malam (roster besok) bisa check-in malam ini saat jendela terbuka', async () => {
    const dini = { startTime: '00:30', endTime: '08:30', lateToleranceMinutes: 5 };
    const t = setup({
      rosters: [roster({ rosterId: 31, shiftDate: '2026-03-02', shiftNama: 'Dini', shift: dini })],
      now: '2026-03-01T22:30:00',
    });
    const r = await t.service.checkIn(t.body(), user);
    expect(r.rosterId).toBe(31);
    expect(r.status).toBe('HADIR');
  });

  it('jendela tumpang tindih: sudah check-in malam, pagi hari ini tetap bisa check-in (dipilih yang mulainya terdekat)', async () => {
    const t = setup({
      rosters: [
        roster({ rosterId: 21, shiftDate: '2026-03-01', shiftNama: 'Malam', shift: MALAM, checkInAt: wib('2026-03-01T21:58:00') }),
        roster({ rosterId: 22, shiftDate: '2026-03-02', shiftNama: 'Pagi' }),
      ],
      now: '2026-03-02T05:30:00',
    });
    const r = await t.service.checkIn(t.body(), user);
    expect(r.rosterId).toBe(22);
    expect(r.status).toBe('HADIR');
  });

  it('sudah check-in untuk roster yang sama: 409', async () => {
    const t = setup({
      rosters: [roster({ rosterId: 11, shiftDate: '2026-03-02', checkInAt: wib('2026-03-02T05:55:00') })],
      now: '2026-03-02T06:10:00',
    });
    await expectError(t.service.checkIn(t.body(), user), 409, 'CONFLICT');
    expect(t.inserted).toHaveLength(0);
  });

  it('dua request bersamaan: UNIQUE(roster_id) di DB (ER_DUP_ENTRY) dijadikan 409', async () => {
    const t = setup({
      rosters: [roster({ rosterId: 11, shiftDate: '2026-03-02' })],
      now: '2026-03-02T06:00:00',
      insertError: Object.assign(new Error('dup'), { code: 'ER_DUP_ENTRY' }),
    });
    await expectError(t.service.checkIn(t.body(), user), 409, 'CONFLICT');
  });

  it('error DB lain tidak ditelan', async () => {
    const t = setup({
      rosters: [roster({ rosterId: 11, shiftDate: '2026-03-02' })],
      now: '2026-03-02T06:00:00',
      insertError: new Error('koneksi putus'),
    });
    await expect(t.service.checkIn(t.body(), user)).rejects.toThrow('koneksi putus');
  });
});

describe('check-in: GPS dan jarak', () => {
  const base = { rosters: [roster({ rosterId: 11, shiftDate: '2026-03-02' })], now: '2026-03-02T06:00:00' };

  it('akurasi 51 m ditolak, tepat 50 m diterima', async () => {
    const bad = setup(base);
    const err = await expectError(bad.service.checkIn(bad.body({ accuracyM: 51 }), user), 422, 'GPS_ACCURACY_LOW');
    expect(err.message).toContain('Sinyal GPS lemah');
    const edge = setup(base);
    expect((await edge.service.checkIn(edge.body({ accuracyM: 50 }), user)).status).toBe('HADIR');
  });

  it('di luar radius: 422 dengan jarak di pesan dan details', async () => {
    const t = setup(base);
    const err = await expectError(t.service.checkIn(t.body({ lat: -6.199 }), user), 422, 'OUT_OF_RADIUS');
    const d = err.details as { distanceM: number; radiusM: number };
    expect(d.radiusM).toBe(100);
    expect(d.distanceM).toBeGreaterThan(100);
    expect(err.message).toContain(`${d.distanceM} m`);
    expect(t.inserted).toHaveLength(0);
  });

  it('di dalam radius (sekitar 55 m) diterima', async () => {
    const t = setup(base);
    const r = await t.service.checkIn(t.body({ lat: -6.1995 }), user);
    expect(r.distanceM).toBeGreaterThan(50);
    expect(r.distanceM).toBeLessThan(60);
  });

  it('urutan: akurasi diperiksa sebelum jarak', async () => {
    const t = setup(base);
    await expectError(t.service.checkIn(t.body({ accuracyM: 80, lat: -6.1 }), user), 422, 'GPS_ACCURACY_LOW');
  });
});

describe('check-in: QR', () => {
  const base = { rosters: [roster({ rosterId: 11, shiftDate: '2026-03-02' })], now: '2026-03-02T06:00:00' };

  it('QR rusak, tanda tangan salah, atau kedaluwarsa: 400 INVALID_QR', async () => {
    const t = setup(base);
    await expectError(t.service.checkIn(t.body({ qr: 'asal-asalan' }), user), 400, 'INVALID_QR');
    await expectError(t.service.checkIn(t.body({ qr: '1.123.tandatanganpalsu12345' }), user), 400, 'INVALID_QR');
    const old = t.qr(LOC.id, t.now.getTime() - 3 * TTL * 1000);
    const err = await expectError(t.service.checkIn(t.body({ qr: old }), user), 400, 'INVALID_QR');
    expect(err.message).toContain('kedaluwarsa');
    expect(t.inserted).toHaveLength(0);
  });

  it('QR satu window sebelumnya masih diterima (toleransi saat QR berganti)', async () => {
    const t = setup(base);
    const prev = t.qr(LOC.id, t.now.getTime() - TTL * 1000);
    expect((await t.service.checkIn(t.body({ qr: prev }), user)).status).toBe('HADIR');
  });

  it('QR sah tetapi untuk lokasi lain: 400', async () => {
    const t = setup(base);
    const err = await expectError(t.service.checkIn(t.body({ qr: t.qr(2) }), user), 400, 'INVALID_QR');
    expect(err.message).toContain('Pabrik A');
  });

  it('QR ditandatangani dengan secret lain: ditolak', async () => {
    const t = setup(base);
    const forged = signQr(LOC.id, 'y'.repeat(32), TTL, t.now.getTime());
    await expectError(t.service.checkIn(t.body({ qr: forged }), user), 400, 'INVALID_QR');
  });

  it('urutan: jarak diperiksa sebelum QR', async () => {
    const t = setup(base);
    await expectError(t.service.checkIn(t.body({ lat: -6.199, qr: 'rusak' }), user), 422, 'OUT_OF_RADIUS');
  });
});
