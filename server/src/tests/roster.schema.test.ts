import { describe, expect, it } from 'vitest';
import { createPatternSchema, generateRosterSchema, listRosterQuerySchema } from '../modules/roster/roster.schema';

const valid = { patternId: 1, locationId: 1, from: '2026-03-01', to: '2026-03-31', employees: [{ employeeId: 1 }] };

describe('generateRosterSchema', () => {
  it('input wajar lolos, offset dan dryRun opsional', () => {
    expect(generateRosterSchema.safeParse(valid).success).toBe(true);
    expect(generateRosterSchema.safeParse({ ...valid, dryRun: true, employees: [{ employeeId: 2, offset: 3 }] }).success).toBe(true);
  });

  it('rentang maksimal 62 hari inklusif: 62 hari lolos, 63 hari ditolak', () => {
    expect(generateRosterSchema.safeParse({ ...valid, from: '2026-03-01', to: '2026-05-01' }).success).toBe(true); // 62 hari
    expect(generateRosterSchema.safeParse({ ...valid, from: '2026-03-01', to: '2026-05-02' }).success).toBe(false); // 63 hari
  });

  it('tanggal akhir sebelum awal, tanggal palsu, dan karyawan kosong ditolak', () => {
    expect(generateRosterSchema.safeParse({ ...valid, from: '2026-03-10', to: '2026-03-01' }).success).toBe(false);
    expect(generateRosterSchema.safeParse({ ...valid, to: '2026-02-30' }).success).toBe(false);
    expect(generateRosterSchema.safeParse({ ...valid, employees: [] }).success).toBe(false);
  });

  it('offset negatif dan id bukan bilangan bulat positif ditolak', () => {
    expect(generateRosterSchema.safeParse({ ...valid, employees: [{ employeeId: 1, offset: -1 }] }).success).toBe(false);
    expect(generateRosterSchema.safeParse({ ...valid, patternId: 0 }).success).toBe(false);
  });
});

describe('listRosterQuerySchema', () => {
  it('employeeId datang sebagai string dari query dan diubah ke angka', () => {
    const r = listRosterQuerySchema.parse({ from: '2026-03-01', to: '2026-03-07', employeeId: '5' });
    expect(r.employeeId).toBe(5);
  });
  it('from dan to wajib', () => {
    expect(listRosterQuerySchema.safeParse({ from: '2026-03-01' }).success).toBe(false);
  });
    it('tanggal palsu ditolak sebagai error validasi, bukan exception', () => {
    expect(listRosterQuerySchema.safeParse({ from: '2026-02-30', to: '2026-03-07' }).success).toBe(false);
  });
});

describe('createPatternSchema', () => {
  it('nama dirapikan, urutan wajib berisi, nama shift kosong ditolak', () => {
    expect(createPatternSchema.parse({ nama: '  2-2  ', urutan: [' pagi ', 'libur'] })).toEqual({ nama: '2-2', urutan: ['pagi', 'libur'] });
    expect(createPatternSchema.safeParse({ nama: 'X', urutan: [] }).success).toBe(false);
    expect(createPatternSchema.safeParse({ nama: 'X', urutan: ['pagi', '  '] }).success).toBe(false);
  });
});
