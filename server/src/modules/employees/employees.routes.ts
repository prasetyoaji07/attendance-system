import { Router } from 'express';
import { requireAuth } from '../../core/middleware/auth';
import { requireRole } from '../../core/middleware/rbac';
import { validate } from '../../core/middleware/validate';
import { idParams } from '../../core/schemas';
import {
  activate,
  create,
  createDepartment,
  deactivate,
  get,
  list,
  listDepartments,
  resetPassword,
  update,
  updateDepartment,
} from './employees.controller';
import {
  createDepartmentSchema,
  createEmployeeSchema,
  listEmployeesQuery,
  resetPasswordSchema,
  updateDepartmentSchema,
  updateEmployeeSchema,
} from './employees.schema';

export const employeesRoutes = Router();
const canManage = requireRole('HRD', 'ADMIN');
const canView = requireRole('FOREMAN', 'SPV', 'HRD', 'ADMIN');
const params = validate(idParams, 'params');

employeesRoutes.use(requireAuth);

// Divisi: didaftarkan SEBELUM '/:id' supaya '/departments' tidak dianggap id.
employeesRoutes.get('/departments', listDepartments);
employeesRoutes.post('/departments', canManage, validate(createDepartmentSchema), createDepartment);
employeesRoutes.patch('/departments/:id', canManage, params, validate(updateDepartmentSchema), updateDepartment);

// Karyawan. Tidak ada DELETE: karyawan dinonaktifkan, bukan dihapus.
employeesRoutes.get('/', canView, validate(listEmployeesQuery, 'query'), list);
employeesRoutes.post('/', canManage, validate(createEmployeeSchema), create);
employeesRoutes.get('/:id', canView, params, get);
employeesRoutes.patch('/:id', canManage, params, validate(updateEmployeeSchema), update);
employeesRoutes.post('/:id/deactivate', canManage, params, deactivate);
employeesRoutes.post('/:id/activate', canManage, params, activate);
employeesRoutes.post('/:id/reset-password', canManage, params, validate(resetPasswordSchema), resetPassword);
