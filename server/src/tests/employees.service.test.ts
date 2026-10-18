import { describe, expect, it } from 'vitest';
import type { AuditEntry } from '../core/audit';
import type { AuthUser } from '../core/middleware/auth';
import type { Role } from '../core/roles';
import {
  createEmployeesService,
  type DepartmentRecord,
  type EmployeeRecord,
  type EmployeesRepository,
  type ListFilter,
} from '../modules/employees/employees.service';

const actor = (role: Role, employeeId: number): AuthUser => ({ userId: employeeId + 1000, employeeId, role });
const hrd = actor('HRD', 1);
const admin = actor('ADMIN', 2);

function emp(id: number, over: Partial<EmployeeRecord> = {}): EmployeeRecord {
  return {
    id, nik: `NIK${id}`, nama: `Karyawan ${id}`, departmentId: 1, departmentNama: 'Produksi',
    atasanId: null, atasanNama: null, tanggalMasuk: '2024-01-15', aktif: true,
    userId: id + 1000, role: 'EMPLOYEE', ...over,
  };
}

function setup(seed: EmployeeRecord[], departments: DepartmentRecord[] = [{ id: 1, nama: 'Produksi', kepalaId: null, kepalaNama: null }]) {
  const emps = seed.map((e) => ({ ...e }));
  const depts = departments.map((d) => ({ ...d }));
  const audits: AuditEntry[] = [];
  const calls = {
    users: [] as { employeeId: number; hash: string; role: Role }[],
    roles: [] as { employeeId: number; role: Role }[],
    passwords: [] as { employeeId: number; hash: string }[],
    filters: [] as ListFilter[],
  };
  let nextId = 100;
  const dup = () => Object.assign(new Error('dup'), { code: 'ER_DUP_ENTRY' });

  const repo: EmployeesRepository = {
    list: async (f) => {
      calls.filters.push(f);
      return { rows: emps, total: emps.length };
    },
    findById: async (id) => emps.find((e) => e.id === id) ?? null,
    insertEmployee: async (d) => {
      if (emps.some((e) => e.nik === d.nik)) throw dup();
      const id = nextId++;
      emps.push(emp(id, { ...d, userId: null, role: null }));
      return id;
    },
    insertUser: async (employeeId, hash, role) => {
      calls.users.push({ employeeId, hash, role });
      Object.assign(emps.find((e) => e.id === employeeId)!, { userId: employeeId + 1000, role });
    },
    updateEmployee: async (id, fields) => {
      const e = emps.find((x) => x.id === id)!;
      for (const [k, v] of Object.entries(fields)) if (v !== undefined) (e as unknown as Record<string, unknown>)[k] = v;
    },
    updateUserRole: async (employeeId, role) => {
      calls.roles.push({ employeeId, role });
      emps.find((e) => e.id === employeeId)!.role = role;
    },
    setAktif: async (id, aktif) => void (emps.find((e) => e.id === id)!.aktif = aktif),
    updatePassword: async (employeeId, hash) => void calls.passwords.push({ employeeId, hash }),
    listDepartments: async () => depts,
    findDepartment: async (id) => depts.find((d) => d.id === id) ?? null,
    insertDepartment: async (d) => {
      if (depts.some((x) => x.nama === d.nama)) throw dup();
      const id = nextId++;
      depts.push({ id, nama: d.nama, kepalaId: d.kepalaId, kepalaNama: null });
      return id;
    },
    updateDepartment: async (id, d) => void Object.assign(depts.find((x) => x.id === id)!, d),
  };

  const service = createEmployeesService({
    repo,
    hashPassword: async (p) => `hash:${p}`,
    audit: async (e) => void audits.push(e),
    runInTransaction: (fn) => fn('tx'),
  });
  return { service, emps, depts, audits, calls };
}

const newEmp = { nik: '2001', nama: 'Siti', departmentId: 1, tanggalMasuk: '2026-10-01', password: 'rahasia123' };

