import { Router } from 'express';

export const payrollRoutes = Router();

// FASE 4: periode, kunci, export Excel
// Pola file di modul ini: payroll.routes.ts -> payroll.controller.ts -> payroll.service.ts -> payroll.repository.ts
// Logika bisnis HANYA di service. Controller tipis. Validasi input pakai zod (core/middleware/validate).

payrollRoutes.get('/_ping', (_req, res) => res.json({ module: 'payroll', status: 'stub' }));
