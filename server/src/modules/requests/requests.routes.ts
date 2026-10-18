import { Router } from 'express';

export const requestsRoutes = Router();

// FASE 3: cuti, izin, sakit, lembur, tukar shift, koreksi absen
// Pola file di modul ini: requests.routes.ts -> requests.controller.ts -> requests.service.ts -> requests.repository.ts
// Logika bisnis HANYA di service. Controller tipis. Validasi input pakai zod (core/middleware/validate).

requestsRoutes.get('/_ping', (_req, res) => res.json({ module: 'requests', status: 'stub' }));