describe('employees.create', () => {
  it('membuat karyawan + akun: role default EMPLOYEE, password di-hash, tercatat di audit tanpa password', async () => {
    const { service, calls, audits } = setup([emp(1, { role: 'HRD' })]);
    const e = await service.create(newEmp, hrd);
    expect(e).toMatchObject({ nik: '2001', nama: 'Siti', role: 'EMPLOYEE', aktif: true });
    expect(calls.users[0]).toMatchObject({ hash: 'hash:rahasia123', role: 'EMPLOYEE' });
    expect(audits[0]).toMatchObject({ action: 'EMPLOYEE_CREATE', userId: hrd.userId });
    expect(JSON.stringify(audits)).not.toContain('rahasia123');
    expect(JSON.stringify(audits)).not.toContain('hash:');
  });

  it('HRD tidak boleh membuat akun ADMIN (403), ADMIN boleh', async () => {
    const { service } = setup([emp(1)]);
    await expect(service.create({ ...newEmp, role: 'ADMIN' }, hrd)).rejects.toMatchObject({ status: 403 });
    const ok = await service.create({ ...newEmp, role: 'ADMIN' }, admin);
    expect(ok.role).toBe('ADMIN');
  });

  it('NIK kembar: 409 menyebut NIK-nya', async () => {
    const { service } = setup([emp(1, { nik: '2001' })]);
    const err = await service.create(newEmp, hrd).catch((e) => e);
    expect(err.status).toBe(409);
    expect(err.message).toContain('2001');
  });

  it('divisi tidak ada: 400', async () => {
    const { service } = setup([emp(1)]);
    await expect(service.create({ ...newEmp, departmentId: 99 }, hrd)).rejects.toMatchObject({ status: 400 });
  });

  it('atasan nonaktif atau tidak ada: 400', async () => {
    const { service } = setup([emp(1), emp(2, { aktif: false })]);
    await expect(service.create({ ...newEmp, atasanId: 2 }, hrd)).rejects.toMatchObject({ status: 400 });
    await expect(service.create({ ...newEmp, atasanId: 77 }, hrd)).rejects.toMatchObject({ status: 400 });
  });

  it('atasan valid tersimpan', async () => {
    const { service } = setup([emp(1)]);
    const e = await service.create({ ...newEmp, atasanId: 1 }, hrd);
    expect(e.atasanId).toBe(1);
  });
});

describe('employees.update', () => {
  it('atasan tidak boleh diri sendiri (400)', async () => {
    const { service } = setup([emp(1), emp(5)]);
    await expect(service.update(5, { atasanId: 5 }, hrd)).rejects.toMatchObject({ status: 400 });
  });

  it('rantai atasan tidak boleh melingkar: A <- B <- C, A tidak boleh dibawahi C', async () => {
    const { service } = setup([emp(1), emp(10), emp(11, { atasanId: 10 }), emp(12, { atasanId: 11 })]);
    // 10 diawasi 11 dan 12 secara tidak langsung; menjadikan 12 atasan 10 membuat lingkaran
    await expect(service.update(10, { atasanId: 12 }, hrd)).rejects.toMatchObject({ status: 400 });
    // atasan yang tidak melingkar boleh
    const ok = await service.update(12, { atasanId: 10 }, hrd);
    expect(ok.atasanId).toBe(10);
  });

  it('mengosongkan atasan (null) diperbolehkan', async () => {
    const { service } = setup([emp(1), emp(5, { atasanId: 1 })]);
    const e = await service.update(5, { atasanId: null }, hrd);
    expect(e.atasanId).toBeNull();
  });

  it('HRD tidak boleh mengubah akun ADMIN (403)', async () => {
    const { service } = setup([emp(1), emp(2, { role: 'ADMIN' })]);
    await expect(service.update(2, { nama: 'Baru' }, hrd)).rejects.toMatchObject({ status: 403 });
  });

  it('HRD tidak boleh memberi role ADMIN; role sendiri tidak bisa diubah', async () => {
    const { service } = setup([emp(1, { role: 'HRD' }), emp(5)]);
    await expect(service.update(5, { role: 'ADMIN' }, hrd)).rejects.toMatchObject({ status: 403 });
    await expect(service.update(1, { role: 'SPV' }, hrd)).rejects.toMatchObject({ status: 403 });
  });

  it('HRD mengubah role karyawan lain: berhasil, tercatat before/after', async () => {
    const { service, calls, audits } = setup([emp(1, { role: 'HRD' }), emp(5)]);
    const e = await service.update(5, { role: 'FOREMAN', nama: 'Nama Baru' }, hrd);
    expect(e).toMatchObject({ role: 'FOREMAN', nama: 'Nama Baru' });
    expect(calls.roles).toEqual([{ employeeId: 5, role: 'FOREMAN' }]);
    expect(audits[0]).toMatchObject({
      action: 'EMPLOYEE_UPDATE',
      before: { role: 'EMPLOYEE', nama: 'Karyawan 5' },
      after: { role: 'FOREMAN', nama: 'Nama Baru' },
    });
  });

  it('mengirim role yang sama tidak memicu update role', async () => {
    const { service, calls } = setup([emp(1), emp(5)]);
    await service.update(5, { role: 'EMPLOYEE', nama: 'X' }, hrd);
    expect(calls.roles).toHaveLength(0);
  });

  it('pindah ke divisi yang tidak ada: 400; id tidak ada: 404', async () => {
    const { service } = setup([emp(1), emp(5)]);
    await expect(service.update(5, { departmentId: 99 }, hrd)).rejects.toMatchObject({ status: 400 });
    await expect(service.update(404, { nama: 'X' }, hrd)).rejects.toMatchObject({ status: 404 });
  });
});

