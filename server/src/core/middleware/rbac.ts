import type { NextFunction, Request, Response } from 'express';
import { AppError } from '../errors';
import type { Role } from '../roles';

/** Pakai setelah requireAuth. Contoh: router.post('/', requireAuth, requireRole('HRD','ADMIN'), ...) */
export const requireRole =
  (...allowed: Role[]) =>
  (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(AppError.unauthorized());
    if (!allowed.includes(req.user.role)) return next(AppError.forbidden());
    next();
  };
