import bcrypt from 'bcryptjs';

const BCRYPT_COST = 10;

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_COST);
}

/** Hash palsu untuk menyamakan waktu respons saat NIK tidak ditemukan (cegah tebak NIK lewat selisih waktu). */
let dummyHash: Promise<string> | null = null;

/**
 * Bandingkan password dengan hash. Jika `hash` null (akun tidak ada), tetap jalankan
 * perbandingan ke hash palsu lalu kembalikan false.
 */
export async function verifyPassword(plain: string, hash: string | null): Promise<boolean> {
  if (hash === null) {
    dummyHash ??= hashPassword('bukan-password-asli');
    await bcrypt.compare(plain, await dummyHash);
    return false;
  }
  return bcrypt.compare(plain, hash);
}
