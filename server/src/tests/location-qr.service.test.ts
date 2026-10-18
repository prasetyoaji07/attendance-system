import { describe, expect, it } from 'vitest';
import { createLocationQrService } from '../modules/locations/location-qr.service';
import { qrWindowEndMs, verifyQr } from '../utils/hmac-qr';

const SECRET = 'rahasia-test-rahasia-test';
const TTL = 45;
// T0 berada di tengah sebuah window: window berakhir tepat 10 detik kemudian.
const T0 = 1_700_000_000_000;
const WINDOW_END = 1_700_000_010_000;

const locations = {
  findById: async (id: number) => (id === 7 ? { id: 7, nama: 'Gedung A' } : id === 8 ? { id: 8, nama: 'Gedung B' } : null),
};
const make = (nowMs = T0) => createLocationQrService({ locations, secret: SECRET, ttlSeconds: TTL, now: () => new Date(nowMs) });

describe('qrWindowEndMs', () => {
  it('akhir window yang sedang berjalan', () => {
    expect(qrWindowEndMs(T0, TTL)).toBe(WINDOW_END);
  });
  it('tepat di batas window sudah masuk window berikutnya', () => {
    expect(qrWindowEndMs(WINDOW_END, TTL)).toBe(WINDOW_END + TTL * 1000);
    expect(qrWindowEndMs(WINDOW_END - 1, TTL)).toBe(WINDOW_END);
  });
});

describe('locationQr.get', () => {
  it('menghasilkan token yang lolos verifyQr untuk lokasi yang sama', async () => {
    const r = await make().get(7);
    expect(verifyQr(r.token, SECRET, TTL, T0)).toEqual({ valid: true, locationId: 7 });
    expect(r).toMatchObject({ locationId: 7, locationNama: 'Gedung A', ttlSeconds: TTL });
  });

  it('refreshAt = akhir window sekarang (ISO UTC)', async () => {
    const r = await make().get(7);
    expect(r.refreshAt).toBe(new Date(WINDOW_END).toISOString());
  });

  it('token layar yang telat refresh masih valid sampai akhir window berikutnya, lalu kedaluwarsa', async () => {
    const { token } = await make().get(7);
    expect(verifyQr(token, SECRET, TTL, WINDOW_END + TTL * 1000 - 1).valid).toBe(true);
    expect(verifyQr(token, SECRET, TTL, WINDOW_END + TTL * 1000)).toEqual({ valid: false, reason: 'EXPIRED' });
  });

  it('token berganti di window berikutnya', async () => {
    const a = await make(T0).get(7);
    const b = await make(WINDOW_END).get(7);
    expect(a.token).not.toBe(b.token);
  });

  it('token tiap lokasi berbeda dan menunjuk lokasinya sendiri', async () => {
    const a = await make().get(7);
    const b = await make().get(8);
    expect(a.token).not.toBe(b.token);
    expect(verifyQr(b.token, SECRET, TTL, T0)).toEqual({ valid: true, locationId: 8 });
  });

  it('secret yang berbeda tidak bisa memverifikasi token', async () => {
    const { token } = await make().get(7);
    expect(verifyQr(token, 'secret-lain-secret-lain', TTL, T0).valid).toBe(false);
  });

  it('lokasi tidak ada: 404', async () => {
    await expect(make().get(999)).rejects.toMatchObject({ status: 404 });
  });
});
