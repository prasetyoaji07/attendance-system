import { z } from 'zod';

// Tanpa `.default()` (lihat catatan di shifts.schema.ts). Default radius diisi di service.
const locationFields = z.object({
  nama: z.string().trim().min(1, 'Nama lokasi wajib diisi').max(100),
  lat: z.number().min(-90, 'Latitude -90 sampai 90').max(90, 'Latitude -90 sampai 90'),
  lng: z.number().min(-180, 'Longitude -180 sampai 180').max(180, 'Longitude -180 sampai 180'),
  radiusM: z.number().int().min(10, 'Radius minimal 10 m').max(2000, 'Radius maksimal 2000 m'),
  // Opsional. Kosong atau null = tidak ada alamat (disimpan NULL oleh service).
  alamat: z.string().trim().max(200, 'Alamat maksimal 200 karakter').nullable(),
});

export const createLocationSchema = z.object({
  ...locationFields.shape,
  radiusM: locationFields.shape.radiusM.optional(),
  alamat: locationFields.shape.alamat.optional(),
});

export const updateLocationSchema = locationFields
  .partial()
  .refine((v) => Object.keys(v).length > 0, { message: 'Minimal satu field harus diubah' });

export type CreateLocationInput = z.infer<typeof createLocationSchema>;
export type UpdateLocationInput = z.infer<typeof updateLocationSchema>;
