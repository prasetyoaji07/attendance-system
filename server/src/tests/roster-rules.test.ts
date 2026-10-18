import { describe, expect, it } from 'vitest';
import {
  addDays,
  dateRange,
  daysBetween,
  findRestViolations,
  findUnknownShifts,
  generateRosterEntries,
  patternSlot,
  type PatternShift,
  type RestCheckItem,
} from '../utils/roster-rules';
import { buildShiftWindow, type ShiftDef } from '../utils/shift-time';

const def = (startTime: string, endTime: string): ShiftDef => ({ startTime, endTime, lateToleranceMinutes: 5 });
const pagi: PatternShift = { id: 1, nama: 'pagi', def: def('06:00', '14:00') };
const siang: PatternShift = { id: 2, nama: 'siang', def: def('14:00', '22:00') };
const malam: PatternShift = { id: 3, nama: 'malam', def: def('22:00', '06:00') };
const shifts = [pagi, siang, malam];

const item = (employeeId: number, shiftDate: string, s: PatternShift, isNew = true): RestCheckItem => ({
  employeeId,
  shiftDate,
  window: buildShiftWindow(shiftDate, s.def),
  isNew,
});

describe('tanggal', () => {
  it('addDays melewati akhir bulan, akhir tahun, dan tahun kabisat', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });
  it('daysBetween dan dateRange inklusif', () => {
    expect(daysBetween('2026-03-01', '2026-03-04')).toBe(3);
    expect(dateRange('2026-02-27', '2026-03-02')).toEqual(['2026-02-27', '2026-02-28', '2026-03-01', '2026-03-02']);
    expect(dateRange('2026-03-01', '2026-03-01')).toEqual(['2026-03-01']);
  });
  it('dateRange terbalik dan tanggal palsu melempar error', () => {
    expect(() => dateRange('2026-03-02', '2026-03-01')).toThrow();
    expect(() => addDays('2026-02-30', 1)).toThrow();
  });
});

describe('patternSlot', () => {
  it('berputar dan memperhitungkan offset', () => {
    expect(patternSlot('2026-03-01', '2026-03-01', 0, 4)).toBe(0);
    expect(patternSlot('2026-03-05', '2026-03-01', 0, 4)).toBe(0);
    expect(patternSlot('2026-03-02', '2026-03-01', 3, 4)).toBe(0);
  });
  it('tanggal sebelum anchor tetap valid (modulo positif)', () => {
    expect(patternSlot('2026-02-28', '2026-03-01', 0, 4)).toBe(3);
  });
  it('pola kosong melempar error', () => {
    expect(() => patternSlot('2026-03-01', '2026-03-01', 0, 0)).toThrow();
  });
});

describe('findUnknownShifts', () => {
  it('libur dan beda huruf besar/kecil dianggap dikenal; yang asing dilaporkan sekali', () => {
    expect(findUnknownShifts(['Pagi', 'LIBUR', 'sore', 'sore', 'malam'], ['pagi', 'malam'])).toEqual(['sore']);
  });
});

describe('generateRosterEntries', () => {
  const base = { employeeId: 7, shifts, anchorDate: '2026-03-01', offset: 0 };

  it('hari libur tidak membuat baris roster', () => {
    const r = generateRosterEntries({ ...base, urutan: ['pagi', 'pagi', 'libur'], from: '2026-03-01', to: '2026-03-06' });
    expect(r.map((e) => e.shiftDate)).toEqual(['2026-03-01', '2026-03-02', '2026-03-04', '2026-03-05']);
    expect(r.every((e) => e.employeeId === 7 && e.shiftId === 1)).toBe(true);
  });

  it('nama shift tidak peka huruf besar/kecil', () => {
    const r = generateRosterEntries({ ...base, urutan: ['PAGI', ' Libur '], from: '2026-03-01', to: '2026-03-02' });
    expect(r).toHaveLength(1);
    expect(r[0].shiftName).toBe('pagi');
  });

  it('shift malam: jendela lintas hari, shiftDate = hari mulai (aturan 1)', () => {
    const [e] = generateRosterEntries({ ...base, urutan: ['malam'], from: '2026-03-10', to: '2026-03-10' });
    expect(e.shiftDate).toBe('2026-03-10');
    expect(e.window.startsAt.toISOString()).toBe('2026-03-10T15:00:00.000Z'); // 22:00 WIB
    expect(e.window.endsAt.toISOString()).toBe('2026-03-10T23:00:00.000Z'); // 06:00 WIB besoknya
  });

  it('offset menggeser pola per karyawan', () => {
    const a = generateRosterEntries({ ...base, urutan: ['pagi', 'siang'], from: '2026-03-01', to: '2026-03-02' });
    const b = generateRosterEntries({ ...base, offset: 1, urutan: ['pagi', 'siang'], from: '2026-03-01', to: '2026-03-02' });
    expect(a.map((e) => e.shiftName)).toEqual(['pagi', 'siang']);
    expect(b.map((e) => e.shiftName)).toEqual(['siang', 'pagi']);
  });

  it('rentang sebelum anchor tetap mengikuti pola yang sama', () => {
    const r = generateRosterEntries({ ...base, urutan: ['pagi', 'siang'], from: '2026-02-28', to: '2026-02-28' });
    expect(r[0].shiftName).toBe('siang'); // 2026-02-28 = slot 1 (sehari sebelum anchor, pola 2 hari)
  });

  it('shift tidak dikenal melempar error', () => {
    expect(() => generateRosterEntries({ ...base, urutan: ['sore'], from: '2026-03-01', to: '2026-03-01' })).toThrow(/sore/);
  });
});

