import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { AppError } from '../errors';
import type { Role } from '../roles';

export interface AuthUser {
  userId: number;
  employeeId: number;
  role: Role;
}

declare module 'express-serve-static-core' {
  interface Request {
    user?: AuthUser;
  }
}

export function signToken(user: AuthUser): string {
  return jwt.sign(user, config.JWT_SECRET, { expiresIn: config.JWT_EXPIRES_IN } as jwt.SignOptions);
}

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return next(AppError.unauthorized());
  try {
    req.user = jwt.verify(header.slice(7), config.JWT_SECRET) as AuthUser;
    next();
  } catch {
    next(AppError.unauthorized('Token tidak valid atau kedaluwarsa'));
  }
}
