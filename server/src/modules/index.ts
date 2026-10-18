import { Router } from 'express';
import { attendanceRoutes } from './attendance/attendance.routes';
import { authRoutes } from './auth/auth.routes';
import { dashboardRoutes } from './dashboard/dashboard.routes';
import { employeesRoutes } from './employees/employees.routes';
import { locationsRoutes } from './locations/locations.routes';
import { overtimeRoutes } from './overtime/overtime.routes';
import { payrollRoutes } from './payroll/payroll.routes';
import { requestsRoutes } from './requests/requests.routes';
import { rosterRoutes } from './roster/roster.routes';
import { shiftsRoutes } from './shifts/shifts.routes';
import { workflowRoutes } from './workflow/workflow.routes';

export const apiRouter = Router();

apiRouter.use('/auth', authRoutes);
apiRouter.use('/employees', employeesRoutes);
apiRouter.use('/locations', locationsRoutes);
apiRouter.use('/shifts', shiftsRoutes);
apiRouter.use('/roster', rosterRoutes);
apiRouter.use('/attendance', attendanceRoutes);
apiRouter.use('/workflow', workflowRoutes);
apiRouter.use('/requests', requestsRoutes);
apiRouter.use('/overtime', overtimeRoutes);
apiRouter.use('/payroll', payrollRoutes);
apiRouter.use('/dashboard', dashboardRoutes);
