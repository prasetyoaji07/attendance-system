import { describe, expect, it } from 'vitest';
import { assertNoExistingCheckIn, calcEarlyLeaveMinutes, computeDailyStatus, type DailyStatusInput } from '../utils/daily-status';
import { buildShiftWindow } from '../utils/shift-time';

// Waktu dinding WIB (UTC+7) pada 2026-03-10 + dayOffset.
const wib = (hhmm: string, dayOffset = 0): Date => {
  const [h, m] = hhmm.split(':').map(Number);
  return new Date(Date.UTC(2026, 2, 10 + dayOffset, h - 7, m));
};

const pagi = buildShiftWindow('2026-03-10', { startTime: '06:00', endTime: '14:00', lateToleranceMinutes: 5 });
const malam = buildShiftWindow('2026-03-10', { startTime: '22:00', endTime: '06:00', lateToleranceMinutes: 5 });

const base = (over: Partial<DailyStatusInput>): DailyStatusInput => ({
  now: wib('15:00'),
  window: pagi,
  toleranceMinutes: 5,
  attendance: null,
  ...over,
});
const came = (inAt: string, outAt: string | null, dayOut = 0) => ({
  checkInAt: wib(inAt),
  checkOutAt: outAt ? wib(outAt, dayOut) : null,
});

describe('computeDailyStatus: hadir', () => {
  it('check-in dan check-out normal setelah shift selesai: HADIR final', () => {
    const r = computeDailyStatus(base({ attendance: came('05:58', '14:02') }));
    expect(r).toEqual({ status: 'HADIR', final: true, lateMinutes: 0, earlyLeaveMinutes: 0, needsCorrection: false });
  });

  it('batas telat: tepat jam mulai + toleransi (06:05) bukan telat, 06:06 telat 1 menit (aturan 2)', () => {
    expect(computeDailyStatus(base({ attendance: came('06:05', '14:00') })).status).toBe('HADIR');
    const r = computeDailyStatus(base({ attendance: came('06:06', '14:00') }));
    expect(r).toMatchObject({ status: 'TELAT', lateMinutes: 1 });
  });

  it('batas pulang cepat: check-out 13:55 aman, 13:54 pulang cepat 1 menit', () => {
    expect(computeDailyStatus(base({ attendance: came('06:00', '13:55') })).status).toBe('HADIR');
    const r = computeDailyStatus(base({ attendance: came('06:00', '13:54') }));
    expect(r).toMatchObject({ status: 'PULANG_CEPAT', earlyLeaveMinutes: 1, lateMinutes: 0 });
  });

  it('pulang jam 13:00: pulang cepat 55 menit (dihitung dari selesai - toleransi)', () => {
    const r = computeDailyStatus(base({ attendance: came('06:00', '13:00') }));
    expect(r).toMatchObject({ status: 'PULANG_CEPAT', earlyLeaveMinutes: 55 });
  });

  it('telat dan pulang cepat sekaligus: status TELAT, kedua menit tetap dilaporkan', () => {
    const r = computeDailyStatus(base({ attendance: came('06:30', '13:00') }));
    expect(r).toMatchObject({ status: 'TELAT', lateMinutes: 25, earlyLeaveMinutes: 55 });
  });

  it('toleransi shift dipakai untuk telat dan pulang cepat', () => {
    const r = computeDailyStatus(base({ toleranceMinutes: 10, attendance: came('06:10', '13:50') }));
    expect(r.status).toBe('HADIR');
  });
});

describe('computeDailyStatus: shift belum selesai', () => {
  it('belum check-in: belum final, status null', () => {
    const r = computeDailyStatus(base({ now: wib('07:00') }));
    expect(r).toEqual({ status: null, final: false, lateMinutes: 0, earlyLeaveMinutes: 0, needsCorrection: false });
  });

  it('sudah check-in tapi belum check-out: status sementara, tidak perlu koreksi', () => {
    const r = computeDailyStatus(base({ now: wib('10:00'), attendance: came('06:10', null) }));
    expect(r).toMatchObject({ status: 'TELAT', final: false, lateMinutes: 5, needsCorrection: false });
  });

  it('tepat di jam selesai sudah dianggap selesai', () => {
    expect(computeDailyStatus(base({ now: wib('14:00') })).final).toBe(true);
    expect(computeDailyStatus(base({ now: wib('13:59') })).final).toBe(false);
  });

  it('cuti yang sudah disetujui menjadi status sementara sebelum shift selesai', () => {
    const r = computeDailyStatus(base({ now: wib('07:00'), approvedLeave: 'CUTI' }));
    expect(r).toMatchObject({ status: 'CUTI', final: false });
  });
});

