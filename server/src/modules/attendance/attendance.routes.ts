import { Router } from 'express';
import { requireAuth } from '../../core/middleware/auth';
import { validate } from '../../core/middleware/validate';
import { checkIn } from './attendance.controller';
import { checkInSchema } from './attendance.schema';

export const attendanceRoutes = Router();

attendanceRoutes.use(requireAuth);

// FASE 2: check-in selesai. Menyusul: check-out + auto-close, QR dinamis per lokasi, device binding.
// Pola file: attendance.routes.ts -> attendance.controller.ts -> attendance.service.ts -> attendance.repository.ts
// Logika bisnis HANYA di service. Controller tipis. Validasi input pakai zod (core/middleware/validate).
attendanceRoutes.post('/check-in', validate(checkInSchema), checkIn);
