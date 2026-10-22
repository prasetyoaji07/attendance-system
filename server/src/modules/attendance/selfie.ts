/**
 * Validasi selfie absen tanpa QR (docs/alur.md 7.1b, aturan bisnis 11). Fungsi murni, tanpa DB dan tanpa disk.
 * Selfie dikirim sebagai base64 JPEG di dalam JSON (boleh dengan awalan "data:image/jpeg;base64,").
 * Server memeriksa isinya benar-benar JPEG dan ukurannya wajar; tidak ada pencocokan wajah (biometrik, UU PDP).
 */
import { AppError } from '../../core/errors';
import { RULES } from '../../core/rules';

/** Rujukan selfie yang sudah tersimpan di penyimpanan, siap ditulis ke attendance_selfies. */
export interface NewSelfie {
  fileRef: string;
  capturedAt: Date;
  expiresAt: Date;
}

/** Batas panjang teks base64 untuk validasi schema (ukuran maksimal + awalan data URL). */
export const MAX_SELFIE_BASE64_CHARS = Math.ceil(RULES.maxSelfieBytes / 3) * 4 + 64;

const MIN_SELFIE_BYTES = 200;
const DATA_URL_PREFIX = /^data:image\/jpeg;base64,/i;
const BASE64 = /^[A-Za-z0-9+/]+={0,2}$/;

const invalid = (message: string) => new AppError(422, 'SELFIE_INVALID', message);

/** Ubah teks base64 jadi byte JPEG. Melempar AppError jika kosong, bukan JPEG, atau ukurannya tidak wajar. */
export function decodeSelfie(input: string | undefined): Buffer {
  if (input === undefined || input.trim() === '') {
    throw new AppError(
      422,
      'SELFIE_REQUIRED',
      'Absen tanpa QR wajib menyertakan selfie langsung dari kamera. Ambil selfie dulu ya.',
    );
  }
  const b64 = input.trim().replace(DATA_URL_PREFIX, '');
  if (!BASE64.test(b64) || b64.length % 4 !== 0) {
    throw invalid('Foto tidak bisa dibaca. Ambil ulang selfie.');
  }
  const bytes = Buffer.from(b64, 'base64');
  if (bytes.length > RULES.maxSelfieBytes) {
    throw invalid(`Foto terlalu besar (maksimal ${Math.round(RULES.maxSelfieBytes / 1000)} KB). Ambil ulang selfie.`);
  }
  if (bytes.length < MIN_SELFIE_BYTES) {
    throw invalid('Foto terlalu kecil atau rusak. Ambil ulang selfie.');
  }
  // Tanda awal berkas JPEG: FF D8 FF.
  if (!(bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff)) {
    throw invalid('Foto harus berformat JPEG. Ambil ulang selfie dari kamera.');
  }
  return bytes;
}

/** Selfie dihapus setelah masa simpan (RULES.selfieRetentionDays) dihitung dari saat diambil. */
export const selfieExpiry = (capturedAt: Date): Date =>
  new Date(capturedAt.getTime() + RULES.selfieRetentionDays * 86_400_000);
