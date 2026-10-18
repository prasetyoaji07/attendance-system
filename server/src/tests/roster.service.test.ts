import { describe, expect, it } from 'vitest';
import type { AuditEntry } from '../core/audit';
import type { AuthUser } from '../core/middleware/auth';
import {
  createRosterService,
  type PatternRecord,
  type RosterInsert,
  type RosterListItem,
  type RosterRepository,
  type RosterRow,
} from '../modules/roster/roster.service';
import type { ShiftRecord } from '../modules/shifts/shifts.service';

const hrd: AuthUser = { userId: 1, employeeId: 1, role: 'HRD' };
const karyawan: AuthUser = { userId: 5, employeeId: 5, role: 'EMPLOYEE' };

const shifts: ShiftRecord[] = [
  { id: 1, nama: 'pagi', jamMulai: '06:00', jamSelesai: '14:00', lintasHari: false, toleransiMenit: 5 },
  { id: 2, nama: 'siang', jamMulai: '14:00', jamSelesai: '22:00', lintasHari: false, toleransiMenit: 5 },
  { id: 3, nama: 'malam', jamMulai: '22:00', jamSelesai: '06:00', lintasHari: true, toleransiMenit: 5 },
];

function setup(opts: { patterns?: PatternRecord[]; rosters?: RosterRow[]; activeEmployees?: number[]; failInsertWithDup?: boolean } = {}) {
  const patterns: PatternRecord[] = opts.patterns ?? [
    { id: 1, nama: 'Cuma Pagi', urutan: ['pagi'] },
    { id: 2, nama: 'Pagi Libur', urutan: ['pagi', 'pagi', 'libur'] },
    { id: 3, nama: 'Siang Pagi (salah)', urutan: ['siang', 'pagi'] },
    { id: 4, nama: 'Ada Sore', urutan: ['sore'] },
    { id: 5, nama: 'Rotasi', urutan: ['pagi', 'siang'] },
  ];
  const rosters: RosterRow[] = [...(opts.rosters ?? [])];
  const inserted: RosterInsert[] = [];
  const audits: AuditEntry[] = [];
  const active = new Set(opts.activeEmployees ?? [1, 2, 3, 5]);
  let nextId = 100;
  let listFilter: { from: string; to: string; employeeId?: number } | null = null;

  const repo: RosterRepository = {
    findPatterns: async () => patterns,
    findPatternById: async (id) => patterns.find((p) => p.id === id) ?? null,
    insertPattern: async (d) => {
      if (patterns.some((p) => p.nama === d.nama)) throw Object.assign(new Error('dup'), { code: 'ER_DUP_ENTRY' });
      patterns.push({ id: nextId, ...d });
      return nextId++;
    },
    findActiveEmployeeIds: async (ids) => ids.filter((i) => active.has(i)),
    findRosters: async (ids, from, to) =>
      rosters.filter((r) => ids.includes(r.employeeId) && r.shiftDate >= from && r.shiftDate <= to),
    insertRosters: async (rows) => {
      if (opts.failInsertWithDup) throw Object.assign(new Error('dup'), { code: 'ER_DUP_ENTRY' });
      inserted.push(...rows);
    },
    list: async (f) => {
      listFilter = f;
      return [] as RosterListItem[];
    },
  };
  const service = createRosterService({
    repo,
    shifts: { findAll: async () => shifts },
    locations: { findById: async (id) => (id === 1 ? { id: 1, nama: 'Pabrik', lat: 0, lng: 0, radiusM: 100 } : null) },
    audit: async (e) => void audits.push(e),
    runInTransaction: (fn) => fn('tx'),
  });
  return { service, inserted, audits, patterns, getListFilter: () => listFilter };
}

const gen = (over: Record<string, unknown> = {}) => ({
  patternId: 2,
  locationId: 1,
  from: '2026-03-01',
  to: '2026-03-06',
  employees: [{ employeeId: 1 }],
  ...over,
});

