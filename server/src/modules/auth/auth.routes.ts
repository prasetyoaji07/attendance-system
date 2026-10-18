import { Router } from 'express';
import { requireAuth } from '../../core/middleware/auth';
import { validate } from '../../core/middleware/validate';
import { login, me } from './auth.controller';
import { loginSchema } from './auth.schema';

export const authRoutes = Router();

// Device binding (daftar, pending, approval ganti device) dikerjakan di Fase 2.
authRoutes.post('/login', validate(loginSchema), login);
authRoutes.get('/me', requireAuth, me);
