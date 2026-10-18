import { Router } from 'express';

export const overtimeRoutes = Router();

// FASE 3: hitung lembur (irisan jam disetujui dan aktual)
// Pola file di modul ini: overtime.routes.ts -> overtime.controller.ts -> overtime.service.ts -> overtime.repository.ts
// Logika bisnis HANYA di service. Controller tipis. Validasi input pakai zod (core/middleware/validate).

overtimeRoutes.get('/_ping', (_req, res) => res.json({ module: 'overtime', status: 'stub' }));
