/**
 * Guard perangkat untuk check-in dan check-out (docs/alur.md 7.1: JWT -> perangkat -> roster ...).
 * Dipasang SETELAH requireAuth dan SEBELUM validasi body. Logika keputusan ada di devices.service.assertUsable
 * (aturan pure di utils/device-binding.ts); file ini hanya menyambungkannya ke Express supaya mudah dites.
 */
import type { NextFunction, Request, Response } from 'express';
import { AppError } from '../../core/errors';
import { DEVICE_HEADER } from '../../utils/device-binding';

export interface DeviceGuard {
  assertUsable(userId: number, deviceId: unknown): Promise<void>;
}

export const createRequireDevice =
  (guard: DeviceGuard) =>
  async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) return next(AppError.unauthorized());
    try {
      await guard.assertUsable(req.user.userId, req.headers[DEVICE_HEADER]);
      next();
    } catch (err) {
      next(err);
    }
  };
