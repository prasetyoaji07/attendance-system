import { Router } from 'express';
import { requireAuth } from '../../core/middleware/auth';
import { requireRole } from '../../core/middleware/rbac';
import { validate } from '../../core/middleware/validate';
import { createPattern, generate, list, listPatterns } from './roster.controller';
import { createPatternSchema, generateRosterSchema, listRosterQuerySchema } from './roster.schema';

export const rosterRoutes = Router();

rosterRoutes.use(requireAuth);
rosterRoutes.get('/', validate(listRosterQuerySchema, 'query'), list);
rosterRoutes.get('/patterns', listPatterns);
rosterRoutes.post('/patterns', requireRole('HRD', 'ADMIN'), validate(createPatternSchema), createPattern);
rosterRoutes.post('/generate', requireRole('SPV', 'HRD', 'ADMIN'), validate(generateRosterSchema), generate);
