import { describe, expect, it } from 'vitest';
import type { AuditEntry } from '../core/audit';
import type { AuthUser } from '../core/middleware/auth';
import type { TxRunner } from '../core/service-deps';
import { createDevicesService, type DevicesRepository, type PendingDevice } from '../modules/devices/devices.service';
import type { DeviceRecord, DeviceStatus } from '../utils/device-binding';

const A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const C = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

const budi: AuthUser = { userId: 1, employeeId: 10, role: 'EMPLOYEE' };
const hrd: AuthUser = { userId: 2, employeeId: 20, role: 'HRD' };
const admin: AuthUser = { userId: 3, employeeId: 30, role: 'ADMIN' };

const dev = (id: number, userId: number, deviceId: string, status: DeviceStatus): DeviceRecord => ({
  id,
  userId,
  deviceId,
  status,
});

function setup(initial: DeviceRecord[] = [], opts: { duplicateOnInsert?: boolean } = {}) {
  const rows = [...initial];
  const audits: AuditEntry[] = [];
  let nextId = 100;
  let dupPending = opts.duplicateOnInsert ?? false;

  const repo: DevicesRepository = {
    findByUser: async (userId) => rows.filter((r) => r.userId === userId).map((r) => ({ ...r })),
    findById: async (id) => {
      const r = rows.find((x) => x.id === id);
      return r ? { ...r } : null;
    },
    insert: async (userId, deviceId, status) => {
      const id = nextId++;
      if (dupPending) {
        // Permintaan lain untuk perangkat yang sama menang lebih dulu, lalu insert kita bentrok.
        dupPending = false;
        rows.push({ id, userId, deviceId, status });
        throw Object.assign(new Error('Duplicate entry'), { code: 'ER_DUP_ENTRY' });
      }
      rows.push({ id, userId, deviceId, status });
      return id;
    },
    remove: async (ids) => {
      for (const id of ids) {
        const i = rows.findIndex((r) => r.id === id);
        if (i >= 0) rows.splice(i, 1);
      }
    },
    activate: async (id) => {
      const r = rows.find((x) => x.id === id);
      if (r) r.status = 'active';
    },
    listPending: async (): Promise<PendingDevice[]> =>
      rows
        .filter((r) => r.status === 'pending')
        .map((r) => ({ id: r.id, userId: r.userId, nik: `N${r.userId}`, nama: `User ${r.userId}`, departmentNama: 'Produksi', requestedAt: '2026-10-19T00:00:00.000Z' })),
  };
  const runInTransaction: TxRunner = (fn) => fn(undefined);
  const service = createDevicesService({ repo, audit: async (e) => void audits.push(e), runInTransaction });
  return { service, rows, audits };
}

describe('devices.register', () => {
  it('perangkat pertama akun: active, tercatat audit DEVICE_REGISTER', async () => {
    const { service, rows, audits } = setup();
    const r = await service.register(A, budi);
    expect(r).toMatchObject({ status: 'active', created: true });
    expect(rows).toEqual([{ id: 100, userId: 1, deviceId: A, status: 'active' }]);
    expect(audits).toHaveLength(1);
    expect(audits[0]).toMatchObject({ userId: 1, action: 'DEVICE_REGISTER', entity: 'devices', entityId: 100 });
  });

  it('didaftarkan lagi (idempotent): tidak ada baris atau audit baru', async () => {
    const { service, rows, audits } = setup([dev(1, 1, A, 'active')]);
    const r = await service.register(A, budi);
    expect(r).toMatchObject({ status: 'active', created: false });
    expect(rows).toHaveLength(1);
    expect(audits).toHaveLength(0);
  });

  it('perangkat kedua: pending, perangkat lama tetap active, tercatat DEVICE_REQUEST', async () => {
    const { service, rows, audits } = setup([dev(1, 1, A, 'active')]);
    const r = await service.register(B, budi);
    expect(r).toMatchObject({ status: 'pending', created: true });
    expect(rows.map((x) => [x.deviceId, x.status])).toEqual([[A, 'active'], [B, 'pending']]);
    expect(audits[0]).toMatchObject({ action: 'DEVICE_REQUEST' });
  });

  it('perangkat ketiga saat ada pending: pending lama diganti, hanya satu pending tersisa', async () => {
    const { service, rows } = setup([dev(1, 1, A, 'active'), dev(2, 1, B, 'pending')]);
    await service.register(C, budi);
    expect(rows.map((x) => [x.deviceId, x.status])).toEqual([[A, 'active'], [C, 'pending']]);
  });

  it('perangkat akun lain tidak ikut dihitung (setiap akun mulai dari nol)', async () => {
    const { service } = setup([dev(1, 2, A, 'active')]);
    const r = await service.register(A, budi);
    expect(r).toMatchObject({ status: 'active', created: true });
  });

  it('ID perangkat tidak valid: 400', async () => {
    const { service } = setup();
    await expect(service.register('pendek', budi)).rejects.toMatchObject({ status: 400 });
    await expect(service.register(undefined, budi)).rejects.toMatchObject({ status: 400 });
  });

  it('dua permintaan serentak untuk perangkat yang sama: yang kalah tidak error, membaca hasil pemenang', async () => {
    const { service, rows } = setup([], { duplicateOnInsert: true });
    const r = await service.register(A, budi);
    expect(r).toMatchObject({ status: 'active', created: false });
    expect(rows).toHaveLength(1);
  });
});

