import { z } from 'zod';

export const loginSchema = z.object({
  nik: z.string().trim().min(1, 'NIK wajib diisi').max(30, 'NIK terlalu panjang'),
  password: z.string().min(1, 'Password wajib diisi').max(128, 'Password terlalu panjang'),
});

export type LoginInput = z.infer<typeof loginSchema>;
