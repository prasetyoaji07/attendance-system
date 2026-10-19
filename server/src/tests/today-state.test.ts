import { describe, expect, it } from 'vitest';
import type { ShiftDef } from '../utils/shift-time';
import { resolveTodayState, type TodayAttendanceRow, type TodayCandidate } from '../utils/today-state';

// Semua jam di tes ditulis dalam WIB (UTC+7), sama seperti aturan shift di server.
const at = (date: string, hm: string) => new Date(`${date}T${hm}:00+07:00`);
const ms = (d: Date, delta: number) => new Date(d.getTime() + delta);

const loc = { id: 1, nama: 'Pabrik A', lat: -6.3, lng: 107.1, radiusM: 100 };
const pagi: ShiftDef = { startTime: '08:00', endTime: '16:00', lateToleranceMinutes: 5 };
const malam: ShiftDef = { startTime: '22:00', endTime: '06:00', lateToleranceMinutes: 5 };
const dini: ShiftDef = { startTime: '00:30', endTime: '08:30', lateToleranceMinutes: 5 };

let nextId = 1;
function cand(shiftDate: string, shift: ShiftDef, attendance: TodayAttendanceRow | null = null, nama = 'Shift'): TodayCandidate {
  return { rosterId: nextId++, shiftDate, shiftNama: nama, shift, location: loc, attendance };
}
function att(over: Partial<TodayAttendanceRow> = {}): TodayAttendanceRow {
  return {
    attendanceId: nextId++,
    checkInAt: null,
    checkOutAt: null,
    status: 'HADIR',
    lateMinutes: 0,
    earlyLeaveMinutes: 0,
    autoClosed: false,
    needsCorrection: false,
    ...over,
  };
}

describe('resolveTodayState: dasar', () => {
  it('tanpa roster -> NO_SCHEDULE dan semua blok null', () => {
    const now = at('2026-10-20', '10:00');
    const r = resolveTodayState(now, []);
    expect(r.status).toBe('NO_SCHEDULE');
    expect(r.serverTime).toBe(now.toISOString());
    expect(r.roster).toBeNull();
    expect(r.window).toBeNull();
    expect(r.checkOut).toBeNull();
    expect(r.attendance).toBeNull();
    expect(r.canCheckIn).toBe(false);
  });

  it('jendela terbuka tepat di mulai-2j (inklusif) -> NOT_CHECKED_IN', () => {
    const r = resolveTodayState(at('2026-10-20', '06:00'), [cand('2026-10-20', pagi, null, 'Pagi')]);
    expect(r.status).toBe('NOT_CHECKED_IN');
    expect(r.canCheckIn).toBe(true);
    expect(r.checkOut).toBeNull();
    expect(r.attendance).toBeNull();
    expect(r.roster).toMatchObject({ shiftDate: '2026-10-20', shiftNama: 'Pagi', startTime: '08:00', endTime: '16:00', location: loc });
    expect(r.window).toEqual({ opensAt: at('2026-10-20', '06:00').toISOString(), closesAt: at('2026-10-20', '18:00').toISOString() });
  });

  it('1 ms sebelum jendela terbuka -> UPCOMING (belum boleh check-in)', () => {
    const r = resolveTodayState(ms(at('2026-10-20', '06:00'), -1), [cand('2026-10-20', pagi)]);
    expect(r.status).toBe('UPCOMING');
    expect(r.canCheckIn).toBe(false);
    expect(r.roster?.shiftDate).toBe('2026-10-20');
    expect(r.window?.opensAt).toBe(at('2026-10-20', '06:00').toISOString());
    expect(r.attendance).toBeNull();
  });

  it('UPCOMING memilih jadwal yang paling dekat', () => {
    const r = resolveTodayState(at('2026-10-20', '03:00'), [cand('2026-10-21', pagi), cand('2026-10-20', pagi)]);
    expect(r.status).toBe('UPCOMING');
    expect(r.roster?.shiftDate).toBe('2026-10-20');
  });

  it('baris absen tanpa check-in (mis. ALPA dari seed) dianggap belum ada absen', () => {
    const r = resolveTodayState(at('2026-10-20', '09:00'), [cand('2026-10-20', pagi, att({ checkInAt: null, status: 'ALPA' }))]);
    expect(r.status).toBe('NOT_CHECKED_IN');
    expect(r.attendance).toBeNull();
  });
});