describe('devices.me', () => {
  it('mengembalikan status perangkat yang sedang dipakai dan daftar perangkat milik sendiri', async () => {
    const { service } = setup([dev(1, 1, A, 'active'), dev(2, 1, B, 'pending'), dev(3, 2, C, 'active')]);
    const r = await service.me(B, budi);
    expect(r.current).toBe('pending');
    expect(r.devices).toEqual([
      { id: 1, status: 'active', current: false },
      { id: 2, status: 'pending', current: true },
    ]);
  });

  it('perangkat belum terdaftar atau header kosong: unregistered', async () => {
    const { service } = setup([dev(1, 1, A, 'active')]);
    expect((await service.me(C, budi)).current).toBe('unregistered');
    expect((await service.me(undefined, budi)).current).toBe('unregistered');
  });

  it('ID perangkat mentah tidak pernah ikut dikembalikan', async () => {
    const { service } = setup([dev(1, 1, A, 'active')]);
    expect(JSON.stringify(await service.me(A, budi))).not.toContain(A);
  });
});

describe('devices.approve', () => {
  it('pending jadi active, perangkat lama dihapus, tercatat DEVICE_CHANGE', async () => {
    const { service, rows, audits } = setup([dev(1, 1, A, 'active'), dev(2, 1, B, 'pending')]);
    const r = await service.approve(2, hrd);
    expect(r).toEqual({ id: 2, userId: 1, replacedDevices: 1 });
    expect(rows).toEqual([{ id: 2, userId: 1, deviceId: B, status: 'active' }]);
    expect(audits).toHaveLength(1);
    expect(audits[0]).toMatchObject({
      userId: 2,
      action: 'DEVICE_CHANGE',
      entityId: 2,
      before: { removedDeviceIds: [1] },
      after: { userId: 1, status: 'active' },
    });
  });

  it('tidak menyentuh perangkat milik akun lain', async () => {
    const { service, rows } = setup([dev(1, 1, A, 'active'), dev(2, 1, B, 'pending'), dev(3, 9, C, 'active')]);
    await service.approve(2, hrd);
    expect(rows.some((r) => r.id === 3)).toBe(true);
  });

  it('permintaan tidak ada: 404', async () => {
    const { service } = setup();
    await expect(service.approve(99, hrd)).rejects.toMatchObject({ status: 404 });
  });

  it('perangkat yang sudah active: 409, tanpa audit', async () => {
    const { service, audits } = setup([dev(1, 1, A, 'active')]);
    await expect(service.approve(1, hrd)).rejects.toMatchObject({ status: 409 });
    expect(audits).toHaveLength(0);
  });

  it('HRD tidak boleh menyetujui perangkatnya sendiri: 403', async () => {
    const { service, rows } = setup([dev(1, 2, A, 'active'), dev(2, 2, B, 'pending')]);
    await expect(service.approve(2, hrd)).rejects.toMatchObject({ status: 403 });
    expect(rows.find((r) => r.id === 2)!.status).toBe('pending');
  });

  it('ADMIN boleh menyetujui perangkatnya sendiri (tercatat audit)', async () => {
    const { service, audits } = setup([dev(1, 3, A, 'active'), dev(2, 3, B, 'pending')]);
    await service.approve(2, admin);
    expect(audits[0]).toMatchObject({ userId: 3, action: 'DEVICE_CHANGE' });
  });
});

describe('devices.reject', () => {
  it('menghapus permintaan pending, perangkat active tetap, tercatat DEVICE_REJECT', async () => {
    const { service, rows, audits } = setup([dev(1, 1, A, 'active'), dev(2, 1, B, 'pending')]);
    await service.reject(2, hrd);
    expect(rows.map((r) => r.id)).toEqual([1]);
    expect(audits[0]).toMatchObject({ userId: 2, action: 'DEVICE_REJECT', entityId: 2 });
  });

  it('tidak ada: 404. Sudah active: 409 dan tidak dihapus', async () => {
    const { service, rows } = setup([dev(1, 1, A, 'active')]);
    await expect(service.reject(99, hrd)).rejects.toMatchObject({ status: 404 });
    await expect(service.reject(1, hrd)).rejects.toMatchObject({ status: 409 });
    expect(rows).toHaveLength(1);
  });
});

describe('devices.listPending', () => {
  it('hanya berisi permintaan pending', async () => {
    const { service } = setup([dev(1, 1, A, 'active'), dev(2, 1, B, 'pending')]);
    const list = await service.listPending();
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ id: 2, userId: 1, nik: 'N1' });
  });
});

describe('devices.assertUsable (guard check-in dan check-out)', () => {
  const rows = [dev(1, 1, A, 'active'), dev(2, 1, B, 'pending'), dev(3, 2, C, 'active')];

  it('perangkat active milik akun: lolos', async () => {
    const { service } = setup(rows);
    await expect(service.assertUsable(1, A)).resolves.toBeUndefined();
  });

  it('header kosong: 403 DEVICE_REQUIRED', async () => {
    const { service } = setup(rows);
    await expect(service.assertUsable(1, undefined)).rejects.toMatchObject({ status: 403, code: 'DEVICE_REQUIRED' });
  });

  it('perangkat pending: 403 DEVICE_PENDING', async () => {
    const { service } = setup(rows);
    await expect(service.assertUsable(1, B)).rejects.toMatchObject({ status: 403, code: 'DEVICE_PENDING' });
  });

  it('perangkat belum terdaftar: 403 DEVICE_NOT_REGISTERED', async () => {
    const { service } = setup(rows);
    const unknown = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
    await expect(service.assertUsable(1, unknown)).rejects.toMatchObject({ status: 403, code: 'DEVICE_NOT_REGISTERED' });
  });

  it('perangkat active milik AKUN LAIN tidak bisa dipakai (pinjam-akun ditolak)', async () => {
    const { service } = setup(rows);
    await expect(service.assertUsable(1, C)).rejects.toMatchObject({ status: 403, code: 'DEVICE_NOT_REGISTERED' });
  });
});
