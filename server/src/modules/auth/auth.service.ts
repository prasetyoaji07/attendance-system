/**
 * Logika bisnis auth. Sengaja tidak mengimpor DB/config: semua dependensi disuntik
 * lewat `createAuthService`, jadi bisa di-unit-test tanpa database. Penyambungan ada di auth.controller.ts.
 */
import type { AuthUser } from '../../core/middleware/auth';
import { AppError } from '../../core/errors';
import type { Role } from '../../core/roles';

export interface AccountRecord {
  userId: number;
  employeeId: number;
  passwordHash: string;
  role: Role;
  nik: string;
  nama: string;
  aktif: boolean;
  departmentId: number;
  departmentNama: string;
  atasanId: number | null;
}

export interface AuthRepository {
  findByNik(nik: string): Promise<AccountRecord | null>;
  findByUserId(userId: number): Promise<AccountRecord | null>;
}

export interface AuthDeps {
  repo: AuthRepository;
  verifyPassword(plain: string, hash: string | null): Promise<boolean>;
  signToken(user: AuthUser): string;
}

export interface PublicUser {
  userId: number;
  employeeId: number;
  nik: string;
  nama: string;
  role: Role;
  department: { id: number; nama: string };
  atasanId: number | null;
}

const toPublicUser = (a: AccountRecord): PublicUser => ({
  userId: a.userId,
  employeeId: a.employeeId,
  nik: a.nik,
  nama: a.nama,
  role: a.role,
  department: { id: a.departmentId, nama: a.departmentNama },
  atasanId: a.atasanId,
});

export function createAuthService({ repo, verifyPassword, signToken }: AuthDeps) {
  return {
    async login(nik: string, password: string): Promise<{ token: string; user: PublicUser }> {
      const account = await repo.findByNik(nik);
      // Selalu verifikasi (hash null jika akun tidak ada) dan pakai pesan yang sama,
      // supaya penyerang tidak bisa membedakan "NIK tidak ada" dari "password salah".
      const ok = await verifyPassword(password, account?.passwordHash ?? null);
      if (!account || !ok) {
        throw new AppError(401, 'INVALID_CREDENTIALS', 'NIK atau password salah. Cek lagi ya.');
      }
      // Dicek setelah password benar, agar status akun tidak bocor ke orang yang tidak berhak.
      if (!account.aktif) {
        throw AppError.forbidden('Akun kamu sudah nonaktif. Hubungi HRD kalau ini keliru.');
      }
      const token = signToken({ userId: account.userId, employeeId: account.employeeId, role: account.role });
      return { token, user: toPublicUser(account) };
    },

    /** Data terbaru dari DB (bukan dari isi token), supaya perubahan role/status langsung terasa. */
    async me(userId: number): Promise<PublicUser> {
      const account = await repo.findByUserId(userId);
      if (!account || !account.aktif) {
        throw AppError.unauthorized('Sesi tidak valid. Silakan login lagi.');
      }
      return toPublicUser(account);
    },
  };
}

export type AuthService = ReturnType<typeof createAuthService>;
