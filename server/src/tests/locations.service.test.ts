import { describe, expect, it } from 'vitest';
import type { AuthUser } from '../core/middleware/auth';
import type { AuditEntry } from '../core/audit';
import { createLocationsService, type LocationRecord, type LocationsRepository } from '../modules/locations/locations.service';

const hrd: AuthUser = { userId: 1, employeeId: 1, role: 'HRD' };
const pabrik: LocationRecord = { id: 1, nama: 'Pabrik Utama', lat: -6.3, lng: 107.15, radiusM: 100 };

function setup(rosterCount: Record<number, number> = {}) {
  const items = [{ ...pabrik }];
  const audits: AuditEntry[] = [];
  let nextId = 20;
  const repo: LocationsRepository = {
    findAll: async () => items,
    findById: async (id) => items.find((l) => l.id === id) ?? null,
    insert: async (d) => {
      if (items.some((l) => l.nama === d.nama)) throw Object.assign(new Error('dup'), { code: 'ER_DUP_ENTRY' });
      items.push({ id: nextId, ...d });
      return nextId++;
    },
    update: async (id, d) => void Object.assign(items.find((l) => l.id === id)!, d),
    remove: async (id) => void items.splice(items.findIndex((l) => l.id === id), 1),
    countRosters: async (id) => rosterCount[id] ?? 0,
  };
  const service = createLocationsService({ repo, audit: async (e) => void audits.push(e), runInTransaction: (fn) => fn('tx') });
  return { service, items, audits };
}

describe('locations', () => {
  it('create: radius default 100 m dari RULES', async () => {
    const { service, audits } = setup();
    const l = await service.create({ nama: 'Gudang', lat: -6.31, lng: 107.16 }, hrd);
    expect(l.radiusM).toBe(100);
    expect(audits[0]).toMatchObject({ action: 'LOCATION_CREATE' });
  });

  it('create: radius custom dipakai', async () => {
    const { service } = setup();
    const l = await service.create({ nama: 'Kantor', lat: 0, lng: 0, radiusM: 250 }, hrd);
    expect(l.radiusM).toBe(250);
  });

  it('create: nama kembar 409', async () => {
    const { service } = setup();
    await expect(service.create({ nama: 'Pabrik Utama', lat: 1, lng: 1 }, hrd)).rejects.toMatchObject({ status: 409 });
  });

  it('update parsial: field lain tetap, termasuk koordinat saat hanya radius diubah', async () => {
    const { service } = setup();
    const l = await service.update(1, { radiusM: 150 }, hrd);
    expect(l).toEqual({ id: 1, nama: 'Pabrik Utama', lat: -6.3, lng: 107.15, radiusM: 150 });
  });

  it('update: lat = 0 tidak dianggap kosong (bukan falsy bug)', async () => {
    const { service } = setup();
    const l = await service.update(1, { lat: 0, lng: 0 }, hrd);
    expect(l.lat).toBe(0);
    expect(l.lng).toBe(0);
  });

  it('delete: dipakai roster 409, belum dipakai berhasil', async () => {
    const used = setup({ 1: 5 });
    await expect(used.service.remove(1, hrd)).rejects.toMatchObject({ status: 409 });
    const free = setup();
    await free.service.remove(1, hrd);
    expect(free.items).toHaveLength(0);
    expect(free.audits[0]).toMatchObject({ action: 'LOCATION_DELETE' });
  });

  it('get id tidak ada: 404', async () => {
    const { service } = setup();
    await expect(service.get(99)).rejects.toMatchObject({ status: 404 });
  });
});