describe('resolveTodayState: CHECKED_IN dan blok checkOut', () => {
  const checkIn = at('2026-10-20', '08:03');
  const open = () => att({ checkInAt: checkIn, status: 'HADIR', lateMinutes: 0 });

  it('sudah masuk, belum jam pulang -> allowed dan early', () => {
    const r = resolveTodayState(at('2026-10-20', '12:00'), [cand('2026-10-20', pagi, open())]);
    expect(r.status).toBe('CHECKED_IN');
    expect(r.canCheckIn).toBe(false);
    expect(r.checkOut).toEqual({ allowed: true, early: true, deadlineAt: at('2026-10-20', '18:00').toISOString() });
    expect(r.attendance).toMatchObject({ checkInAt: checkIn.toISOString(), checkOutAt: null, autoClosed: false, needsCorrection: false });
  });

  it('early = false tepat di jam selesai dan sesudahnya', () => {
    const c = [cand('2026-10-20', pagi, open())];
    expect(resolveTodayState(ms(at('2026-10-20', '16:00'), -1), c).checkOut?.early).toBe(true);
    expect(resolveTodayState(at('2026-10-20', '16:00'), c).checkOut?.early).toBe(false);
    expect(resolveTodayState(at('2026-10-20', '17:30'), c).checkOut?.early).toBe(false);
  });

  it('batas check-out inklusif: tepat selesai+2j masih CHECKED_IN, 1 ms sesudahnya AUTO_CLOSED', () => {
    const c = [cand('2026-10-20', pagi, open())];
    expect(resolveTodayState(at('2026-10-20', '18:00'), c).status).toBe('CHECKED_IN');
    const late = resolveTodayState(ms(at('2026-10-20', '18:00'), 1), c);
    expect(late.status).toBe('AUTO_CLOSED');
    expect(late.checkOut).toBeNull();
    expect(late.canCheckIn).toBe(false);
    expect(late.attendance?.checkOutAt).toBeNull();
  });

  it('meneruskan telat/status/koreksi dari data absen', () => {
    const a = att({ checkInAt: at('2026-10-20', '08:12'), status: 'TELAT', lateMinutes: 7 });
    const r = resolveTodayState(at('2026-10-20', '09:00'), [cand('2026-10-20', pagi, a)]);
    expect(r.attendance).toMatchObject({ status: 'TELAT', lateMinutes: 7, earlyLeaveMinutes: 0 });
  });
});

describe('resolveTodayState: AUTO_CLOSED', () => {
  it('flag auto_closed dari DB -> AUTO_CLOSED, tanpa jam pulang karangan', () => {
    const a = att({ checkInAt: at('2026-10-20', '08:00'), autoClosed: true, needsCorrection: true });
    const r = resolveTodayState(at('2026-10-20', '19:00'), [cand('2026-10-20', pagi, a)]);
    expect(r.status).toBe('AUTO_CLOSED');
    expect(r.attendance).toMatchObject({ autoClosed: true, needsCorrection: true, checkOutAt: null });
    expect(r.checkOut).toBeNull();
  });

  it('cron belum jalan (flag belum terpasang) tapi batas lewat -> tetap AUTO_CLOSED', () => {
    const a = att({ checkInAt: at('2026-10-20', '08:00') });
    const r = resolveTodayState(at('2026-10-20', '23:00'), [cand('2026-10-20', pagi, a)]);
    expect(r.status).toBe('AUTO_CLOSED');
  });

  it('jadwal aktif mengalahkan AUTO_CLOSED kemarin', () => {
    const stuck = att({ checkInAt: at('2026-10-19', '08:00'), autoClosed: true, needsCorrection: true });
    const r = resolveTodayState(at('2026-10-20', '07:00'), [cand('2026-10-19', pagi, stuck), cand('2026-10-20', pagi)]);
    expect(r.status).toBe('NOT_CHECKED_IN');
    expect(r.roster?.shiftDate).toBe('2026-10-20');
  });

  it('AUTO_CLOSED mengalahkan UPCOMING', () => {
    const stuck = att({ checkInAt: at('2026-10-19', '08:00'), autoClosed: true, needsCorrection: true });
    const r = resolveTodayState(at('2026-10-20', '03:00'), [cand('2026-10-19', pagi, stuck), cand('2026-10-20', pagi)]);
    expect(r.status).toBe('AUTO_CLOSED');
    expect(r.roster?.shiftDate).toBe('2026-10-19');
  });
});

