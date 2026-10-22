import { describe, expect, it } from 'vitest';
import type { AuditEntry } from '../core/audit';
import type { AuthUser } from '../core/middleware/auth';
import { createLocationSchema, updateLocationSchema } from '../modules/locations/locations.schema';
import { createLocationsService, type LocationRecord, type LocationsRepository } from '../modules/locations/locations.service';

const hrd: AuthUser = { userId: 1, employeeId: 1, role: 'HRD' };
const ALAMAT = 'Desa Pasirsari, Kec. Cikarang Selatan, Kab. Bekasi';

function setup(initial: Partial<LocationRecord> = {}) {
  const items: LocationRecord[] = [{ id: 1, nama: 'Pabrik Utama', lat: -6.3, lng: 107.15, radiusM: 100, ...initial }];
  const audits: AuditEntry[] = [];
  let nextId = 20;
  const repo: LocationsRepository = {
    findAll: async () => items,
    findById: async (id) => items.find((l) => l.id === id) ?? null,
    insert: async (d) => {
      items.push({ id: nextId, ...d });
      return nextId++;
    },
    update: async (id, d) => void Object.assign(items.find((l) => l.id === id)!, d),
    remove: async (id) => void items.splice(items.findIndex((l) => l.id === id), 1),
    countRosters: async () => 0,
  };
  const service = createLocationsService({ repo, audit: async (e) => void audits.push(e), runInTransaction: (fn) => fn('tx') });
  return { service, items, audits };
}

describe('locations: alamat', () => {
  it('create: alamat dirapikan (trim) dan ikut tercatat di audit log', async () => {
    const { service, audits } = setup();
    const l = await service.create({ nama: 'Gudang', lat: -6.31, lng: 107.16, alamat: `  ${ALAMAT}  ` }, hrd);
    expect(l.alamat).toBe(ALAMAT);
    expect(audits[0]).toMatchObject({ action: 'LOCATION_CREATE', after: { alamat: ALAMAT } });
  });

  it('create: alamat berisi spasi saja disimpan sebagai null', async () => {
    const { service } = setup();
    const l = await service.create({ nama: 'Gudang', lat: -6.31, lng: 107.16, alamat: '   ' }, hrd);
    expect(l.alamat).toBeNull();
  });

  it('create: tanpa alamat tetap berhasil', async () => {
    const { service } = setup();
    const l = await service.create({ nama: 'Gudang', lat: -6.31, lng: 107.16 }, hrd);
    expect(l.nama).toBe('Gudang');
    expect(l.alamat ?? null).toBeNull();
  });

  it('update: alamat diisi dan tercatat before/after', async () => {
    const { service, audits } = setup();
    const l = await service.update(1, { alamat: ALAMAT }, hrd);
    expect(l.alamat).toBe(ALAMAT);
    expect(audits[0]).toMatchObject({ action: 'LOCATION_UPDATE', after: { alamat: ALAMAT } });
  });

  it('update: field lain berubah, alamat lama dipertahankan', async () => {
    const { service } = setup({ alamat: ALAMAT });
    const l = await service.update(1, { radiusM: 150 }, hrd);
    expect(l.radiusM).toBe(150);
    expect(l.alamat).toBe(ALAMAT);
  });

  it('update: alamat null menghapus alamat', async () => {
    const { service } = setup({ alamat: ALAMAT });
    const l = await service.update(1, { alamat: null }, hrd);
    expect(l.alamat).toBeNull();
  });
});

describe('locations: alamat di skema', () => {
  const base = { nama: 'P', lat: 0, lng: 0 };

  it('create: alamat opsional, boleh ada', () => {
    expect(createLocationSchema.safeParse(base).success).toBe(true);
    expect(createLocationSchema.safeParse({ ...base, alamat: ALAMAT }).success).toBe(true);
  });

  it('create: alamat 201 karakter ditolak, 200 karakter lolos', () => {
    expect(createLocationSchema.safeParse({ ...base, alamat: 'a'.repeat(201) }).success).toBe(false);
    expect(createLocationSchema.safeParse({ ...base, alamat: 'a'.repeat(200) }).success).toBe(true);
  });

  it('update: hanya alamat sudah cukup', () => {
    expect(updateLocationSchema.safeParse({ alamat: ALAMAT }).success).toBe(true);
    expect(updateLocationSchema.safeParse({}).success).toBe(false);
  });
});
