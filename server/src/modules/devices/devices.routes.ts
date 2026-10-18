import { Router } from 'express';
import { requireAuth } from '../../core/middleware/auth';
import { requireRole } from '../../core/middleware/rbac';
import { validate } from '../../core/middleware/validate';
import { idParams } from '../../core/schemas';
import { approve, listPending, me, register, reject } from './devices.controller';
import { registerDeviceSchema } from './devices.schema';

export const devicesRoutes = Router();

devicesRoutes.use(requireAuth);

// Klien memanggil register setelah login. Perangkat pertama akun langsung active; berikutnya pending.
devicesRoutes.post('/register', validate(registerDeviceSchema), register);
// Status perangkat yang sedang dipakai (dari header X-Device-Id).
devicesRoutes.get('/me', me);
// Antrean persetujuan: hanya HRD dan ADMIN.
devicesRoutes.get('/pending', requireRole('HRD', 'ADMIN'), listPending);
devicesRoutes.post('/:id/approve', requireRole('HRD', 'ADMIN'), validate(idParams, 'params'), approve);
devicesRoutes.post('/:id/reject', requireRole('HRD', 'ADMIN'), validate(idParams, 'params'), reject);
