import { describe, expect, it } from 'vitest';
import {
  checkDevice,
  decideRegistration,
  isValidDeviceId,
  planApproval,
  type DeviceRecord,
} from '../utils/device-binding';

const A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const C = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

const dev = (id: number, deviceId: string, status: 'active' | 'pending', userId = 1): DeviceRecord => ({
  id,
  userId,
  deviceId,
  status,
});

describe('isValidDeviceId', () => {
  it('menerima UUID dan string alfanumerik 16-64 karakter', () => {
    expect(isValidDeviceId(A)).toBe(true);
    expect(isValidDeviceId('abcdefghijklmnop')).toBe(true);
    expect(isValidDeviceId('a'.repeat(64))).toBe(true);
  });

  it('menolak yang terlalu pendek, terlalu panjang, berkarakter aneh, atau bukan string', () => {
    expect(isValidDeviceId('pendek')).toBe(false);
    expect(isValidDeviceId('a'.repeat(65))).toBe(false);
    expect(isValidDeviceId('abcdefghijklmno p')).toBe(false);
    expect(isValidDeviceId("abcdefghijklmnop'; DROP TABLE x;--")).toBe(false);
    expect(isValidDeviceId('')).toBe(false);
    expect(isValidDeviceId(undefined)).toBe(false);
    expect(isValidDeviceId(12345678901234567890)).toBe(false);
  });
});

describe('decideRegistration', () => {
  it('akun belum punya perangkat: perangkat pertama langsung active', () => {
    expect(decideRegistration([], A)).toEqual({ action: 'create', status: 'active', replaceId: null });
  });

  it('perangkat yang sama didaftarkan lagi: tidak ada perubahan, status lama dipertahankan', () => {
    expect(decideRegistration([dev(1, A, 'active')], A)).toEqual({ action: 'keep', status: 'active' });
    expect(decideRegistration([dev(1, A, 'active'), dev(2, B, 'pending')], B)).toEqual({ action: 'keep', status: 'pending' });
  });

  it('perangkat lain saat sudah ada active: pending, tanpa mengganti apa pun', () => {
    expect(decideRegistration([dev(1, A, 'active')], B)).toEqual({ action: 'create', status: 'pending', replaceId: null });
  });

  it('perangkat ketiga saat sudah ada pending: pending lama diganti (paling banyak satu pending)', () => {
    const existing = [dev(1, A, 'active'), dev(2, B, 'pending')];
    expect(decideRegistration(existing, C)).toEqual({ action: 'create', status: 'pending', replaceId: 2 });
  });

  it('akun hanya punya pending (active sudah tidak ada): tetap pending, bukan otomatis active', () => {
    expect(decideRegistration([dev(2, B, 'pending')], C)).toEqual({ action: 'create', status: 'pending', replaceId: 2 });
  });
});

describe('checkDevice (guard check-in dan check-out)', () => {
  const devices = [dev(1, A, 'active'), dev(2, B, 'pending')];

  it('perangkat active: lolos', () => {
    expect(checkDevice(A, devices)).toEqual({ ok: true });
  });

  it('header kosong atau tidak valid: DEVICE_REQUIRED', () => {
    for (const bad of [undefined, '', 'pendek', 123]) {
      expect(checkDevice(bad, devices)).toMatchObject({ ok: false, code: 'DEVICE_REQUIRED' });
    }
  });

  it('perangkat valid tetapi tidak terdaftar: DEVICE_NOT_REGISTERED', () => {
    expect(checkDevice(C, devices)).toMatchObject({ ok: false, code: 'DEVICE_NOT_REGISTERED' });
    expect(checkDevice(A, [])).toMatchObject({ ok: false, code: 'DEVICE_NOT_REGISTERED' });
  });

  it('perangkat pending: DEVICE_PENDING', () => {
    expect(checkDevice(B, devices)).toMatchObject({ ok: false, code: 'DEVICE_PENDING' });
  });

  it('pesan penolakan berbahasa Indonesia dan tidak kosong', () => {
    for (const d of [undefined, C, B]) {
      const r = checkDevice(d, devices);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.message.length).toBeGreaterThan(10);
    }
  });
});

describe('planApproval', () => {
  it('menghapus semua perangkat lain milik akun yang sama', () => {
    const target = dev(2, B, 'pending');
    expect(planApproval(target, [dev(1, A, 'active'), target, dev(3, C, 'pending')])).toEqual({ removeIds: [1, 3] });
  });

  it('tidak menyentuh perangkat milik akun lain', () => {
    const target = dev(2, B, 'pending', 1);
    expect(planApproval(target, [dev(1, A, 'active', 1), target, dev(9, C, 'active', 7)])).toEqual({ removeIds: [1] });
  });

  it('tidak ada perangkat lain: tidak ada yang dihapus', () => {
    const target = dev(2, B, 'pending');
    expect(planApproval(target, [target])).toEqual({ removeIds: [] });
  });
});
