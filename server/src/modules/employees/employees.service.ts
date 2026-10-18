/**
 * Logika bisnis karyawan dan divisi. Dependensi disuntik agar bisa di-unit-test tanpa DB.
 * Penyambungan ke DB ada di employees.controller.ts.
 *
 * Aturan penting:
 * - Karyawan tidak dihapus, hanya dinonaktifkan (data absensi lama masih mengacu ke dia).
 * - Hanya ADMIN yang boleh membuat/mengubah/menonaktifkan akun ADMIN (cegah HRD menaikkan hak akses).
 * - Role sendiri tidak bisa diubah, dan tidak bisa menonaktifkan diri sendiri.
 * - Rantai atasan tidak boleh melingkar.
 */
import type { AuthUser } from '../../core/middleware/auth';
import { isDuplicateEntry } from '../../core/db-errors';
import { AppError } from '../../core/errors';
import type { Role } from '../../core/roles';
import type { AuditFn, TxRunner } from '../../core/service-deps';
import type {
  CreateDepartmentInput,
  CreateEmployeeInput,
  ListEmployeesQuery,
  UpdateDepartmentInput,
  UpdateEmployeeInput,
} from './employees.schema';

export interface EmployeeRecord {
  id: number;
  nik: string;
  nama: string;
  departmentId: number;
  departmentNama: string;
  atasanId: number | null;
  atasanNama: string | null;
  tanggalMasuk: string; // 'YYYY-MM-DD'
  aktif: boolean;
  userId: number | null;
  role: Role | null;
}

export interface DepartmentRecord {
  id: number;
  nama: string;
  kepalaId: number | null;
  kepalaNama: string | null;
}

export type EmployeeScope =
  | { kind: 'all' }
  | { kind: 'department'; departmentId: number }
  | { kind: 'team'; atasanId: number };

export interface ListFilter {
  q?: string;
  departmentId?: number;
  aktif?: boolean; // undefined = semua
  scope: EmployeeScope;
  page: number;
  limit: number;
}

export interface EmployeesRepository {
  list(filter: ListFilter): Promise<{ rows: EmployeeRecord[]; total: number }>;
  findById(id: number, tx?: unknown): Promise<EmployeeRecord | null>;
  insertEmployee(
    d: { nik: string; nama: string; departmentId: number; atasanId: number | null; tanggalMasuk: string },
    tx?: unknown,
  ): Promise<number>;
  insertUser(employeeId: number, passwordHash: string, role: Role, tx?: unknown): Promise<void>;
  updateEmployee(
    id: number,
    fields: { nama?: string; departmentId?: number; atasanId?: number | null; tanggalMasuk?: string },
    tx?: unknown,
  ): Promise<void>;
  updateUserRole(employeeId: number, role: Role, tx?: unknown): Promise<void>;
  setAktif(id: number, aktif: boolean, tx?: unknown): Promise<void>;
  updatePassword(employeeId: number, passwordHash: string, tx?: unknown): Promise<void>;

  listDepartments(): Promise<DepartmentRecord[]>;
  findDepartment(id: number, tx?: unknown): Promise<DepartmentRecord | null>;
  insertDepartment(d: { nama: string; kepalaId: number | null }, tx?: unknown): Promise<number>;
  updateDepartment(id: number, d: { nama: string; kepalaId: number | null }, tx?: unknown): Promise<void>;
}

export interface EmployeesDeps {
  repo: EmployeesRepository;
  hashPassword(plain: string): Promise<string>;
  audit: AuditFn;
  runInTransaction: TxRunner;
}

const MAX_CHAIN_DEPTH = 100;

