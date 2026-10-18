import { describe, expect, it } from 'vitest';
import { hhmm, idParams, isoDate, passwordSchema } from '../core/schemas';
import { createEmployeeSchema, listEmployeesQuery, updateEmployeeSchema } from '../modules/employees/employees.schema';
import { createLocationSchema, updateLocationSchema } from '../modules/locations/locations.schema';
import { createShiftSchema, updateShiftSchema } from '../modules/shifts/shifts.schema';

const ok = (s: { safeParse: (v: unknown) => { success: boolean } }, v: unknown) => s.safeParse(v).success;

describe('schema umum', () => {
  it('hhmm', () => {
    expect(ok(hhmm, '07:00')).toBe(true);
    expect(ok(hhmm, '23:59')).toBe(true);
    expect(ok(hhmm, '24:00')).toBe(false);
    expect(ok(hhmm, '7:00')).toBe(false);
    expect(ok(hhmm, '07:60')).toBe(false);
  });
  it('isoDate menolak tanggal yang tidak ada', () => {
    expect(ok(isoDate, '2026-10-19')).toBe(true);
    expect(ok(isoDate, '2024-02-29')).toBe(true);
    expect(ok(isoDate, '2026-02-29')).toBe(false);
    expect(ok(isoDate, '19-10-2026')).toBe(false);
  });
  it('password: minimal 8 karakter, maksimal 72 byte', () => {
    expect(ok(passwordSchema, 'rahasia1')).toBe(true);
    expect(ok(passwordSchema, 'pendek')).toBe(false);
    expect(ok(passwordSchema, 'a'.repeat(72))).toBe(true);
    expect(ok(passwordSchema, 'a'.repeat(73))).toBe(false);
    expect(ok(passwordSchema, 'é'.repeat(37))).toBe(false); // 74 byte
  });
  it('idParams mengubah string jadi angka positif', () => {
    const r = idParams.safeParse({ id: '12' });
    expect(r.success && r.data.id).toBe(12);
    expect(ok(idParams, { id: '0' })).toBe(false);
    expect(ok(idParams, { id: 'abc' })).toBe(false);
  });
});

describe('schema shift', () => {
  it('create: valid, tanpa toleransi boleh; jam sama ditolak', () => {
    expect(ok(createShiftSchema, { nama: 'Pagi', jamMulai: '07:00', jamSelesai: '15:00' })).toBe(true);
    expect(ok(createShiftSchema, { nama: 'Pagi', jamMulai: '07:00', jamSelesai: '07:00' })).toBe(false);
    expect(ok(createShiftSchema, { nama: 'Pagi', jamMulai: '07:00', jamSelesai: '15:00', toleransiMenit: 61 })).toBe(false);
    expect(ok(createShiftSchema, { nama: '  ', jamMulai: '07:00', jamSelesai: '15:00' })).toBe(false);
  });
  it('update: parsial boleh, kosong ditolak, TIDAK menyisipkan default toleransi', () => {
    const r = updateShiftSchema.safeParse({ nama: 'Baru' });
    expect(r.success).toBe(true);
    if (r.success) expect(Object.keys(r.data)).toEqual(['nama']);
    expect(ok(updateShiftSchema, {})).toBe(false);
  });
});

describe('schema lokasi', () => {
  it('create: batas koordinat dan radius', () => {
    expect(ok(createLocationSchema, { nama: 'P', lat: -6.3, lng: 107.1 })).toBe(true);
    expect(ok(createLocationSchema, { nama: 'P', lat: 91, lng: 0 })).toBe(false);
    expect(ok(createLocationSchema, { nama: 'P', lat: 0, lng: 181 })).toBe(false);
    expect(ok(createLocationSchema, { nama: 'P', lat: 0, lng: 0, radiusM: 5 })).toBe(false);
    expect(ok(createLocationSchema, { nama: 'P', lat: 0, lng: 0, radiusM: 2001 })).toBe(false);
  });
  it('update: parsial tanpa menyisipkan radius default', () => {
    const r = updateLocationSchema.safeParse({ lat: 0 });
    expect(r.success).toBe(true);
    if (r.success) expect(Object.keys(r.data)).toEqual(['lat']);
    expect(ok(updateLocationSchema, {})).toBe(false);
  });
});

describe('schema karyawan', () => {
  const base = { nik: '2001', nama: 'Siti', departmentId: 1, tanggalMasuk: '2026-10-01', password: 'rahasia123' };

  it('create: valid; role tak dikenal, password pendek, tanggal salah ditolak', () => {
    expect(ok(createEmployeeSchema, base)).toBe(true);
    expect(ok(createEmployeeSchema, { ...base, role: 'HRD', atasanId: null })).toBe(true);
    expect(ok(createEmployeeSchema, { ...base, role: 'BOS' })).toBe(false);
    expect(ok(createEmployeeSchema, { ...base, password: 'pendek' })).toBe(false);
    expect(ok(createEmployeeSchema, { ...base, tanggalMasuk: '2026-13-01' })).toBe(false);
    expect(ok(createEmployeeSchema, { ...base, departmentId: 0 })).toBe(false);
  });

  it('update: field password TIDAK diterima lewat PATCH (dibuang), kosong ditolak, atasan null boleh', () => {
    const r = updateEmployeeSchema.safeParse({ nama: 'X', password: 'diselundupkan1' });
    expect(r.success).toBe(true);
    if (r.success) expect(Object.keys(r.data)).toEqual(['nama']);
    expect(ok(updateEmployeeSchema, {})).toBe(false);
    expect(ok(updateEmployeeSchema, { atasanId: null })).toBe(true);
  });

  it('query daftar: default aktif=true, page=1, limit=20; limit maksimal 100', () => {
    const r = listEmployeesQuery.safeParse({});
    expect(r.success && r.data).toEqual({ aktif: 'true', page: 1, limit: 20 });
    expect(ok(listEmployeesQuery, { limit: '101' })).toBe(false);
    expect(ok(listEmployeesQuery, { aktif: 'maybe' })).toBe(false);
    const r2 = listEmployeesQuery.safeParse({ page: '2', limit: '50', departmentId: '3' });
    expect(r2.success && r2.data).toMatchObject({ page: 2, limit: 50, departmentId: 3 });
  });
});