describe('roster.generate', () => {
  it('membuat roster sesuai pola, hari libur dilewati, dan mencatat audit', async () => {
    const { service, inserted, audits } = setup();
    const r = await service.generate(gen(), hrd);
    expect(r).toMatchObject({ dryRun: false, created: 4, skipped: [] });
    expect(inserted.map((x) => x.shiftDate)).toEqual(['2026-03-01', '2026-03-02', '2026-03-04', '2026-03-05']);
    expect(inserted.every((x) => x.locationId === 1 && x.shiftId === 1)).toBe(true);
    expect(audits[0]).toMatchObject({ action: 'ROSTER_GENERATE', entity: 'rosters', entityId: '2026-03-01..2026-03-06' });
  });

  it('dryRun menghitung tanpa menyimpan dan tanpa audit', async () => {
    const { service, inserted, audits } = setup();
    const r = await service.generate(gen({ dryRun: true }), hrd);
    expect(r).toMatchObject({ dryRun: true, created: 4 });
    expect(inserted).toHaveLength(0);
    expect(audits).toHaveLength(0);
  });

  it('offset membedakan shift antar karyawan', async () => {
    const { service, inserted } = setup();
    await service.generate(
      gen({ patternId: 5, from: '2026-03-01', to: '2026-03-01', employees: [{ employeeId: 1 }, { employeeId: 2, offset: 1 }] }),
      hrd,
    );
    expect(inserted.find((x) => x.employeeId === 1)!.shiftId).toBe(1); // pagi
    expect(inserted.find((x) => x.employeeId === 2)!.shiftId).toBe(2); // siang
  });

  it('tanggal yang sudah punya roster dilewati dan dilaporkan, bukan ditimpa', async () => {
    const { service, inserted } = setup({ rosters: [{ id: 1, employeeId: 1, shiftDate: '2026-03-02', shiftId: 1, locationId: 1 }] });
    const r = await service.generate(gen(), hrd);
    expect(r.created).toBe(3);
    expect(r.skipped).toEqual([{ employeeId: 1, shiftDate: '2026-03-02' }]);
    expect(inserted.map((x) => x.shiftDate)).not.toContain('2026-03-02');
  });

  it('pola, lokasi tidak ada: 404', async () => {
    const { service } = setup();
    await expect(service.generate(gen({ patternId: 99 }), hrd)).rejects.toMatchObject({ status: 404 });
    await expect(service.generate(gen({ locationId: 99 }), hrd)).rejects.toMatchObject({ status: 404 });
  });

  it('pola memakai shift yang belum ada: 400 dan nama shift disebut', async () => {
    const { service } = setup();
    await expect(service.generate(gen({ patternId: 4 }), hrd)).rejects.toMatchObject({ status: 400 });
    await expect(service.generate(gen({ patternId: 4 }), hrd)).rejects.toThrow(/sore/);
  });

  it('karyawan tidak ada/nonaktif dan karyawan kembar: 400', async () => {
    const { service } = setup();
    await expect(service.generate(gen({ employees: [{ employeeId: 77 }] }), hrd)).rejects.toThrow(/#77/);
    await expect(service.generate(gen({ employees: [{ employeeId: 1 }, { employeeId: 1 }] }), hrd)).rejects.toMatchObject({ status: 400 });
  });

  it('jeda < 11 jam membatalkan SEMUA: 409 REST_VIOLATION, tidak ada yang tersimpan', async () => {
    const { service, inserted, audits } = setup();
    await expect(service.generate(gen({ patternId: 3 }), hrd)).rejects.toMatchObject({ status: 409, code: 'REST_VIOLATION' });
    expect(inserted).toHaveLength(0);
    expect(audits).toHaveLength(0);
  });

  it('pelanggaran menyertakan rincian di details', async () => {
    const { service } = setup();
    try {
      await service.generate(gen({ patternId: 3 }), hrd);
      throw new Error('seharusnya gagal');
    } catch (e) {
      const err = e as { details: { employeeId: number; restHours: number }[] };
      expect(err.details[0]).toMatchObject({ employeeId: 1, restHours: 8 });
    }
  });

  it('jeda dicek terhadap roster tetangga di luar rentang: siang 28 Feb (selesai 22:00) lalu pagi 1 Mar (06:00) = 8 jam, dilanggar', async () => {
    const { service } = setup({ rosters: [{ id: 1, employeeId: 1, shiftDate: '2026-02-28', shiftId: 2, locationId: 1 }] });
    await expect(service.generate(gen({ patternId: 1, from: '2026-03-01', to: '2026-03-01' }), hrd)).rejects.toMatchObject({ code: 'REST_VIOLATION' });
  });

  it('pelanggaran yang sudah ada di DB (bukan dari generate ini) tidak memblokir', async () => {
    const lama: RosterRow[] = [
      { id: 1, employeeId: 1, shiftDate: '2026-03-01', shiftId: 2, locationId: 1 }, // siang
      { id: 2, employeeId: 1, shiftDate: '2026-03-02', shiftId: 1, locationId: 1 }, // pagi, jeda 8 jam (sudah ada)
    ];
    const { service } = setup({
      rosters: lama,
      patterns: [{ id: 9, nama: 'Satu Pagi', urutan: ['libur', 'libur', 'libur', 'libur', 'pagi'] }],
    });
    const r = await service.generate(gen({ patternId: 9, from: '2026-03-01', to: '2026-03-05' }), hrd);
    expect(r.created).toBe(1);
  });

  it('bentrok UNIQUE saat insert (dua proses bersamaan): 409 pesan ramah', async () => {
    const { service } = setup({ failInsertWithDup: true });
    await expect(service.generate(gen(), hrd)).rejects.toMatchObject({ status: 409, code: 'CONFLICT' });
  });
});

describe('roster.list', () => {
  it('EMPLOYEE selalu dibatasi ke dirinya sendiri, query employeeId diabaikan', async () => {
    const { service, getListFilter } = setup();
    await service.list({ from: '2026-03-01', to: '2026-03-07', employeeId: 2 }, karyawan);
    expect(getListFilter()).toEqual({ from: '2026-03-01', to: '2026-03-07', employeeId: 5 });
  });

  it('HRD bisa memfilter karyawan lain atau melihat semua', async () => {
    const { service, getListFilter } = setup();
    await service.list({ from: '2026-03-01', to: '2026-03-07', employeeId: 2 }, hrd);
    expect(getListFilter()!.employeeId).toBe(2);
    await service.list({ from: '2026-03-01', to: '2026-03-07' }, hrd);
    expect(getListFilter()!.employeeId).toBeUndefined();
  });
});

describe('roster.createPattern', () => {
  it('menyimpan pola dan mencatat audit', async () => {
    const { service, audits } = setup();
    const p = await service.createPattern({ nama: '2-2', urutan: ['pagi', 'pagi', 'libur', 'libur'] }, hrd);
    expect(p.urutan).toHaveLength(4);
    expect(audits[0]).toMatchObject({ action: 'PATTERN_CREATE' });
  });

  it('shift tak dikenal, pola libur semua, nama kembar ditolak', async () => {
    const { service } = setup();
    await expect(service.createPattern({ nama: 'X', urutan: ['sore'] }, hrd)).rejects.toMatchObject({ status: 400 });
    await expect(service.createPattern({ nama: 'Y', urutan: ['libur', 'Libur'] }, hrd)).rejects.toMatchObject({ status: 400 });
    await expect(service.createPattern({ nama: 'Cuma Pagi', urutan: ['pagi'] }, hrd)).rejects.toMatchObject({ status: 409 });
  });
});
