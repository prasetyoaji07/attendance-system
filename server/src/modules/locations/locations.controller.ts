import type { Request, Response } from 'express';
import { auditFn, runInTransaction } from '../../core/db-helpers';
import { locationsRepository } from './locations.repository';
import type { CreateLocationInput, UpdateLocationInput } from './locations.schema';
import { createLocationsService } from './locations.service';

const service = createLocationsService({ repo: locationsRepository, audit: auditFn, runInTransaction });
const idOf = (res: Response) => (res.locals.params as { id: number }).id;

export async function list(_req: Request, res: Response) {
  res.json({ data: await service.list() });
}
export async function get(_req: Request, res: Response) {
  res.json({ data: await service.get(idOf(res)) });
}
export async function create(req: Request, res: Response) {
  res.status(201).json({ data: await service.create(res.locals.body as CreateLocationInput, req.user!) });
}
export async function update(req: Request, res: Response) {
  res.json({ data: await service.update(idOf(res), res.locals.body as UpdateLocationInput, req.user!) });
}
export async function remove(req: Request, res: Response) {
  await service.remove(idOf(res), req.user!);
  res.status(204).end();
}
