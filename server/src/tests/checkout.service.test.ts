import { describe, expect, it } from 'vitest';
import { AppError } from '../core/errors';
import type { AuthUser } from '../core/middleware/auth';
import {
  createCheckOutService,
  type AttendanceRecord,
  type CheckOutRepository,
  type NewCheckOut,
} from '../modules/attendance/checkout.service';
import { signQr } from '../utils/hmac-qr';

const SECRET = 'x'.repeat(32);
const TTL = 45;
const user: AuthUser = { userId: 7, employeeId: 7, role: 'EMPLOYEE' };

// Lokasi fiktif radius 100 m. 0.0005 derajat lintang = sekitar 55 m, 0.001 = sekitar 111 m.
const LOC = { id: 1, nama: 'Pabrik A', lat: -6.2, lng: 106.8, radiusM: 100 };
const PAGI = { startTime: '06:00', endTime: '14:00', lateToleranceMinutes: 5 };
const MALAM = { startTime: '22:00', endTime: '06:00', lateToleranceMinutes: 5 };

const wib = (s: string) => new Date(`${s}+07:00`);

const attendance = (over: Partial<AttendanceRecord> = {}): AttendanceRecord => ({
  attendanceId: 500,
  rosterId: 40,
  shiftDate: '2026-10-18',
  shiftNama: 'Pagi',
  shift: PAGI,
  location: LOC,
  checkInAt: wib('2026-10-18T06:00:00'),
  checkOutAt: null,
  autoClosed: false,
  ...over,
});

