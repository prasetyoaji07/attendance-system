import { Router } from 'express';

export const dashboardRoutes = Router();

// FASE 5: query analitik
// Pola file di modul ini: dashboard.routes.ts -> dashboard.controller.ts -> dashboard.service.ts -> dashboard.repository.ts
// Logika bisnis HANYA di service. Controller tipis. Validasi input pakai zod (core/middleware/validate).

dashboardRoutes.get('/_ping', (_req, res) => res.json({ module: 'dashboard', status: 'stub' }));
