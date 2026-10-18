import { z } from 'zod';
import { hhmm } from '../../core/schemas';

// Catatan: tanpa `.default()` di sini. Di zod 4, default di dalam `.partial()` ikut terisi
// dan akan menimpa nilai lama saat PATCH. Default toleransi diisi di service.
const shiftFields = z.object({
  nama: z.string().trim().min(1, 'Nama shift wajib diisi').max(50),
  jamMulai: hhmm,
  jamSelesai: hhmm,
  toleransiMenit: z.number().int().min(0).max(60),
});

export const createShiftSchema = z
  .object({ ...shiftFields.shape, toleransiMenit: shiftFields.shape.toleransiMenit.optional() })
  .refine((v) => v.jamMulai !== v.jamSelesai, {
    message: 'Jam mulai dan jam selesai tidak boleh sama',
    path: ['jamSelesai'],
  });

export const updateShiftSchema = shiftFields
  .partial()
  .refine((v) => Object.keys(v).length > 0, { message: 'Minimal satu field harus diubah' });

export type CreateShiftInput = z.infer<typeof createShiftSchema>;
export type UpdateShiftInput = z.infer<typeof updateShiftSchema>;
