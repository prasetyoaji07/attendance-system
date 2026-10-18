import type { NextFunction, Request, Response } from 'express';
import type { ZodType } from 'zod';
import { AppError } from '../errors';

/**
 * Validasi input dengan zod. Hasil parse disimpan di res.locals[source]
 * (bukan req.query, karena read-only di Express 5).
 * Contoh handler: const body = res.locals.body as CheckInInput;
 */
export const validate =
  (schema: ZodType, source: 'body' | 'query' | 'params' = 'body') =>
  (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      return next(new AppError(400, 'VALIDATION_ERROR', 'Input tidak valid', result.error.issues));
    }
    res.locals[source] = result.data;
    next();
  };
