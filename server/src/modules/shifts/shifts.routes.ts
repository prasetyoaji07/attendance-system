import { Router } from 'express';
import { requireAuth } from '../../core/middleware/auth';
import { requireRole } from '../../core/middleware/rbac';
import { validate } from '../../core/middleware/validate';
import { idParams } from '../../core/schemas';
import { create, get, list, remove, update } from './shifts.controller';
import { createShiftSchema, updateShiftSchema } from './shifts.schema';

export const shiftsRoutes = Router();
const canManage = requireRole('HRD', 'ADMIN');

shiftsRoutes.use(requireAuth);
shiftsRoutes.get('/', list);
shiftsRoutes.get('/:id', validate(idParams, 'params'), get);
shiftsRoutes.post('/', canManage, validate(createShiftSchema), create);
shiftsRoutes.patch('/:id', canManage, validate(idParams, 'params'), validate(updateShiftSchema), update);
shiftsRoutes.delete('/:id', canManage, validate(idParams, 'params'), remove);
