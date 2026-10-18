import type { Request, Response } from 'express';
import { Router } from 'express';
import type { RowDataPacket } from 'mysql2';
import { z } from 'zod';
import { requireAuth } from '../../core/middleware/auth';
import { validate } from '../../core/middleware/validate';
import { dbOf } from '../../core/db-helpers';
import { isoDate } from '../../core/schemas';

/** Rentang maksimum yang boleh diminta sekaligus (hari). Cukup untuk satu bulan kalender plus sisa minggu. */
const MAX_RANGE_DAYS = 400;

export const listHolidaysQuerySchema = z
  .object({ from: isoDate, to: isoDate })
  .refine((v) => v.to >= v.from, { message: 'Tanggal akhir tidak boleh sebelum tanggal awal', path: ['to'] })
  .refine((v) => (Date.parse(v.to) - Date.parse(v.from)) / 86_400_000 < MAX_RANGE_DAYS, {
    message: `Rentang maksimal ${MAX_RANGE_DAYS} hari`,
    path: ['to'],
  });
export type ListHolidaysQuery = z.infer<typeof listHolidaysQuerySchema>;

interface HolidayRow extends RowDataPacket {
  tanggal: string;
  nama: string;
}

async function list(_req: Request, res: Response) {
  const { from, to } = res.locals.query as ListHolidaysQuery;
  const [rows] = await dbOf().execute<HolidayRow[]>(
    `SELECT DATE_FORMAT(tanggal, '%Y-%m-%d') AS tanggal, nama FROM holidays WHERE tanggal BETWEEN ? AND ? ORDER BY tanggal`,
    [from, to],
  );
  res.json({ data: rows.map((r) => ({ tanggal: r.tanggal, nama: r.nama })) });
}

export const holidaysRoutes = Router();
holidaysRoutes.use(requireAuth);
holidaysRoutes.get('/', validate(listHolidaysQuerySchema, 'query'), list);
