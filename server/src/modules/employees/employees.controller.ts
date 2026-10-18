import type { Request, Response } from 'express';
import { auditFn, runInTransaction } from '../../core/db-helpers';
import { hashPassword } from '../../core/password';
import { employeesRepository } from './employees.repository';
import type {
  CreateDepartmentInput,
  CreateEmployeeInput,
  ListEmployeesQuery,
  UpdateDepartmentInput,
  UpdateEmployeeInput,
} from './employees.schema';
import { createEmployeesService } from './employees.service';

const service = createEmployeesService({ repo: employeesRepository, hashPassword, audit: auditFn, runInTransaction });
const idOf = (res: Response) => (res.locals.params as { id: number }).id;

export async function list(req: Request, res: Response) {
  res.json(await service.list(res.locals.query as ListEmployeesQuery, req.user!));
}
export async function get(req: Request, res: Response) {
  res.json({ data: await service.get(idOf(res), req.user!) });
}
export async function create(req: Request, res: Response) {
  res.status(201).json({ data: await service.create(res.locals.body as CreateEmployeeInput, req.user!) });
}
export async function update(req: Request, res: Response) {
  res.json({ data: await service.update(idOf(res), res.locals.body as UpdateEmployeeInput, req.user!) });
}
export async function deactivate(req: Request, res: Response) {
  res.json({ data: await service.setActive(idOf(res), false, req.user!) });
}
export async function activate(req: Request, res: Response) {
  res.json({ data: await service.setActive(idOf(res), true, req.user!) });
}
export async function resetPassword(req: Request, res: Response) {
  const { password } = res.locals.body as { password: string };
  await service.resetPassword(idOf(res), password, req.user!);
  res.status(204).end();
}

export async function listDepartments(_req: Request, res: Response) {
  res.json({ data: await service.listDepartments() });
}
export async function createDepartment(req: Request, res: Response) {
  res.status(201).json({ data: await service.createDepartment(res.locals.body as CreateDepartmentInput, req.user!) });
}
export async function updateDepartment(req: Request, res: Response) {
  res.json({ data: await service.updateDepartment(idOf(res), res.locals.body as UpdateDepartmentInput, req.user!) });
}
