import type { Request, Response } from 'express';
import { config } from '../../core/config';
import { runInTransaction } from '../../core/db-helpers';
import { RULES } from '../../core/rules';
import { attendanceRepository } from './attendance.repository';
import type { CheckInInput } from './attendance.schema';
import { createAttendanceService } from './attendance.service';

const service = createAttendanceService({
  repo: attendanceRepository,
  qrSecret: config.QR_SECRET,
  qrTtlSeconds: RULES.qrTtlSeconds,
  runInTransaction,
});

export async function checkIn(req: Request, res: Response) {
  const result = await service.checkIn(res.locals.body as CheckInInput, req.user!);
  res.status(201).json({ data: result });
}
