import { describe, expect, it } from 'vitest';
import { closeDeadline, isPastCloseDeadline, pickAutoCloseTargets } from '../utils/auto-close';
import { buildShiftWindow, type ShiftDef } from '../utils/shift-time';

const wib = (s: string) => new Date(`${s}+07:00`);
const PAGI: ShiftDef = { startTime: '06:00', endTime: '14:00', lateToleranceMinutes: 5 };
const MALAM: ShiftDef = { startTime: '22:00', endTime: '06:00', lateToleranceMinutes: 5 };

describe('isPastCloseDeadline (batas akhir = selesai shift + 2 jam, dari RULES)', () => {
  const pagi = buildShiftWindow('2026-10-18', PAGI);

  it('batas akhir shift pagi 14:00 adalah 16:00 WIB', () => {
    expect(closeDeadline(pagi).getTime()).toBe(wib('2026-10-18T16:00:00').getTime());
  });

  it('tepat di batas masih belum lewat (inklusif), satu detik sesudahnya sudah lewat', () => {
    expect(isPastCloseDeadline(wib('2026-10-18T16:00:00'), pagi)).toBe(false);
    expect(isPastCloseDeadline(wib('2026-10-18T16:00:01'), pagi)).toBe(true);
  });

  it('sebelum shift selesai belum lewat', () => {
    expect(isPastCloseDeadline(wib('2026-10-18T10:00:00'), pagi)).toBe(false);
  });

  it('shift malam: batas akhir ada di hari berikutnya (06:00 + 2 jam = 08:00)', () => {
    const malam = buildShiftWindow('2026-10-18', MALAM);
    expect(closeDeadline(malam).getTime()).toBe(wib('2026-10-19T08:00:00').getTime());
    expect(isPastCloseDeadline(wib('2026-10-19T07:59:00'), malam)).toBe(false);
    expect(isPastCloseDeadline(wib('2026-10-19T08:01:00'), malam)).toBe(true);
  });
});

describe('pickAutoCloseTargets', () => {
  const rows = [
    { attendanceId: 1, shiftDate: '2026-10-17', shift: PAGI }, // sudah lama lewat
    { attendanceId: 2, shiftDate: '2026-10-18', shift: PAGI }, // 14:00, batas 16:00
    { attendanceId: 3, shiftDate: '2026-10-17', shift: MALAM }, // selesai 18 Okt 06:00, batas 08:00
    { attendanceId: 4, shiftDate: '2026-10-18', shift: MALAM }, // baru mulai malam ini
  ];

  it('hanya yang batas akhirnya sudah lewat', () => {
    expect(pickAutoCloseTargets(wib('2026-10-18T15:00:00'), rows)).toEqual([1, 3]);
    expect(pickAutoCloseTargets(wib('2026-10-18T16:30:00'), rows)).toEqual([1, 2, 3]);
    expect(pickAutoCloseTargets(wib('2026-10-19T08:30:00'), rows)).toEqual([1, 2, 3, 4]);
  });

  it('daftar kosong menghasilkan daftar kosong', () => {
    expect(pickAutoCloseTargets(wib('2026-10-18T15:00:00'), [])).toEqual([]);
  });
});
