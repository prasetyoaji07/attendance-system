import { Router } from 'express';
import { requireAuth } from '../../core/middleware/auth';
import { requireRole } from '../../core/middleware/rbac';
import { validate } from '../../core/middleware/validate';
import { idParams } from '../../core/schemas';
import { create, get, list, remove, update } from './locations.controller';
import { createLocationSchema, updateLocationSchema } from './locations.schema';

export const locationsRoutes = Router();
const canManage = requireRole('HRD', 'ADMIN');

locationsRoutes.use(requireAuth);
locationsRoutes.get('/', list);
locationsRoutes.get('/:id', validate(idParams, 'params'), get);
locationsRoutes.post('/', canManage, validate(createLocationSchema), create);
locationsRoutes.patch('/:id', canManage, validate(idParams, 'params'), validate(updateLocationSchema), update);
locationsRoutes.delete('/:id', canManage, validate(idParams, 'params'), remove);
