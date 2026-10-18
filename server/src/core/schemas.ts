import { z } from 'zod';

/** Param `:id` di URL. */
export const idParams = z.object({ id: z.coerce.number().int().positive() });

/** Jam 'HH:mm' (24 jam). */
export const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Format jam harus HH:mm, contoh 07:00');

function isRealDate(s: string): boolean {
  const [y, m, d] = s.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d));
  return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d;
}

/** Tanggal 'YYYY-MM-DD' yang benar-benar ada di kalender. */
export const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal harus YYYY-MM-DD')
  .refine(isRealDate, 'Tanggal tidak ada di kalender');

/** Password baru. bcrypt hanya memakai 72 byte pertama, jadi batasnya di situ. */
export const passwordSchema = z
  .string()
  .min(8, 'Password minimal 8 karakter')
  .refine((p) => Buffer.byteLength(p, 'utf8') <= 72, 'Password maksimal 72 byte');
