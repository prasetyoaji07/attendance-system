import type { Request, Response } from 'express';
import { auditFn, runInTransaction } from '../../core/db-helpers';
import { locationsRepository } from '../locations/locations.repository';
import { shiftsRepository } from '../shifts/shifts.repository';
import { rosterRepository } from './roster.repository';
import type { CreatePatternInput, GenerateRosterInput, ListRosterQuery } from './roster.schema';
import { createRosterService } from './roster.service';

const service = createRosterService({
  repo: rosterRepository,
  shifts: shiftsRepository,
  locations: locationsRepository,
  audit: auditFn,
  runInTransaction,
});

export async function list(req: Request, res: Response) {
  res.json({ data: await service.list(res.locals.query as ListRosterQuery, req.user!) });
}
export async function listPatterns(_req: Request, res: Response) {
  res.json({ data: await service.listPatterns() });
}
export async function createPattern(req: Request, res: Response) {
  res.status(201).json({ data: await service.createPattern(res.locals.body as CreatePatternInput, req.user!) });
}
export async function generate(req: Request, res: Response) {
  const result = await service.generate(res.locals.body as GenerateRosterInput, req.user!);
  res.status(result.dryRun ? 200 : 201).json({ data: result });
}