describe('employees.setActive', () => {
  it('tidak bisa menonaktifkan diri sendiri (403)', async () => {
    const { service } = setup([emp(1, { role: 'HRD' })]);
    await expect(service.setActive(1, false, hrd)).rejects.toMatchObject({ status: 403 });
  });

  it('menonaktifkan lalu mengaktifkan kembali, masing-masing tercatat di audit', async () => {
    const { service, audits } = setup([emp(1), emp(5)]);
    expect((await service.setActive(5, false, hrd)).aktif).toBe(false);
    expect((await service.setActive(5, true, hrd)).aktif).toBe(true);
    expect(audits.map((a) => a.action)).toEqual(['EMPLOYEE_DEACTIVATE', 'EMPLOYEE_ACTIVATE']);
  });

  it('status sudah sama: tidak menulis audit lagi', async () => {
    const { service, audits } = setup([emp(1), emp(5, { aktif: false })]);
    await service.setActive(5, false, hrd);
    expect(audits).toHaveLength(0);
  });

  it('HRD tidak boleh menonaktifkan ADMIN (403)', async () => {
    const { service } = setup([emp(1), emp(2, { role: 'ADMIN' })]);
    await expect(service.setActive(2, false, hrd)).rejects.toMatchObject({ status: 403 });
  });
});

describe('employees.resetPassword', () => {
  it('password di-hash dan audit tidak memuat password', async () => {
    const { service, calls, audits } = setup([emp(1), emp(5)]);
    await service.resetPassword(5, 'passwordBaru1', hrd);
    expect(calls.passwords).toEqual([{ employeeId: 5, hash: 'hash:passwordBaru1' }]);
    expect(audits[0]).toMatchObject({ action: 'EMPLOYEE_RESET_PASSWORD', entityId: 5 });
    expect(JSON.stringify(audits)).not.toContain('passwordBaru1');
  });

  it('karyawan tanpa akun: 400; target ADMIN oleh HRD: 403', async () => {
    const { service } = setup([emp(1), emp(5, { userId: null, role: null }), emp(2, { role: 'ADMIN' })]);
    await expect(service.resetPassword(5, 'passwordBaru1', hrd)).rejects.toMatchObject({ status: 400 });
    await expect(service.resetPassword(2, 'passwordBaru1', hrd)).rejects.toMatchObject({ status: 403 });
  });
});

