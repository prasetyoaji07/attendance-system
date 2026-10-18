import type { Request, Response } from 'express';
import { signToken } from '../../core/middleware/auth';
import { verifyPassword } from '../../core/password';
import type { LoginInput } from './auth.schema';
import { authRepository } from './auth.repository';
import { createAuthService } from './auth.service';

const service = createAuthService({ repo: authRepository, verifyPassword, signToken });

export async function login(_req: Request, res: Response) {
  const { nik, password } = res.locals.body as LoginInput;
  res.json(await service.login(nik, password));
}

export async function me(req: Request, res: Response) {
  res.json({ user: await service.me(req.user!.userId) });
}
