import { Router } from 'express';

export const rosterRoutes = Router();

// FASE 1: generate jadwal, tukar shift, validasi jeda
// Pola file di modul ini: roster.routes.ts -> roster.controller.ts -> roster.service.ts -> roster.repository.ts
// Logika bisnis HANYA di service. Controller tipis. Validasi input pakai zod (core/middleware/validate).

rosterRoutes.get('/_ping', (_req, res) => res.json({ module: 'roster', status: 'stub' }));
