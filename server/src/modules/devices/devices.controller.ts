import type { Request, Response } from 'express';
import { auditFn, runInTransaction } from '../../core/db-helpers';
import { DEVICE_HEADER } from '../../utils/device-binding';
import type { RegisterDeviceInput } from './devices.schema';
import { devicesRepository } from './devices.repository';
import { createDevicesService } from './devices.service';

/** Satu instance dipakai rute devices dan guard check-in/check-out (attendance.routes.ts). */
export const devicesService = createDevicesService({ repo: devicesRepository, audit: auditFn, runInTransaction });

export async function register(req: Request, res: Response) {
  const { deviceId } = res.locals.body as RegisterDeviceInput;
  const result = await devicesService.register(deviceId, req.user!);
  res.status(result.created ? 201 : 200).json({ data: result });
}

export async function me(req: Request, res: Response) {
  const result = await devicesService.me(req.headers[DEVICE_HEADER], req.user!);
  res.status(200).json({ data: result });
}

export async function listPending(_req: Request, res: Response) {
  res.status(200).json({ data: await devicesService.listPending() });
}

export async function approve(req: Request, res: Response) {
  const { id } = res.locals.params as { id: number };
  res.status(200).json({ data: await devicesService.approve(id, req.user!) });
}

export async function reject(req: Request, res: Response) {
  const { id } = res.locals.params as { id: number };
  await devicesService.reject(id, req.user!);
  res.status(200).json({ data: { id } });
}
