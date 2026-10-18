import type { NextFunction, Request, Response } from 'express';
import { AppError } from '../errors';

export function notFoundHandler(_req: Request, _res: Response, next: NextFunction) {
  next(AppError.notFound('Endpoint tidak ada'));
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof AppError) {
    return res.status(err.status).json({ error: { code: err.code, message: err.message, details: err.details } });
  }
  console.error(err);
  res.status(500).json({ error: { code: 'INTERNAL', message: 'Terjadi kesalahan di server' } });
}
