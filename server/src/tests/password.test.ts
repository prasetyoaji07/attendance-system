import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword } from '../core/password';

describe('password', () => {
  it('hash bukan teks asli, dan verifikasi benar/salah bekerja', async () => {
    const hash = await hashPassword('rahasia123');
    expect(hash).not.toBe('rahasia123');
    expect(await verifyPassword('rahasia123', hash)).toBe(true);
    expect(await verifyPassword('salah', hash)).toBe(false);
  });

  it('hash null (akun tidak ada) selalu false', async () => {
    expect(await verifyPassword('apa-saja', null)).toBe(false);
  });
});
