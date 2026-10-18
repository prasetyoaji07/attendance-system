import { Router } from 'express';

export const attendanceRoutes = Router();

// FASE 2: check-in/out, status harian, koreksi
// Pola file di modul ini: attendance.routes.ts -> attendance.controller.ts -> attendance.service.ts -> attendance.repository.ts
// Logika bisnis HANYA di service. Controller tipis. Validasi input pakai zod (core/middleware/validate).

attendanceRoutes.get('/_ping', (_req, res) => res.json({ module: 'attendance', status: 'stub' }));
