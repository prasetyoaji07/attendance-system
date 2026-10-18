import { describe, expect, it } from 'vitest';
import { buildShiftWindow, calcLateMinutes, pickActiveRoster, type ShiftDef } from '../utils/shift-time';

/** Helper: 'YYYY-MM-DD HH:mm' WIB -> Date absolut. */
const wib = (s: string) => new Date(`${s.replace(' ', 'T')}:00+07:00`);

const PAGI: ShiftDef = { startTime: '07:00', endTime: '15:00', lateToleranceMinutes: 5 };
const MALAM: ShiftDef = { startTime: '22:00', endTime: '06:00', lateToleranceMinutes: 5 };

describe('buildShiftWindow', () => {
  it('shift pagi: mulai dan selesai di tanggal yang sama (WIB)', () => {
    const w = buildShiftWindow('2026-10-19', PAGI);
    expect(w.startsAt.toISOString()).toBe('2026-10-19T00:00:00.000Z'); // 07:00 WIB
    expect(w.endsAt.toISOString()).toBe('2026-10-19T08:00:00.000Z'); // 15:00 WIB
    expect(w.shiftDate).toBe('2026-10-19');
  });

  it('shift malam: selesai di hari berikutnya, shiftDate tetap hari mulai', () => {
    const w = buildShiftWindow('2026-10-19', MALAM);
    expect(w.startsAt.getTime()).toBe(wib('2026-10-19 22:00').getTime());
    expect(w.endsAt.getTime()).toBe(wib('2026-10-20 06:00').getTime());
    expect(w.shiftDate).toBe('2026-10-19');
  });

  it('shift malam di akhir bulan dan akhir tahun', () => {
    expect(buildShiftWindow('2026-10-31', MALAM).endsAt.getTime()).toBe(wib('2026-11-01 06:00').getTime());
    expect(buildShiftWindow('2026-12-31', MALAM).endsAt.getTime()).toBe(wib('2027-01-01 06:00').getTime());
  });

  it('mulai = selesai dianggap lintas hari (24 jam)', () => {
    const w = buildShiftWindow('2026-10-19', { ...PAGI, endTime: '07:00' });
    expect(w.endsAt.getTime() - w.startsAt.getTime()).toBe(24 * 3_600_000);
  });

  it('input tidak valid melempar error', () => {
    expect(() => buildShiftWindow('19-10-2026', PAGI)).toThrow();
    expect(() => buildShiftWindow('2026-02-30', PAGI)).toThrow();
    expect(() => buildShiftWindow('2026-10-19', { ...PAGI, startTime: '25:00' })).toThrow();
    expect(() => buildShiftWindow('2026-10-19', { ...PAGI, endTime: '7:00' })).toThrow();
  });
});

describe('pickActiveRoster', () => {
  const malamKemarin = buildShiftWindow('2026-10-19', MALAM);
  const pagiHariIni = buildShiftWindow('2026-10-20', PAGI);

  it('shift malam: absen lewat tengah malam tetap masuk roster hari mulainya', () => {
    const r = pickActiveRoster(wib('2026-10-20 00:30'), [malamKemarin, pagiHariIni]);
    expect(r?.shiftDate).toBe('2026-10-19');
  });

  it('batas jendela inklusif: tepat mulai - 2 jam diterima, 1 menit sebelumnya ditolak', () => {
    expect(pickActiveRoster(wib('2026-10-20 05:00'), [pagiHariIni])).not.toBeNull();
    expect(pickActiveRoster(wib('2026-10-20 04:59'), [pagiHariIni])).toBeNull();
  });

  it('batas jendela inklusif: tepat selesai + 2 jam diterima, 1 menit sesudahnya ditolak', () => {
    expect(pickActiveRoster(wib('2026-10-20 17:00'), [pagiHariIni])).not.toBeNull();
    expect(pickActiveRoster(wib('2026-10-20 17:01'), [pagiHariIni])).toBeNull();
  });

  it('di luar jendela waktu ditolak (aturan 8)', () => {
    expect(pickActiveRoster(wib('2026-10-20 12:00'), [malamKemarin])).toBeNull();
  });

  it('tumpang tindih: pilih roster dengan jam mulai terdekat', () => {
    // 06:30: jendela malam (s/d 08:00) dan pagi (sejak 05:00) sama-sama memuat
    expect(pickActiveRoster(wib('2026-10-20 06:30'), [malamKemarin, pagiHariIni])?.shiftDate).toBe('2026-10-20');
    expect(pickActiveRoster(wib('2026-10-20 05:30'), [malamKemarin, pagiHariIni])?.shiftDate).toBe('2026-10-20');
  });

  it('tanpa kandidat mengembalikan null', () => {
    expect(pickActiveRoster(wib('2026-10-20 07:00'), [])).toBeNull();
  });
});

describe('calcLateMinutes', () => {
  const pagi = buildShiftWindow('2026-10-20', PAGI);
  const malam = buildShiftWindow('2026-10-19', MALAM);

  it('datang sebelum jam mulai: 0', () => {
    expect(calcLateMinutes(wib('2026-10-20 06:50'), pagi, 5)).toBe(0);
  });

  it('dalam toleransi bukan telat (aturan 2): 07:03 dan tepat 07:05 = 0', () => {
    expect(calcLateMinutes(wib('2026-10-20 07:03'), pagi, 5)).toBe(0);
    expect(calcLateMinutes(wib('2026-10-20 07:05'), pagi, 5)).toBe(0);
  });

  it('telat dihitung dari jam mulai + toleransi, bukan jam mulai (aturan 2)', () => {
    expect(calcLateMinutes(wib('2026-10-20 07:08'), pagi, 5)).toBe(3);
    expect(calcLateMinutes(wib('2026-10-20 08:00'), pagi, 5)).toBe(55);
  });

  it('dibulatkan ke bawah per menit penuh', () => {
    expect(calcLateMinutes(new Date(wib('2026-10-20 07:05').getTime() + 59_000), pagi, 5)).toBe(0);
    expect(calcLateMinutes(new Date(wib('2026-10-20 07:06').getTime()), pagi, 5)).toBe(1);
  });

  it('toleransi 0 menit', () => {
    expect(calcLateMinutes(wib('2026-10-20 07:01'), pagi, 0)).toBe(1);
  });

  it('shift malam: telat dihitung dari 22:00 hari mulai, meski absen lewat tengah malam (aturan 1)', () => {
    expect(calcLateMinutes(wib('2026-10-19 22:10'), malam, 5)).toBe(5);
    expect(calcLateMinutes(wib('2026-10-20 00:05'), malam, 5)).toBe(120);
  });
});