describe('computeDailyStatus: setelah shift selesai', () => {
  it('check-in tanpa check-out: status dari check-in + needsCorrection', () => {
    const r = computeDailyStatus(base({ attendance: came('06:00', null) }));
    expect(r).toMatchObject({ status: 'HADIR', final: true, needsCorrection: true });
    const telat = computeDailyStatus(base({ attendance: came('06:20', null) }));
    expect(telat).toMatchObject({ status: 'TELAT', needsCorrection: true });
  });

  it('tanpa attendance dan tanpa pengajuan: ALPA', () => {
    expect(computeDailyStatus(base({})).status).toBe('ALPA');
  });

  it('cuti, izin, sakit yang APPROVED menggantikan ALPA', () => {
    for (const s of ['CUTI', 'IZIN', 'SAKIT'] as const) {
      expect(computeDailyStatus(base({ approvedLeave: s })).status).toBe(s);
    }
  });

  it('hari libur nasional: LIBUR, tetapi cuti yang disetujui lebih diutamakan', () => {
    expect(computeDailyStatus(base({ isHoliday: true })).status).toBe('LIBUR');
    expect(computeDailyStatus(base({ isHoliday: true, approvedLeave: 'SAKIT' })).status).toBe('SAKIT');
  });

  it('kehadiran nyata menang atas cuti/izin/sakit', () => {
    const r = computeDailyStatus(base({ approvedLeave: 'CUTI', attendance: came('06:00', '14:00') }));
    expect(r.status).toBe('HADIR');
  });

  it('idempotent: input sama selalu hasil sama (aman dijalankan cron dua kali)', () => {
    const input = base({ attendance: came('06:30', '13:00') });
    expect(computeDailyStatus(input)).toEqual(computeDailyStatus(input));
  });

  it('check-out sebelum check-in adalah data rusak dan melempar error', () => {
    expect(() => computeDailyStatus(base({ attendance: came('10:00', '09:00') }))).toThrow();
  });
});

describe('computeDailyStatus: shift malam (aturan 1)', () => {
  const malamIn = (inAt: string, outAt: string | null) => ({
    checkInAt: wib(inAt),
    checkOutAt: outAt ? wib(outAt, 1) : null, // check-out di hari kalender berikutnya
  });

  it('22:03 sampai 06:00 besoknya: HADIR final, dihitung ke tanggal mulai', () => {
    const r = computeDailyStatus({ now: wib('06:30', 1), window: malam, toleranceMinutes: 5, attendance: malamIn('22:03', '06:00') });
    expect(r).toMatchObject({ status: 'HADIR', final: true, lateMinutes: 0, earlyLeaveMinutes: 0 });
  });

  it('pukul 05:00 hari berikutnya shift belum selesai', () => {
    const r = computeDailyStatus({ now: wib('05:00', 1), window: malam, toleranceMinutes: 5, attendance: malamIn('22:00', null) });
    expect(r).toMatchObject({ final: false, needsCorrection: false });
  });

  it('pulang cepat di shift malam dihitung lintas tengah malam', () => {
    const r = computeDailyStatus({ now: wib('07:00', 1), window: malam, toleranceMinutes: 5, attendance: malamIn('22:00', '04:00') });
    expect(r).toMatchObject({ status: 'PULANG_CEPAT', earlyLeaveMinutes: 115 });
  });
});

describe('calcEarlyLeaveMinutes', () => {
  it('0 jika check-out di atau setelah jam selesai - toleransi', () => {
    expect(calcEarlyLeaveMinutes(wib('14:30'), pagi, 5)).toBe(0);
    expect(calcEarlyLeaveMinutes(wib('13:55'), pagi, 5)).toBe(0);
  });
});

describe('aturan bisnis 3: satu roster satu check-in', () => {
  it('belum ada attendance atau check-in kosong: boleh', () => {
    expect(() => assertNoExistingCheckIn(null)).not.toThrow();
    expect(() => assertNoExistingCheckIn({ checkInAt: null })).not.toThrow();
  });

  it('sudah ada check-in: 409 dengan pesan ramah', () => {
    try {
      assertNoExistingCheckIn({ checkInAt: wib('06:00') });
      throw new Error('seharusnya gagal');
    } catch (e) {
      expect(e).toMatchObject({ status: 409, code: 'CONFLICT' });
    }
  });
});
