import { describe, expect, it } from 'vitest';
import { signQr, verifyQr } from '../utils/hmac-qr';

const SECRET = 'rahasia-test-rahasia-test';
const TTL = 45;
const T0 = 1_700_000_000_000;

describe('QR dinamis', () => {
  it('token baru valid', () => {
    const t = signQr(7, SECRET, TTL, T0);
    expect(verifyQr(t, SECRET, TTL, T0)).toEqual({ valid: true, locationId: 7 });
  });
  it('masih valid 1 window setelahnya', () => {
    const t = signQr(7, SECRET, TTL, T0);
    expect(verifyQr(t, SECRET, TTL, T0 + TTL * 1000).valid).toBe(true);
  });
  it('expired setelah 2 window', () => {
    const t = signQr(7, SECRET, TTL, T0);
    const r = verifyQr(t, SECRET, TTL, T0 + TTL * 2000 + 1000);
    expect(r).toEqual({ valid: false, reason: 'EXPIRED' });
  });
  it('ditolak jika dimanipulasi atau secret berbeda', () => {
    const t = signQr(7, SECRET, TTL, T0);
    expect(verifyQr(t.replace(/^7\./, '8.'), SECRET, TTL, T0).valid).toBe(false);
    expect(verifyQr(t, 'secret-lain-secret-lain', TTL, T0).valid).toBe(false);
    expect(verifyQr('abc', SECRET, TTL, T0)).toEqual({ valid: false, reason: 'MALFORMED' });
  });
});
