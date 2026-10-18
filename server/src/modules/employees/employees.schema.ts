import { z } from 'zod';
import { ROLES } from '../../core/roles';
import { isoDate, passwordSchema } from '../../core/schemas';

const nik = z.string().trim().min(1, 'NIK wajib diisi').max(30, 'NIK maksimal 30 karakter');
const nama = z.string().trim().min(1, 'Nama wajib diisi').max(150);
const id = z.number().int().positive();

// Tanpa `.default()` untuk role (lihat catatan di shifts.schema.ts). Default EMPLOYEE diisi di service.
export const createEmployeeSchema = z.object({
  nik,
  nama,
  departmentId: id,
  atasanId: id.nullable().optional(),
  tanggalMasuk: isoDate,
  role: z.enum(ROLES).optional(),
  password: passwordSchema,
});

export const updateEmployeeSchema = z
  .object({
    nama,
    departmentId: id,
    atasanId: id.nullable(),
    tanggalMasuk: isoDate,
    role: z.enum(ROLES),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, { message: 'Minimal satu field harus diubah' });

export const resetPasswordSchema = z.object({ password: passwordSchema });

export const listEmployeesQuery = z.object({
  q: z.string().trim().max(50).optional(),
  departmentId: z.coerce.number().int().positive().optional(),
  aktif: z.enum(['true', 'false', 'all']).default('true'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const createDepartmentSchema = z.object({
  nama: z.string().trim().min(1, 'Nama divisi wajib diisi').max(100),
  kepalaId: id.nullable().optional(),
});

export const updateDepartmentSchema = z
  .object({ nama: z.string().trim().min(1).max(100), kepalaId: id.nullable() })
  .partial()
  .refine((v) => Object.keys(v).length > 0, { message: 'Minimal satu field harus diubah' });

export type CreateEmployeeInput = z.infer<typeof createEmployeeSchema>;
export type UpdateEmployeeInput = z.infer<typeof updateEmployeeSchema>;
export type ListEmployeesQuery = z.infer<typeof listEmployeesQuery>;
export type CreateDepartmentInput = z.infer<typeof createDepartmentSchema>;
export type UpdateDepartmentInput = z.infer<typeof updateDepartmentSchema>;
