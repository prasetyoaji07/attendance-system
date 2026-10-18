import type { Request, Response } from 'express';
import { config } from '../../core/config';
import { auditFn, runInTransaction } from '../../core/db-helpers';
import { RULES } from '../../core/rules';
import { createLocationQrService } from './location-qr.service';
import { locationsRepository } from './locations.repository';
import type { CreateLocationInput, UpdateLocationInput } from './locations.schema';
import { createLocationsService } from './locations.service';

const service = createLocationsService({ repo: locationsRepository, audit: auditFn, runInTransaction });
const qrService = createLocationQrService({
  locations: locationsRepository,
  secret: config.QR_SECRET,
  ttlSeconds: RULES.qrTtlSeconds,
});
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
export async function qr(_req: Request, res: Response) {
  // Token berganti tiap beberapa detik: jangan pernah di-cache browser atau proxy.
  res.set('Cache-Control', 'no-store');
  res.json({ data: await qrService.get(idOf(res)) });
}
