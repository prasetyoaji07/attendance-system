import { Router } from 'express';
import { requireAuth } from '../../core/middleware/auth';
import { requireRole } from '../../core/middleware/rbac';
import { validate } from '../../core/middleware/validate';
import { devicesService } from '../devices/devices.controller';
import { createRequireDevice } from '../devices/require-device';
import { checkIn, checkOut, getToday } from './attendance.controller';
import { checkInSchema, checkOutSchema } from './attendance.schema';
import { getSelfie, listReviews, markReview } from './review.controller';
import { reviewDecisionSchema, reviewIdParams } from './review.schema';

export const attendanceRoutes = Router();

attendanceRoutes.use(requireAuth);

// Urutan sesuai docs/alur.md 7.1: JWT -> perangkat (header X-Device-Id) -> validasi input -> logika di service.
const requireDevice = createRequireDevice(devicesService);

// FASE 2: check-in, check-out, QR dinamis, dan device binding (guard) terpasang.
// FASE 2b: jalur tanpa QR (selfie) lewat body yang sama; tinjauan HRD di bawah.
// Pola file: attendance.routes.ts -> attendance.controller.ts -> attendance.service.ts -> attendance.repository.ts
// Logika bisnis HANYA di service. Controller tipis. Validasi input pakai zod (core/middleware/validate).

// Hanya membaca, jadi tanpa requireDevice (status Beranda tetap tampil walau perangkat masih pending).
attendanceRoutes.get('/today', getToday);
attendanceRoutes.post('/check-in', requireDevice, validate(checkInSchema), checkIn);
attendanceRoutes.post('/check-out', requireDevice, validate(checkOutSchema), checkOut);

// Tinjauan absen tanpa QR: hanya HRD dan ADMIN.
attendanceRoutes.get('/reviews', requireRole('HRD', 'ADMIN'), listReviews);
attendanceRoutes.get('/selfies/:id', requireRole('HRD', 'ADMIN'), validate(reviewIdParams, 'params'), getSelfie);
attendanceRoutes.post(
  '/:id/review',
  requireRole('HRD', 'ADMIN'),
  validate(reviewIdParams, 'params'),
  validate(reviewDecisionSchema),
  markReview,
);
