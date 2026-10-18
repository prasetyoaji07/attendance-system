import { describe, expect, it } from 'vitest';
import { listHolidaysQuerySchema } from '../modules/holidays/holidays.routes';

describe('listHolidaysQuerySchema', () => {
  it('menerima rentang yang benar', () => {
    expect(listHolidaysQuerySchema.safeParse({ from: '2026-03-01', to: '2026-03-31' }).success).toBe(true);
  });
  it('menolak akhir sebelum awal', () => {
    expect(listHolidaysQuerySchema.safeParse({ from: '2026-03-31', to: '2026-03-01' }).success).toBe(false);
  });
  it('menolak format atau tanggal yang tidak ada', () => {
    expect(listHolidaysQuerySchema.safeParse({ from: '2026-02-30', to: '2026-03-01' }).success).toBe(false);
    expect(listHolidaysQuerySchema.safeParse({ from: '01-03-2026', to: '2026-03-31' }).success).toBe(false);
  });
  it('menolak rentang lebih dari 400 hari', () => {
    expect(listHolidaysQuerySchema.safeParse({ from: '2025-01-01', to: '2026-12-31' }).success).toBe(false);
  });
});