describe('findRestViolations (aturan 4: jeda minimal 11 jam)', () => {
  it('pagi lalu pagi besok: jeda 16 jam, lolos', () => {
    expect(findRestViolations([item(1, '2026-03-01', pagi), item(1, '2026-03-02', pagi)])).toEqual([]);
  });

  it('siang lalu pagi besok: jeda 8 jam, dilanggar', () => {
    const v = findRestViolations([item(1, '2026-03-01', siang), item(1, '2026-03-02', pagi)]);
    expect(v).toEqual([{ employeeId: 1, previousDate: '2026-03-01', nextDate: '2026-03-02', restHours: 8, minRestHours: 11 }]);
  });

  it('malam lalu pagi besoknya: jeda 0 jam, dilanggar', () => {
    const v = findRestViolations([item(1, '2026-03-01', malam), item(1, '2026-03-02', pagi)]);
    expect(v[0].restHours).toBe(0);
  });

  it('malam lalu siang besoknya: jeda 8 jam, dilanggar', () => {
    const v = findRestViolations([item(1, '2026-03-01', malam), item(1, '2026-03-02', siang)]);
    expect(v[0].restHours).toBe(8);
  });

  it('jeda tepat 11 jam lolos, 10 jam 59 menit gagal', () => {
    const a: PatternShift = { id: 10, nama: 'a', def: def('08:00', '17:00') };
    const ok: PatternShift = { id: 11, nama: 'ok', def: def('04:00', '12:00') }; // 17:00 -> 04:00 = 11 jam
    const bad: PatternShift = { id: 12, nama: 'bad', def: def('03:59', '12:00') }; // 10 jam 59 menit
    expect(findRestViolations([item(1, '2026-03-01', a), item(1, '2026-03-02', ok)])).toEqual([]);
    const v = findRestViolations([item(1, '2026-03-01', a), item(1, '2026-03-02', bad)]);
    expect(v).toHaveLength(1);
    expect(v[0].restHours).toBe(10.98);
  });

  it('urutan input tidak berpengaruh', () => {
    const v = findRestViolations([item(1, '2026-03-02', pagi), item(1, '2026-03-01', siang)]);
    expect(v).toHaveLength(1);
  });

  it('karyawan berbeda tidak dibandingkan satu sama lain', () => {
    expect(findRestViolations([item(1, '2026-03-01', siang), item(2, '2026-03-02', pagi)])).toEqual([]);
  });

  it('dua baris yang sudah ada di DB tidak dilaporkan (bukan ulah generate ini)', () => {
    const lama = [item(1, '2026-03-01', siang, false), item(1, '2026-03-02', pagi, false)];
    expect(findRestViolations(lama)).toEqual([]);
  });

  it('baris baru yang melanggar terhadap baris lama dilaporkan', () => {
    const v = findRestViolations([item(1, '2026-03-01', siang, false), item(1, '2026-03-02', pagi, true)]);
    expect(v).toHaveLength(1);
  });

  it('minimal jeda bisa diubah lewat argumen', () => {
    const rows = [item(1, '2026-03-01', siang), item(1, '2026-03-02', pagi)]; // jeda 8 jam
    expect(findRestViolations(rows, 8)).toEqual([]);
    expect(findRestViolations(rows, 9)).toHaveLength(1);
  });

  it('pola contoh di alur.md (2 pagi, 2 siang, 2 malam, 2 libur) lolos sepanjang beberapa siklus', () => {
    const urutan = ['pagi', 'pagi', 'siang', 'siang', 'malam', 'malam', 'libur', 'libur'];
    const entries = generateRosterEntries({
      employeeId: 1, urutan, shifts, anchorDate: '2026-03-01', offset: 0, from: '2026-03-01', to: '2026-04-30',
    });
    expect(findRestViolations(entries.map((e) => ({ ...e, isNew: true })))).toEqual([]);
  });

  it('pola yang berputar mundur (malam lalu pagi) ketahuan', () => {
    const entries = generateRosterEntries({
      employeeId: 1, urutan: ['malam', 'pagi'], shifts, anchorDate: '2026-03-01', offset: 0, from: '2026-03-01', to: '2026-03-04',
    });
    expect(findRestViolations(entries.map((e) => ({ ...e, isNew: true }))).length).toBeGreaterThan(0);
  });
});
