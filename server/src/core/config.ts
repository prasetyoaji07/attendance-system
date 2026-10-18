import 'dotenv/config';
import { z } from 'zod';

const bool = z.enum(['true', 'false']).default('false').transform((v) => v === 'true');

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(3001),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  DB_HOST: z.string().default('localhost'),
  DB_PORT: z.coerce.number().default(3306),
  DB_USER: z.string().default('root'),
  DB_PASSWORD: z.string().default(''),
  DB_NAME: z.string().default('attendance'),
  DB_SSL: bool,
  JWT_SECRET: z.string().min(16, 'JWT_SECRET minimal 16 karakter'),
  JWT_EXPIRES_IN: z.string().default('8h'),
  QR_SECRET: z.string().min(16, 'QR_SECRET minimal 16 karakter'),
  RUN_JOBS: bool,
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error('Konfigurasi .env tidak valid:');
  for (const i of parsed.error.issues) console.error(` - ${i.path.join('.')}: ${i.message}`);
  process.exit(1);
}
export const config = parsed.data;
