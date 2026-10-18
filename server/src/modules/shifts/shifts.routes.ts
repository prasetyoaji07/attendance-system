import { Router } from 'express';

export const shiftsRoutes = Router();

// FASE 1: master shift dan pola rotasi
// Pola file di modul ini: shifts.routes.ts -> shifts.controller.ts -> shifts.service.ts -> shifts.repository.ts
// Logika bisnis HANYA di service. Controller tipis. Validasi input pakai zod (core/middleware/validate).

shiftsRoutes.get('/_ping', (_req, res) => res.json({ module: 'shifts', status: 'stub' }));
