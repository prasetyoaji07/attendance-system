import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * QR dinamis: token berganti tiap `ttlSeconds`. Format: `${locationId}.${window}.${signature}`.
 * Pure function (secret dikirim sebagai argumen) supaya mudah di-test.
 */
const windowOf = (nowMs: number, ttlSeconds: number) => Math.floor(nowMs / (ttlSeconds * 1000));
const sign = (secret: string, payload: string) =>
  createHmac('sha256', secret).update(payload).digest('base64url').slice(0, 22);

export function signQr(locationId: number, secret: string, ttlSeconds: number, nowMs = Date.now()): string {
  const w = windowOf(nowMs, ttlSeconds);
  return `${locationId}.${w}.${sign(secret, `${locationId}.${w}`)}`;
}

/** Akhir window yang berlaku pada `nowMs` (epoch ms): kapan layar harus mengambil token baru. */
export function qrWindowEndMs(nowMs: number, ttlSeconds: number): number {
  return (windowOf(nowMs, ttlSeconds) + 1) * ttlSeconds * 1000;
}

export type QrResult =
  | { valid: true; locationId: number }
  | { valid: false; reason: 'MALFORMED' | 'BAD_SIGNATURE' | 'EXPIRED' };

/** Toleransi 1 window ke belakang (karyawan scan tepat saat QR berganti). */
export function verifyQr(token: string, secret: string, ttlSeconds: number, nowMs = Date.now()): QrResult {
  const parts = token.split('.');
  if (parts.length !== 3) return { valid: false, reason: 'MALFORMED' };
  const locationId = Number(parts[0]);
  const w = Number(parts[1]);
  if (!Number.isInteger(locationId) || !Number.isInteger(w)) return { valid: false, reason: 'MALFORMED' };

  const expected = Buffer.from(sign(secret, `${locationId}.${w}`));
  const actual = Buffer.from(parts[2]);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    return { valid: false, reason: 'BAD_SIGNATURE' };
  }
  const current = windowOf(nowMs, ttlSeconds);
  if (w > current || current - w > 1) return { valid: false, reason: 'EXPIRED' };
  return { valid: true, locationId };
}
