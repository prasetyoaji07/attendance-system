import { describe, expect, it } from 'vitest';
import type { AuthUser } from '../core/middleware/auth';
import type { AuditEntry } from '../core/audit';
import { createShiftsService, type ShiftRecord, type ShiftsRepository } from '../modules/shifts/shifts.service';

const hrd: AuthUser = { userId: 1, employeeId: 1, role: 'HRD' };

const pagi: ShiftRecord = { id: 1, nama: 'Pagi', jamMulai: '07:00', jamSelesai: '15:00', lintasHari: false, toleransiMenit: 5 };

function setup(seed: ShiftRecord[] = [pagi], rosterCount: Record<number, number> = {}) {
  const shifts = seed.map((s) => ({ ...s }));
  const audits: AuditEntry[] = [];
  let nextId = 50;
  const repo: ShiftsRepository = {
    findAll: async () => shifts,
    findById: async (id) => shifts.find((s) => s.id === id) ?? null,
    insert: async (d) => {
      if (shifts.some((s) => s.nama === d.nama)) throw Object.assign(new Error('dup'), { code: 'ER_DUP_ENTRY' });
      shifts.push({ id: nextId, ...d });
      return nextId++;
    },
    update: async (id, d) => {
      if (shifts.some((s) => s.id !== id && s.nama === d.nama)) throw Object.assign(new Error('dup'), { code: 'ER_DUP_ENTRY' });
      Object.assign(shifts.find((s) => s.id === id)!, d);
    },
    remove: async (id) => {
      shifts.splice(shifts.findIndex((s) => s.id === id), 1);
    },
    countRosters: async (id) => rosterCount[id] ?? 0,
  };
  const service = createShiftsService({
    repo,
    audit: async (e) => void audits.push(e),
    runInTransaction: (fn) => fn('tx'),
  });
  return { service, shifts, audits };
}

describe('shifts.create', () => {
  it('shift malam otomatis lintasHari = true, toleransi default dari RULES (5)', async () => {
    const { service, audits } = setup();
    const s = await service.create({ nama: 'Malam', jamMulai: '22:00', jamSelesai: '06:00' }, hrd);
    expect(s.lintasHari).toBe(true);
    expect(s.toleransiMenit).toBe(5);
    expect(audits[0]).toMatchObject({ action: 'SHIFT_CREATE', entity: 'shifts', userId: 1 });
  });

  it('shift normal lintasHari = false dan toleransi custom dipakai', async () => {
    const { service } = setup();
    const s = await service.create({ nama: 'Siang', jamMulai: '15:00', jamSelesai: '23:00', toleransiMenit: 10 }, hrd);
    expect(s.lintasHari).toBe(false);
    expect(s.toleransiMenit).toBe(10);
  });

  it('nama kembar: 409 dengan pesan ramah', async () => {
    const { service } = setup();
    await expect(service.create({ nama: 'Pagi', jamMulai: '08:00', jamSelesai: '16:00' }, hrd)).rejects.toMatchObject({
      status: 409,
      code: 'CONFLICT',
    });
  });
});

describe('shifts.update', () => {
  it('ubah nama dan toleransi shift yang sudah dipakai roster: boleh', async () => {
    const { service, audits } = setup([pagi], { 1: 12 });
    const s = await service.update(1, { nama: 'Pagi A', toleransiMenit: 3 }, hrd);
    expect(s).toMatchObject({ nama: 'Pagi A', toleransiMenit: 3, jamMulai: '07:00' });
    expect(audits[0]).toMatchObject({ action: 'SHIFT_UPDATE' });
  });

  it('ubah jam shift yang sudah dipakai roster: 409', async () => {
    const { service } = setup([pagi], { 1: 12 });
    await expect(service.update(1, { jamMulai: '08:00' }, hrd)).rejects.toMatchObject({ status: 409 });
  });

  it('ubah jam shift yang belum dipakai: lintasHari dihitung ulang', async () => {
    const { service } = setup();
    const s = await service.update(1, { jamMulai: '22:00', jamSelesai: '06:00' }, hrd);
    expect(s.lintasHari).toBe(true);
  });

  it('jam mulai = jam selesai setelah digabung dengan data lama: 400', async () => {
    const { service } = setup();
    await expect(service.update(1, { jamSelesai: '07:00' }, hrd)).rejects.toMatchObject({ status: 400 });
  });

  it('id tidak ada: 404', async () => {
    const { service } = setup();
    await expect(service.update(999, { nama: 'X' }, hrd)).rejects.toMatchObject({ status: 404 });
  });
});

describe('shifts.remove', () => {
  it('shift yang dipakai roster tidak bisa dihapus (409) dan data tetap ada', async () => {
    const { service, shifts, audits } = setup([pagi], { 1: 3 });
    await expect(service.remove(1, hrd)).rejects.toMatchObject({ status: 409 });
    expect(shifts).toHaveLength(1);
    expect(audits).toHaveLength(0);
  });

  it('shift yang belum dipakai bisa dihapus dan tercatat di audit', async () => {
    const { service, shifts, audits } = setup();
    await service.remove(1, hrd);
    expect(shifts).toHaveLength(0);
    expect(audits[0]).toMatchObject({ action: 'SHIFT_DELETE', entityId: 1 });
  });
});
