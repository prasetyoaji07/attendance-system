import type { Request, Response } from 'express';
import { config } from '../../core/config';
import { runInTransaction } from '../../core/db-helpers';
import { RULES } from '../../core/rules';
import { attendanceRepository } from './attendance.repository';
import type { CheckInInput, CheckOutInput } from './attendance.schema';
import { createAttendanceService } from './attendance.service';
import { checkOutRepository } from './checkout.repository';
import { createCheckOutService } from './checkout.service';

const qr = { qrSecret: config.QR_SECRET, qrTtlSeconds: RULES.qrTtlSeconds };

const service = createAttendanceService({ repo: attendanceRepository, ...qr, runInTransaction });
const checkOutService = createCheckOutService({ repo: checkOutRepository, ...qr, runInTransaction });

export async function checkIn(req: Request, res: Response) {
  const result = await service.checkIn(res.locals.body as CheckInInput, req.user!);
  res.status(201).json({ data: result });
}

export async function checkOut(req: Request, res: Response) {
  const result = await checkOutService.checkOut(res.locals.body as CheckOutInput, req.user!);
  res.status(200).json({ data: result });
}
