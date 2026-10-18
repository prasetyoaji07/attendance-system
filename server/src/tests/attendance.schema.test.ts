import { describe, expect, it } from 'vitest';
import { checkInSchema } from '../modules/attendance/attendance.schema';

const ok = { lat: -6.2, lng: 106.8, accuracyM: 12, qr: '1.2.abc' };

describe('checkInSchema', () => {
  it('menerima body yang benar', () => {
    expect(checkInSchema.safeParse(ok).success).toBe(true);
  });
  it('menolak koordinat di luar jangkauan atau bukan angka', () => {
    expect(checkInSchema.safeParse({ ...ok, lat: 91 }).success).toBe(false);
    expect(checkInSchema.safeParse({ ...ok, lng: -181 }).success).toBe(false);
    expect(checkInSchema.safeParse({ ...ok, lat: '-6.2' }).success).toBe(false);
  });
  it('menolak akurasi negatif dan QR kosong', () => {
    expect(checkInSchema.safeParse({ ...ok, accuracyM: -1 }).success).toBe(false);
    expect(checkInSchema.safeParse({ ...ok, qr: '' }).success).toBe(false);
  });
  it('menolak field yang hilang', () => {
    const { accuracyM: _akurasi, ...tanpaAkurasi } = ok;
    expect(checkInSchema.safeParse(tanpaAkurasi).success).toBe(false);
  });
});
