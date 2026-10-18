import { describe, expect, it } from 'vitest';
import { loginSchema } from '../modules/auth/auth.schema';

describe('loginSchema', () => {
  it('menerima input normal dan memangkas spasi di NIK', () => {
    const r = loginSchema.safeParse({ nik: '  1001 ', password: 'rahasia123' });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.nik).toBe('1001');
  });

  it('menolak NIK atau password kosong, dan tipe yang salah', () => {
    expect(loginSchema.safeParse({ nik: '', password: 'x' }).success).toBe(false);
    expect(loginSchema.safeParse({ nik: '   ', password: 'x' }).success).toBe(false);
    expect(loginSchema.safeParse({ nik: '1001', password: '' }).success).toBe(false);
    expect(loginSchema.safeParse({ nik: 1001, password: 'x' }).success).toBe(false);
    expect(loginSchema.safeParse({}).success).toBe(false);
  });

  it('menolak input terlalu panjang', () => {
    expect(loginSchema.safeParse({ nik: 'a'.repeat(31), password: 'x' }).success).toBe(false);
    expect(loginSchema.safeParse({ nik: '1001', password: 'x'.repeat(129) }).success).toBe(false);
  });
});
