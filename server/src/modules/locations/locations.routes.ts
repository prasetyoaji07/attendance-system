import { Router } from 'express';

export const locationsRoutes = Router();

// FASE 1: titik lokasi dan radius geofence
// Pola file di modul ini: locations.routes.ts -> locations.controller.ts -> locations.service.ts -> locations.repository.ts
// Logika bisnis HANYA di service. Controller tipis. Validasi input pakai zod (core/middleware/validate).

locationsRoutes.get('/_ping', (_req, res) => res.json({ module: 'locations', status: 'stub' }));
