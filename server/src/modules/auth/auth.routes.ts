import { Router } from 'express';

export const authRoutes = Router();

// FASE 1: login JWT, device binding
// Pola file di modul ini: auth.routes.ts -> auth.controller.ts -> auth.service.ts -> auth.repository.ts
// Logika bisnis HANYA di service. Controller tipis. Validasi input pakai zod (core/middleware/validate).

authRoutes.get('/_ping', (_req, res) => res.json({ module: 'auth', status: 'stub' }));
