import { describe, expect, it } from 'vitest';
import { EARLY_LEAVE_REASON_LABELS, EARLY_LEAVE_REASONS } from '../core/early-leave-reasons';
import { checkInSchema, checkOutSchema } from '../modules/attendance/attendance.schema';
import { buildShiftWindow, isBeforeShiftEnd } from '../utils/shift-time';

const wib = (s: string) => new Date(`${s}+07:00`);
const base = { lat: -6.2, lng: 106.8, accuracyM: 10, qr: 'token' };

describe('daftar alasan pulang awal', () => {
  it('berisi lima kode yang disepakati, urutan tetap', () => {
    expect([...EARLY_LEAVE_REASONS]).toEqual([
      'SAKIT_KECELAKAAN',
      'URUSAN_KELUARGA',
      'DISURUH_ATASAN',
      'KERJAAN_SELESAI',
      'LAINNYA',
    ]);
  });

  it('tiap kode punya label Indonesia yang tidak kosong', () => {
    expect(Object.keys(EARLY_LEAVE_REASON_LABELS).sort()).toEqual([...EARLY_LEAVE_REASONS].sort());
    for (const kode of EARLY_LEAVE_REASONS) expect(EARLY_LEAVE_REASON_LABELS[kode].length).toBeGreaterThan(0);
    expect(EARLY_LEAVE_REASON_LABELS.SAKIT_KECELAKAAN).toBe('Sakit / kecelakaan kerja');
    expect(EARLY_LEAVE_REASON_LABELS.LAINNYA).toBe('Lainnya');
  });

  it('kode muat di kolom VARCHAR(30)', () => {
    for (const kode of EARLY_LEAVE_REASONS) expect(kode.length).toBeLessThanOrEqual(30);
  });
});

describe('skema check-out: earlyLeaveReason', () => {
  it('tanpa alasan lolos (wajib-tidaknya diputuskan service)', () => {
    expect(checkOutSchema.safeParse(base).success).toBe(true);
  });

  it('kelima kode lolos', () => {
    for (const kode of EARLY_LEAVE_REASONS) {
      const r = checkOutSchema.safeParse({ ...base, earlyLeaveReason: kode });
      expect(r.success).toBe(true);
    }
  });

  it('kode tidak dikenal, teks bebas, dan string kosong ditolak', () => {
    for (const salah of ['SAKIT', 'aku capek banget', '', 'lainnya']) {
      expect(checkOutSchema.safeParse({ ...base, earlyLeaveReason: salah }).success).toBe(false);
    }
  });

  it('skema check-in tidak membawa alasan', () => {
    const r = checkInSchema.safeParse({ ...base, earlyLeaveReason: 'LAINNYA' });
    expect(r.success).toBe(true);
    if (r.success) expect('earlyLeaveReason' in r.data).toBe(false);
  });
});

describe('isBeforeShiftEnd', () => {
  const pagi = buildShiftWindow('2026-10-18', { startTime: '06:00', endTime: '14:00', lateToleranceMinutes: 5 });
  const malam = buildShiftWindow('2026-10-18', { startTime: '22:00', endTime: '06:00', lateToleranceMinutes: 5 });

  it('shift pagi: sebelum 14:00 true, tepat 14:00 dan sesudahnya false', () => {
    expect(isBeforeShiftEnd(wib('2026-10-18T13:59:59'), pagi)).toBe(true);
    expect(isBeforeShiftEnd(wib('2026-10-18T14:00:00'), pagi)).toBe(false);
    expect(isBeforeShiftEnd(wib('2026-10-18T14:30:00'), pagi)).toBe(false);
  });

  it('toleransi tidak ikut: 13:57 (dalam toleransi 5 menit) tetap true', () => {
    expect(isBeforeShiftEnd(wib('2026-10-18T13:57:00'), pagi)).toBe(true);
  });

  it('shift malam lintas hari: selesai 06:00 hari berikutnya', () => {
    expect(isBeforeShiftEnd(wib('2026-10-18T23:00:00'), malam)).toBe(true);
    expect(isBeforeShiftEnd(wib('2026-10-19T05:59:59'), malam)).toBe(true);
    expect(isBeforeShiftEnd(wib('2026-10-19T06:00:00'), malam)).toBe(false);
  });
});