export function createEmployeesService({ repo, hashPassword, audit, runInTransaction }: EmployeesDeps) {
  async function mustFind(id: number): Promise<EmployeeRecord> {
    const e = await repo.findById(id);
    if (!e) throw AppError.notFound('Karyawan tidak ditemukan');
    return e;
  }

  function guardAdminTarget(target: EmployeeRecord, actor: AuthUser) {
    if (target.role === 'ADMIN' && actor.role !== 'ADMIN') {
      throw AppError.forbidden('Akun Admin hanya bisa dikelola oleh Admin.');
    }
  }

  async function mustDepartment(id: number) {
    const d = await repo.findDepartment(id);
    if (!d) throw AppError.badRequest('Divisi tidak ditemukan.');
    return d;
  }

  /** `employeeId` null saat karyawan baru (belum ada rantai yang bisa melingkar). */
  async function checkAtasan(employeeId: number | null, atasanId: number) {
    if (employeeId !== null && atasanId === employeeId) {
      throw AppError.badRequest('Karyawan tidak bisa menjadi atasan dirinya sendiri.');
    }
    const atasan = await repo.findById(atasanId);
    if (!atasan || !atasan.aktif) {
      throw AppError.badRequest('Atasan tidak ditemukan atau sudah nonaktif.');
    }
    if (employeeId === null) return;
    let cur = atasan.atasanId;
    for (let steps = 0; cur !== null && steps < MAX_CHAIN_DEPTH; steps++) {
      if (cur === employeeId) {
        throw AppError.badRequest('Atasan yang dipilih ada di bawah karyawan ini, jadi jadi melingkar. Pilih atasan lain.');
      }
      cur = (await repo.findById(cur))?.atasanId ?? null;
    }
  }

  async function scopeFor(actor: AuthUser): Promise<EmployeeScope> {
    switch (actor.role) {
      case 'HRD':
      case 'ADMIN':
        return { kind: 'all' };
      case 'SPV': {
        const me = await repo.findById(actor.employeeId);
        if (!me) throw AppError.forbidden();
        return { kind: 'department', departmentId: me.departmentId };
      }
      case 'FOREMAN':
        return { kind: 'team', atasanId: actor.employeeId };
      default:
        throw AppError.forbidden('Kamu tidak punya akses ke daftar karyawan.');
    }
  }

  const snapshot = (e: EmployeeRecord) => ({
    nik: e.nik,
    nama: e.nama,
    departmentId: e.departmentId,
    atasanId: e.atasanId,
    tanggalMasuk: e.tanggalMasuk,
    aktif: e.aktif,
    role: e.role,
  });

  return {
    async list(query: ListEmployeesQuery, actor: AuthUser) {
      const scope = await scopeFor(actor);
      const { rows, total } = await repo.list({
        q: query.q || undefined,
        departmentId: query.departmentId,
        aktif: query.aktif === 'all' ? undefined : query.aktif === 'true',
        scope,
        page: query.page,
        limit: query.limit,
      });
      return { data: rows, total, page: query.page, limit: query.limit };
    },

    async get(id: number, actor: AuthUser): Promise<EmployeeRecord> {
      const e = await mustFind(id);
      if (id === actor.employeeId) return e;
      const scope = await scopeFor(actor);
      const allowed =
        scope.kind === 'all' ||
        (scope.kind === 'department' && e.departmentId === scope.departmentId) ||
        (scope.kind === 'team' && e.atasanId === scope.atasanId);
      if (!allowed) throw AppError.forbidden('Karyawan ini di luar cakupan kamu.');
      return e;
    },

    async create(input: CreateEmployeeInput, actor: AuthUser): Promise<EmployeeRecord> {
      const role: Role = input.role ?? 'EMPLOYEE';
      if (role === 'ADMIN' && actor.role !== 'ADMIN') {
        throw AppError.forbidden('Hanya Admin yang bisa membuat akun dengan role Admin.');
      }
      await mustDepartment(input.departmentId);
      const atasanId = input.atasanId ?? null;
      if (atasanId !== null) await checkAtasan(null, atasanId);

      const passwordHash = await hashPassword(input.password);
      let id: number;
      try {
        id = await runInTransaction(async (tx) => {
          const newId = await repo.insertEmployee(
            { nik: input.nik, nama: input.nama, departmentId: input.departmentId, atasanId, tanggalMasuk: input.tanggalMasuk },
            tx,
          );
          await repo.insertUser(newId, passwordHash, role, tx);
          await audit(
            {
              userId: actor.userId,
              action: 'EMPLOYEE_CREATE',
              entity: 'employees',
              entityId: newId,
              after: { nik: input.nik, nama: input.nama, departmentId: input.departmentId, atasanId, role },
            },
            tx,
          );
          return newId;
        });
      } catch (err) {
        if (isDuplicateEntry(err)) throw AppError.conflict(`NIK ${input.nik} sudah terdaftar. Pakai NIK lain.`);
        throw err;
      }
      return mustFind(id);
    },

    async update(id: number, patch: UpdateEmployeeInput, actor: AuthUser): Promise<EmployeeRecord> {
      const existing = await mustFind(id);
      guardAdminTarget(existing, actor);

      if (patch.role === 'ADMIN' && actor.role !== 'ADMIN') {
        throw AppError.forbidden('Hanya Admin yang bisa memberi role Admin.');
      }
      const roleChanges = patch.role !== undefined && patch.role !== existing.role;
      if (roleChanges) {
        if (existing.userId === null) throw AppError.badRequest('Karyawan ini belum punya akun login.');
        if (id === actor.employeeId) {
          throw AppError.forbidden('Role kamu sendiri tidak bisa diubah. Minta HRD atau Admin lain.');
        }
      }
      if (patch.departmentId !== undefined) await mustDepartment(patch.departmentId);
      if (patch.atasanId !== undefined && patch.atasanId !== null) await checkAtasan(id, patch.atasanId);

      const before = snapshot(existing);
      const after = { ...before };
      if (patch.nama !== undefined) after.nama = patch.nama;
      if (patch.departmentId !== undefined) after.departmentId = patch.departmentId;
      if (patch.atasanId !== undefined) after.atasanId = patch.atasanId;
      if (patch.tanggalMasuk !== undefined) after.tanggalMasuk = patch.tanggalMasuk;
      if (patch.role !== undefined) after.role = patch.role;

      await runInTransaction(async (tx) => {
        await repo.updateEmployee(
          id,
          { nama: patch.nama, departmentId: patch.departmentId, atasanId: patch.atasanId, tanggalMasuk: patch.tanggalMasuk },
          tx,
        );
        if (roleChanges && patch.role) await repo.updateUserRole(id, patch.role, tx);
        await audit({ userId: actor.userId, action: 'EMPLOYEE_UPDATE', entity: 'employees', entityId: id, before, after }, tx);
      });
      return mustFind(id);
    },

    async setActive(id: number, aktif: boolean, actor: AuthUser): Promise<EmployeeRecord> {
      const existing = await mustFind(id);
      guardAdminTarget(existing, actor);
      if (!aktif && id === actor.employeeId) {
        throw AppError.forbidden('Kamu tidak bisa menonaktifkan akunmu sendiri.');
      }
      if (existing.aktif === aktif) return existing;
      await runInTransaction(async (tx) => {
        await repo.setAktif(id, aktif, tx);
        await audit(
          {
            userId: actor.userId,
            action: aktif ? 'EMPLOYEE_ACTIVATE' : 'EMPLOYEE_DEACTIVATE',
            entity: 'employees',
            entityId: id,
            before: { aktif: existing.aktif },
            after: { aktif },
          },
          tx,
        );
      });
      return mustFind(id);
    },

    async resetPassword(id: number, password: string, actor: AuthUser): Promise<void> {
      const existing = await mustFind(id);
      guardAdminTarget(existing, actor);
      if (existing.userId === null) throw AppError.badRequest('Karyawan ini belum punya akun login.');
      const passwordHash = await hashPassword(password);
      await runInTransaction(async (tx) => {
        await repo.updatePassword(id, passwordHash, tx);
        // Password dan hash tidak boleh masuk audit log.
        await audit({ userId: actor.userId, action: 'EMPLOYEE_RESET_PASSWORD', entity: 'employees', entityId: id }, tx);
      });
    },

    // ---------- Divisi ----------

    listDepartments: () => repo.listDepartments(),

    async createDepartment(input: CreateDepartmentInput, actor: AuthUser): Promise<DepartmentRecord> {
      const kepalaId = input.kepalaId ?? null;
      if (kepalaId !== null && !(await repo.findById(kepalaId))) {
        throw AppError.badRequest('Kepala divisi tidak ditemukan.');
      }
      try {
        const id = await runInTransaction(async (tx) => {
          const newId = await repo.insertDepartment({ nama: input.nama, kepalaId }, tx);
          await audit(
            { userId: actor.userId, action: 'DEPARTMENT_CREATE', entity: 'departments', entityId: newId, after: { nama: input.nama, kepalaId } },
            tx,
          );
          return newId;
        });
        return (await repo.findDepartment(id))!;
      } catch (err) {
        if (isDuplicateEntry(err)) throw AppError.conflict(`Divisi "${input.nama}" sudah ada.`);
        throw err;
      }
    },

    async updateDepartment(id: number, patch: UpdateDepartmentInput, actor: AuthUser): Promise<DepartmentRecord> {
      const existing = await repo.findDepartment(id);
      if (!existing) throw AppError.notFound('Divisi tidak ditemukan');
      const next = {
        nama: patch.nama ?? existing.nama,
        kepalaId: patch.kepalaId !== undefined ? patch.kepalaId : existing.kepalaId,
      };
      if (next.kepalaId !== null && !(await repo.findById(next.kepalaId))) {
        throw AppError.badRequest('Kepala divisi tidak ditemukan.');
      }
      try {
        await runInTransaction(async (tx) => {
          await repo.updateDepartment(id, next, tx);
          await audit(
            {
              userId: actor.userId,
              action: 'DEPARTMENT_UPDATE',
              entity: 'departments',
              entityId: id,
              before: { nama: existing.nama, kepalaId: existing.kepalaId },
              after: next,
            },
            tx,
          );
        });
      } catch (err) {
        if (isDuplicateEntry(err)) throw AppError.conflict(`Divisi "${next.nama}" sudah ada.`);
        throw err;
      }
      return (await repo.findDepartment(id))!;
    },
  };
}

export type EmployeesService = ReturnType<typeof createEmployeesService>;