describe('employees.list dan get (cakupan per role)', () => {
  const base = { aktif: 'true' as const, page: 1, limit: 20 };

  it('EMPLOYEE tidak boleh melihat daftar (403)', async () => {
    const { service } = setup([emp(7)]);
    await expect(service.list(base, actor('EMPLOYEE', 7))).rejects.toMatchObject({ status: 403 });
  });

  it('HRD/ADMIN: semua; FOREMAN: timnya; SPV: divisinya', async () => {
    const { service, calls } = setup([emp(1), emp(8, { departmentId: 3 })]);
    await service.list(base, hrd);
    await service.list(base, actor('FOREMAN', 20));
    await service.list(base, actor('SPV', 8));
    expect(calls.filters.map((f) => f.scope)).toEqual([
      { kind: 'all' },
      { kind: 'team', atasanId: 20 },
      { kind: 'department', departmentId: 3 },
    ]);
  });

  it('parameter query diteruskan: aktif true/false/all, pencarian, halaman', async () => {
    const { service, calls } = setup([emp(1)]);
    const r = await service.list({ q: 'budi', departmentId: 1, aktif: 'all', page: 3, limit: 10 }, hrd);
    expect(calls.filters[0]).toMatchObject({ q: 'budi', departmentId: 1, aktif: undefined, page: 3, limit: 10 });
    expect(r).toMatchObject({ page: 3, limit: 10, total: 1 });
    await service.list({ aktif: 'false', page: 1, limit: 20 }, hrd);
    expect(calls.filters[1].aktif).toBe(false);
  });

  it('get: diri sendiri selalu boleh, bahkan sebagai EMPLOYEE', async () => {
    const { service } = setup([emp(7)]);
    expect((await service.get(7, actor('EMPLOYEE', 7))).id).toBe(7);
  });

  it('get: FOREMAN hanya anggota timnya, orang lain 403', async () => {
    const { service } = setup([emp(20), emp(21, { atasanId: 20 }), emp(22, { atasanId: 99 })]);
    const foreman = actor('FOREMAN', 20);
    expect((await service.get(21, foreman)).id).toBe(21);
    await expect(service.get(22, foreman)).rejects.toMatchObject({ status: 403 });
  });

  it('get: SPV hanya divisinya sendiri; id tidak ada 404', async () => {
    const { service } = setup([emp(8, { departmentId: 3 }), emp(9, { departmentId: 3 }), emp(10, { departmentId: 4 })]);
    const spv = actor('SPV', 8);
    expect((await service.get(9, spv)).id).toBe(9);
    await expect(service.get(10, spv)).rejects.toMatchObject({ status: 403 });
    await expect(service.get(404, spv)).rejects.toMatchObject({ status: 404 });
  });
});

describe('divisi', () => {
  it('membuat divisi dengan kepala; nama kembar 409; kepala tidak ada 400', async () => {
    const { service, audits } = setup([emp(1)]);
    const d = await service.createDepartment({ nama: 'Maintenance', kepalaId: 1 }, hrd);
    expect(d).toMatchObject({ nama: 'Maintenance', kepalaId: 1 });
    expect(audits[0]).toMatchObject({ action: 'DEPARTMENT_CREATE' });
    await expect(service.createDepartment({ nama: 'Produksi' }, hrd)).rejects.toMatchObject({ status: 409 });
    await expect(service.createDepartment({ nama: 'QC', kepalaId: 999 }, hrd)).rejects.toMatchObject({ status: 400 });
  });

  it('update parsial: kepala tetap jika tidak dikirim, null mengosongkan', async () => {
    const { service } = setup([emp(1)], [{ id: 1, nama: 'Produksi', kepalaId: 1, kepalaNama: null }]);
    expect((await service.updateDepartment(1, { nama: 'Produksi A' }, hrd)).kepalaId).toBe(1);
    expect((await service.updateDepartment(1, { kepalaId: null }, hrd)).kepalaId).toBeNull();
    await expect(service.updateDepartment(99, { nama: 'X' }, hrd)).rejects.toMatchObject({ status: 404 });
  });
});