function setup(opts: { latest: AttendanceRecord | null; now: string; updateResult?: boolean }) {
  const updates: NewCheckOut[] = [];
  const repo: CheckOutRepository = {
    findLatestAttendance: async () => opts.latest,
    updateCheckOut: async (d) => {
      updates.push(d);
      return opts.updateResult ?? true;
    },
  };
  const now = wib(opts.now);
  const service = createCheckOutService({
    repo,
    qrSecret: SECRET,
    qrTtlSeconds: TTL,
    runInTransaction: (fn) => fn(undefined),
    now: () => now,
  });
  const qr = (locationId = LOC.id, at = now.getTime()) => signQr(locationId, SECRET, TTL, at);
  const body = (over: Record<string, unknown> = {}) => ({ lat: -6.2, lng: 106.8, accuracyM: 10, qr: qr(), ...over }) as never;
  return { service, updates, now, qr, body };
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

describe('check-out: hasil normal', () => {
  it('pulang tepat jam selesai: HADIR, tanpa pulang cepat, data tersimpan', async () => {
    const t = setup({ latest: attendance(), now: '2026-10-18T14:00:00' });
    const r = await t.service.checkOut(t.body(), user);
    expect(r).toMatchObject({
      attendanceId: 500,
      rosterId: 40,
      shiftDate: '2026-10-18',
      locationNama: 'Pabrik A',
      status: 'HADIR',
      lateMinutes: 0,
      earlyLeaveMinutes: 0,
      workedMinutes: 480,
      distanceM: 0,
    });
    expect(r.checkOutAt).toBe(t.now.toISOString());
    expect(t.updates).toHaveLength(1);
    expect(t.updates[0]).toMatchObject({
      attendanceId: 500,
      lat: -6.2,
      lng: 106.8,
      earlyLeaveMinutes: 0,
      status: 'HADIR',
    });
    expect(t.updates[0].checkOutAt.getTime()).toBe(t.now.getTime());
  });

  it('pulang cepat: 12:00 untuk shift selesai 14:00 (toleransi 5) = 115 menit, status PULANG_CEPAT', async () => {
    const t = setup({ latest: attendance(), now: '2026-10-18T12:00:00' });
    const r = await t.service.checkOut(t.body(), user);
    expect(r.status).toBe('PULANG_CEPAT');
    expect(r.earlyLeaveMinutes).toBe(115);
    expect(r.message).toContain('115 menit lebih awal');
    expect(t.updates[0]).toMatchObject({ earlyLeaveMinutes: 115, status: 'PULANG_CEPAT' });
  });

  it('dalam toleransi bukan pulang cepat: 13:55 tepat dan 13:56 sama-sama HADIR', async () => {
    for (const jam of ['13:55:00', '13:56:00']) {
      const t = setup({ latest: attendance(), now: `2026-10-18T${jam}` });
      const r = await t.service.checkOut(t.body(), user);
      expect(r.earlyLeaveMinutes).toBe(0);
      expect(r.status).toBe('HADIR');
    }
  });

  it('13:54 sudah pulang cepat 1 menit', async () => {
    const t = setup({ latest: attendance(), now: '2026-10-18T13:54:00' });
    expect((await t.service.checkOut(t.body(), user)).earlyLeaveMinutes).toBe(1);
  });

  it('telat lalu pulang cepat: status tetap TELAT (prioritas), kedua menit dilaporkan', async () => {
    const t = setup({ latest: attendance({ checkInAt: wib('2026-10-18T06:20:00') }), now: '2026-10-18T12:00:00' });
    const r = await t.service.checkOut(t.body(), user);
    expect(r.status).toBe('TELAT');
    expect(r.lateMinutes).toBe(15);
    expect(r.earlyLeaveMinutes).toBe(115);
    expect(t.updates[0]).toMatchObject({ status: 'TELAT', earlyLeaveMinutes: 115 });
  });

  it('shift malam, check-out lewat tengah malam: tetap ke roster tanggal mulai (18 Okt)', async () => {
    const latest = attendance({
      shiftDate: '2026-10-18',
      shiftNama: 'Malam',
      shift: MALAM,
      checkInAt: wib('2026-10-18T22:03:00'),
    });
    const t = setup({ latest, now: '2026-10-19T06:02:00' });
    const r = await t.service.checkOut(t.body(), user);
    expect(r).toMatchObject({ shiftDate: '2026-10-18', status: 'HADIR', earlyLeaveMinutes: 0 });
    expect(r.workedMinutes).toBe(8 * 60 - 1);
  });

  it('shift malam pulang jam 02:00: pulang cepat dihitung dari 05:55 = 235 menit', async () => {
    const latest = attendance({ shift: MALAM, shiftNama: 'Malam', checkInAt: wib('2026-10-18T22:00:00') });
    const t = setup({ latest, now: '2026-10-19T02:00:00' });
    const r = await t.service.checkOut(t.body(), user);
    expect(r.earlyLeaveMinutes).toBe(235);
    expect(r.status).toBe('PULANG_CEPAT');
  });

  it('pesan tanpa pulang cepat menyebut jam WIB', async () => {
    const t = setup({ latest: attendance(), now: '2026-10-18T14:30:00' });
    expect((await t.service.checkOut(t.body(), user)).message).toBe('Check-out 14:30');
  });
});

describe('check-out: absen tidak ditemukan atau sudah selesai', () => {
  it('belum pernah check-in: 422 NO_OPEN_ATTENDANCE', async () => {
    const t = setup({ latest: null, now: '2026-10-18T14:00:00' });
    await expectError(t.service.checkOut(t.body(), user), 422, 'NO_OPEN_ATTENDANCE');
    expect(t.updates).toHaveLength(0);
  });

  it('sudah check-out dan masih dalam jendela: 409 CONFLICT', async () => {
    const t = setup({ latest: attendance({ checkOutAt: wib('2026-10-18T14:01:00') }), now: '2026-10-18T14:30:00' });
    const err = await expectError(t.service.checkOut(t.body(), user), 409, 'CONFLICT');
    expect(err.message).toContain('sudah check-out');
    expect(t.updates).toHaveLength(0);
  });

  it('check-out lama sudah jauh lewat jendela: dianggap tidak ada absen terbuka, bukan 409', async () => {
    const t = setup({ latest: attendance({ checkOutAt: wib('2026-10-18T14:01:00') }), now: '2026-10-18T16:01:00' });
    await expectError(t.service.checkOut(t.body(), user), 422, 'NO_OPEN_ATTENDANCE');
  });
});

describe('check-out: batas waktu (selesai + 2 jam)', () => {
  it('tepat 16:00:00 masih boleh', async () => {
    const t = setup({ latest: attendance(), now: '2026-10-18T16:00:00' });
    const r = await t.service.checkOut(t.body(), user);
    expect(r.status).toBe('HADIR');
  });

  it('16:00:01 ditolak: 422 CHECKOUT_WINDOW_CLOSED dan tidak ada yang ditulis', async () => {
    const t = setup({ latest: attendance(), now: '2026-10-18T16:00:01' });
    const err = await expectError(t.service.checkOut(t.body(), user), 422, 'CHECKOUT_WINDOW_CLOSED');
    expect(err.message).toContain('koreksi');
    expect(t.updates).toHaveLength(0);
  });

  it('absen yang sudah ditutup otomatis ditolak walau jam masih dalam jendela', async () => {
    const t = setup({ latest: attendance({ autoClosed: true }), now: '2026-10-18T14:30:00' });
    await expectError(t.service.checkOut(t.body(), user), 422, 'CHECKOUT_WINDOW_CLOSED');
  });
});

describe('check-out: validasi lokasi dan QR (sama dengan check-in)', () => {
  const at = '2026-10-18T13:00:00';

  it('akurasi GPS lemah: 422 GPS_ACCURACY_LOW', async () => {
    const t = setup({ latest: attendance(), now: at });
    await expectError(t.service.checkOut(t.body({ accuracyM: 80 }), user), 422, 'GPS_ACCURACY_LOW');
    expect(t.updates).toHaveLength(0);
  });

  it('di luar radius: 422 OUT_OF_RADIUS menyebut jarak', async () => {
    const t = setup({ latest: attendance(), now: at });
    const err = await expectError(t.service.checkOut(t.body({ lat: -6.201 }), user), 422, 'OUT_OF_RADIUS');
    expect(err.message).toContain('Pabrik A');
    expect(t.updates).toHaveLength(0);
  });

  it('dalam radius (sekitar 55 m dari titik) diterima', async () => {
    const t = setup({ latest: attendance(), now: at });
    const r = await t.service.checkOut(t.body({ lat: -6.2005 }), user);
    expect(r.distanceM).toBeGreaterThan(40);
    expect(r.distanceM).toBeLessThan(70);
  });

  it('QR rusak: 400 INVALID_QR', async () => {
    const t = setup({ latest: attendance(), now: at });
    await expectError(t.service.checkOut(t.body({ qr: 'rusak.token.palsu' }), user), 400, 'INVALID_QR');
    expect(t.updates).toHaveLength(0);
  });

  it('QR kedaluwarsa: 400 INVALID_QR dengan pesan kedaluwarsa', async () => {
    const t = setup({ latest: attendance(), now: at });
    const old = t.qr(LOC.id, t.now.getTime() - 5 * TTL * 1000);
    const err = await expectError(t.service.checkOut(t.body({ qr: old }), user), 400, 'INVALID_QR');
    expect(err.message).toContain('kedaluwarsa');
  });

  it('QR milik lokasi lain: 400 INVALID_QR', async () => {
    const t = setup({ latest: attendance(), now: at });
    await expectError(t.service.checkOut(t.body({ qr: t.qr(2) }), user), 400, 'INVALID_QR');
  });

  it('urutan pemeriksaan: akurasi lemah menang atas QR rusak', async () => {
    const t = setup({ latest: attendance(), now: at });
    await expectError(t.service.checkOut(t.body({ accuracyM: 80, qr: 'rusak.token.palsu' }), user), 422, 'GPS_ACCURACY_LOW');
  });

  it('absen terbuka dicek lebih dulu daripada GPS/QR: tanpa check-in, QR rusak pun hasilnya NO_OPEN_ATTENDANCE', async () => {
    const t = setup({ latest: null, now: at });
    await expectError(t.service.checkOut(t.body({ qr: 'rusak.token.palsu' }), user), 422, 'NO_OPEN_ATTENDANCE');
  });
});

describe('check-out: balapan', () => {
  it('UPDATE tidak mengenai baris (keburu check-out/auto-close): 409 CONFLICT', async () => {
    const t = setup({ latest: attendance(), now: '2026-10-18T13:00:00', updateResult: false });
    await expectError(t.service.checkOut(t.body(), user), 409, 'CONFLICT');
  });
});
