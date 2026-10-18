import { describe, expect, it } from 'vitest';
import type { AuthUser } from '../core/middleware/auth';
import { createAuthService, type AccountRecord, type AuthRepository } from '../modules/auth/auth.service';

const budi: AccountRecord = {
  userId: 1,
  employeeId: 10,
  passwordHash: 'hash:rahasia123',
  role: 'HRD',
  nik: '1001',
  nama: 'Budi',
  aktif: true,
  departmentId: 3,
  departmentNama: 'Produksi',
  atasanId: null,
};

function setup(accounts: AccountRecord[] = [budi]) {
  const calls: { plain: string; hash: string | null }[] = [];
  const repo: AuthRepository = {
    findByNik: async (nik) => accounts.find((a) => a.nik === nik) ?? null,
    findByUserId: async (id) => accounts.find((a) => a.userId === id) ?? null,
  };
  const service = createAuthService({
    repo,
    verifyPassword: async (plain, hash) => {
      calls.push({ plain, hash });
      return hash !== null && hash === `hash:${plain}`;
    },
    signToken: (u: AuthUser) => `token-${u.userId}-${u.role}`,
  });
  return { service, calls };
}

describe('auth.login', () => {
  it('berhasil: mengembalikan token dan profil tanpa password hash', async () => {
    const { service } = setup();
    const r = await service.login('1001', 'rahasia123');
    expect(r.token).toBe('token-1-HRD');
    expect(r.user).toEqual({
      userId: 1, employeeId: 10, nik: '1001', nama: 'Budi', role: 'HRD',
      department: { id: 3, nama: 'Produksi' }, atasanId: null,
    });
    expect(JSON.stringify(r)).not.toContain('hash:');
  });

  it('password salah: 401 INVALID_CREDENTIALS', async () => {
    const { service } = setup();
    await expect(service.login('1001', 'salah')).rejects.toMatchObject({ status: 401, code: 'INVALID_CREDENTIALS' });
  });

  it('NIK tidak ada: error sama persis dengan password salah, dan verifikasi tetap dijalankan (hash null)', async () => {
    const { service, calls } = setup();
    const wrongPass = await service.login('1001', 'salah').catch((e) => e);
    const unknownNik = await service.login('9999', 'apa-saja').catch((e) => e);
    expect(unknownNik.status).toBe(wrongPass.status);
    expect(unknownNik.code).toBe(wrongPass.code);
    expect(unknownNik.message).toBe(wrongPass.message);
    expect(calls[calls.length - 1]).toEqual({ plain: 'apa-saja', hash: null });
  });

  it('akun nonaktif + password benar: 403', async () => {
    const { service } = setup([{ ...budi, aktif: false }]);
    await expect(service.login('1001', 'rahasia123')).rejects.toMatchObject({ status: 403, code: 'FORBIDDEN' });
  });

  it('akun nonaktif + password salah: tetap 401 (status akun tidak bocor)', async () => {
    const { service } = setup([{ ...budi, aktif: false }]);
    await expect(service.login('1001', 'salah')).rejects.toMatchObject({ status: 401, code: 'INVALID_CREDENTIALS' });
  });
});

describe('auth.me', () => {
  it('mengembalikan profil terbaru dari DB', async () => {
    const { service } = setup([{ ...budi, role: 'SPV' }]);
    const u = await service.me(1);
    expect(u.role).toBe('SPV');
    expect(u.nama).toBe('Budi');
  });

  it('user tidak ditemukan: 401', async () => {
    const { service } = setup();
    await expect(service.me(999)).rejects.toMatchObject({ status: 401 });
  });

  it('karyawan nonaktif dengan token lama: 401', async () => {
    const { service } = setup([{ ...budi, aktif: false }]);
    await expect(service.me(1)).rejects.toMatchObject({ status: 401 });
  });
});
