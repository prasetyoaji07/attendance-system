import { z } from 'zod';
import { RULES } from '../../core/rules';
import { isoDate } from '../../core/schemas';
import { daysBetween } from '../../utils/roster-rules';

const id = z.number().int().positive();

/** Rentang tanggal valid: akhir >= awal dan tidak lebih dari RULES.maxRosterRangeDays hari. */
const rangeOk = (v: { from: string; to: string }) => {
  try {
    const n = daysBetween(v.from, v.to);
    return n >= 0 && n < RULES.maxRosterRangeDays;
  } catch {
    // Tanggal tidak valid sudah dilaporkan oleh isoDate; jangan crash di sini.
    return true;
  }
};
const rangeMsg = { message: `Rentang tanggal harus 1 sampai ${RULES.maxRosterRangeDays} hari dan tanggal akhir tidak boleh sebelum awal`, path: ['to'] };

export const generateRosterSchema = z
  .object({
    patternId: id,
    locationId: id,
    from: isoDate,
    to: isoDate,
    /** Tanggal yang dianggap awal pola. Default: `from`. */
    anchorDate: isoDate.optional(),
    employees: z
      .array(z.object({ employeeId: id, offset: z.number().int().min(0).max(365).optional() }))
      .min(1, 'Pilih minimal satu karyawan')
      .max(200, 'Maksimal 200 karyawan per proses'),
    /** true = hanya hitung dan laporkan, tidak menyimpan apa pun. */
    dryRun: z.boolean().optional(),
  })
  .refine(rangeOk, rangeMsg);

export const listRosterQuerySchema = z
  .object({
    from: isoDate,
    to: isoDate,
    employeeId: z.coerce.number().int().positive().optional(),
  })
  .refine(rangeOk, rangeMsg);

export const createPatternSchema = z.object({
  nama: z.string().trim().min(1, 'Nama pola wajib diisi').max(100),
  urutan: z
    .array(z.string().trim().min(1, 'Nama shift di pola tidak boleh kosong').max(50))
    .min(1, 'Pola minimal 1 hari')
    .max(60, 'Pola maksimal 60 hari'),
});

export type GenerateRosterInput = z.infer<typeof generateRosterSchema>;
export type ListRosterQuery = z.infer<typeof listRosterQuerySchema>;
export type CreatePatternInput = z.infer<typeof createPatternSchema>;