describe('resolveTodayState: CHECKED_OUT sepanjang hari WIB', () => {
  const done = () => att({ checkInAt: at('2026-10-20', '08:00'), checkOutAt: at('2026-10-20', '16:05') });

  it('masih di dalam jendela -> CHECKED_OUT', () => {
    const r = resolveTodayState(at('2026-10-20', '16:30'), [cand('2026-10-20', pagi, done())]);
    expect(r.status).toBe('CHECKED_OUT');
    expect(r.checkOut).toBeNull();
    expect(r.canCheckIn).toBe(false);
    expect(r.attendance?.checkOutAt).toBe(at('2026-10-20', '16:05').toISOString());
  });

  it('jendela sudah habis (20:00 WIB) tetap CHECKED_OUT karena masih hari yang sama', () => {
    const r = resolveTodayState(at('2026-10-20', '20:00'), [cand('2026-10-20', pagi, done())]);
    expect(r.status).toBe('CHECKED_OUT');
    expect(r.roster?.shiftDate).toBe('2026-10-20');
  });

  it('lewat tengah malam WIB tidak lagi CHECKED_OUT', () => {
    const r = resolveTodayState(at('2026-10-21', '00:00'), [cand('2026-10-20', pagi, done())]);
    expect(r.status).toBe('NO_SCHEDULE');
  });

  it('lewat tengah malam, ada jadwal besok -> UPCOMING', () => {
    const r = resolveTodayState(at('2026-10-21', '00:00'), [cand('2026-10-20', pagi, done()), cand('2026-10-21', pagi)]);
    expect(r.status).toBe('UPCOMING');
    expect(r.roster?.shiftDate).toBe('2026-10-21');
  });
});

describe('resolveTodayState: shift malam dan lintas tengah malam', () => {
  it('shift malam tanggal kemarin, sekarang 01:00 -> NOT_CHECKED_IN', () => {
    const r = resolveTodayState(at('2026-10-20', '01:00'), [cand('2026-10-19', malam)]);
    expect(r.status).toBe('NOT_CHECKED_IN');
    expect(r.roster?.shiftDate).toBe('2026-10-19');
  });

  it('shift malam sudah masuk: early true sebelum 06:00, false sesudahnya', () => {
    const a = att({ checkInAt: at('2026-10-19', '22:01') });
    const c = [cand('2026-10-19', malam, a)];
    const r1 = resolveTodayState(at('2026-10-20', '03:00'), c);
    expect(r1.status).toBe('CHECKED_IN');
    expect(r1.checkOut).toEqual({ allowed: true, early: true, deadlineAt: at('2026-10-20', '08:00').toISOString() });
    expect(resolveTodayState(at('2026-10-20', '06:00'), c).checkOut?.early).toBe(false);
  });

  it('shift mulai lewat tengah malam (tanggal besok) yang jendelanya sudah terbuka malam ini', () => {
    const c = [cand('2026-10-21', dini)];
    expect(resolveTodayState(at('2026-10-20', '22:30'), c).status).toBe('NOT_CHECKED_IN');
    expect(resolveTodayState(ms(at('2026-10-20', '22:30'), -1), c).status).toBe('UPCOMING');
  });

  it('pulang shift malam pukul 06:10 tanggal 20 -> CHECKED_OUT hari itu', () => {
    const a = att({ checkInAt: at('2026-10-19', '22:00'), checkOutAt: at('2026-10-20', '06:10') });
    const r = resolveTodayState(at('2026-10-20', '15:00'), [cand('2026-10-19', malam, a)]);
    expect(r.status).toBe('CHECKED_OUT');
  });
});

describe('resolveTodayState: prioritas', () => {
  it('absen terbuka (CHECKED_IN) dipilih dari absen dengan check-in terbaru', () => {
    const lama = att({ checkInAt: at('2026-10-19', '08:00'), checkOutAt: at('2026-10-19', '16:00') });
    const baru = att({ checkInAt: at('2026-10-20', '08:00') });
    const r = resolveTodayState(at('2026-10-20', '10:00'), [cand('2026-10-19', pagi, lama), cand('2026-10-20', pagi, baru, 'Hari ini')]);
    expect(r.status).toBe('CHECKED_IN');
    expect(r.roster?.shiftNama).toBe('Hari ini');
  });
});
