import { Router } from 'express';
import { requireAuth } from '../../core/middleware/auth';
import { validate } from '../../core/middleware/validate';
import { devicesService } from '../devices/devices.controller';
import { createRequireDevice } from '../devices/require-device';
import { checkIn, checkOut } from './attendance.controller';
import { checkInSchema, checkOutSchema } from './attendance.schema';

export const attendanceRoutes = Router();

attendanceRoutes.use(requireAuth);

// Urutan sesuai docs/alur.md 7.1: JWT -> perangkat (header X-Device-Id) -> validasi input -> logika di service.
const requireDevice = createRequireDevice(devicesService);

// FASE 2: check-in, check-out, QR dinamis, dan device binding (guard) terpasang.
// Pola file: attendance.routes.ts -> attendance.controller.ts -> attendance.service.ts -> attendance.repository.ts
// Logika bisnis HANYA di service. Controller tipis. Validasi input pakai zod (core/middleware/validate).
attendanceRoutes.post('/check-in', requireDevice, validate(checkInSchema), checkIn);
attendanceRoutes.post('/check-out', requireDevice, validate(checkOutSchema), checkOut);
