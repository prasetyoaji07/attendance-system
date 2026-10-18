import { describe, expect, it } from 'vitest';
import { RULES } from '../core/rules';
import { computeDailyStatus } from '../utils/daily-status';
import { addDays, dateRange } from '../utils/roster-rules';
import {
  DIVISION_PROFILES,
  employeeTraits,
  makeRng,
  planAttendance,
  planAttendanceFor,
  splitRange,
  startOfMonthsBack,
  weekdayOf,
  wibDateOf,
  type SeedAttendanceRow,
  type SeedRoster,
} from '../utils/seed-attendance';
import { haversineMeters } from '../utils/haversine';
import { buildShiftWindow, type ShiftDef } from '../utils/shift-time';

const NOW = new Date(Date.UTC(2026, 9, 18, 3, 0)); // 2026-10-18 10:00 WIB
const NO_HOLIDAYS: ReadonlySet<string> = new Set();
const LOC = { lat: -6.3025, lng: 107.152, radiusM: 100 };

const SHIFTS: Record<string, ShiftDef> = {
  pagi: { startTime: '06:00', endTime: '14:00', lateToleranceMinutes: 5 },
  siang: { startTime: '14:00', endTime: '22:00', lateToleranceMinutes: 5 },
  malam: { startTime: '22:00', endTime: '06:00', lateToleranceMinutes: 5 },
  reguler: { startTime: '08:00', endTime: '17:00', lateToleranceMinutes: 5 },
};

let nextId = 1;
const roster = (nik: string, division: string, shiftDate: string, shiftName = 'pagi'): SeedRoster => ({
  rosterId: nextId++,
  nik,
  divisionName: division,
  shiftDate,
  shift: SHIFTS[shiftName],
  location: LOC,
});

/** Populasi simulasi: `employees` karyawan x semua tanggal di rentang, satu divisi. */
function simulate(
  division: string,
  employees: number,
  from: string,
  to: string,
  shiftName = 'pagi',
): { rosters: SeedRoster[]; rows: SeedAttendanceRow[] } {
  const rosters: SeedRoster[] = [];
  for (let i = 0; i < employees; i++) {
    for (const d of dateRange(from, to)) rosters.push(roster(`SIMT-${division}-${i}`, division, d, shiftName));
  }
  return { rosters, rows: planAttendance(rosters, { now: NOW, holidays: NO_HOLIDAYS }) };
}

const lateRate = (rows: SeedAttendanceRow[]) => rows.filter((r) => r.status === 'TELAT').length / rows.length;

describe('seed-attendance: deterministik', () => {
  it('makeRng dengan seed sama menghasilkan urutan sama, seed beda menghasilkan urutan beda', () => {
    const a = makeRng('x|2026-03-10');
    const b = makeRng('x|2026-03-10');
    const c = makeRng('y|2026-03-10');
    const seqA = [a(), a(), a()];
    expect(seqA).toEqual([b(), b(), b()]);
    expect(seqA).not.toEqual([c(), c(), c()]);
    expect(seqA.every((v) => v >= 0 && v < 1)).toBe(true);
  });

  it('planAttendance dua kali dengan input sama memberi hasil persis sama (idempotent di sisi data)', () => {
    const rosters = dateRange('2026-03-01', '2026-03-31').map((d) => roster('SIM0007', 'Gudang', d, 'siang'));
    const a = planAttendance(rosters, { now: NOW, holidays: NO_HOLIDAYS });
    const b = planAttendance(rosters, { now: NOW, holidays: NO_HOLIDAYS });
    expect(a).toEqual(b);
    expect(a.length).toBe(31);
  });

  it('hasil satu roster tidak bergantung pada roster lain atau urutan proses', () => {
    const r1 = roster('SIM0001', 'Produksi', '2026-04-01');
    const r2 = roster('SIM0002', 'Produksi', '2026-04-01');
    const alone = planAttendanceFor(r2, { now: NOW, holidays: NO_HOLIDAYS });
    const both = planAttendance([r1, r2], { now: NOW, holidays: NO_HOLIDAYS });
    expect(both[1]).toEqual(alone);
  });

  it('now yang lebih maju tidak mengubah absen roster yang sudah selesai sebelumnya', () => {
    const r = roster('SIM0003', 'Quality Control', '2026-05-05');
    const nowLater = new Date(NOW.getTime() + 30 * 86_400_000);
    expect(planAttendanceFor(r, { now: NOW, holidays: NO_HOLIDAYS })).toEqual(
      planAttendanceFor(r, { now: nowLater, holidays: NO_HOLIDAYS }),
    );
  });

  it('employeeTraits stabil per NIK', () => {
    expect(employeeTraits('SIM0042')).toEqual(employeeTraits('SIM0042'));
  });
});

describe('seed-attendance: status konsisten dengan computeDailyStatus', () => {
  const { rosters, rows } = simulate('Gudang', 30, '2026-01-05', '2026-03-29', 'siang');
  const nightSim = simulate('Gudang', 10, '2026-02-02', '2026-02-27', 'malam');

  it('status dan menit telat yang disimpan sama dengan hasil computeDailyStatus dari jam yang disimpan', () => {
    for (const { rosters: rs, rows: planned } of [{ rosters, rows }, nightSim]) {
      const byId = new Map(rs.map((r) => [r.rosterId, r]));
      expect(planned.length).toBe(rs.length);
      for (const row of planned) {
        const r = byId.get(row.rosterId)!;
        const expected = computeDailyStatus({
          now: NOW,
          window: buildShiftWindow(r.shiftDate, r.shift),
          toleranceMinutes: r.shift.lateToleranceMinutes,
          attendance: row.checkInAt ? { checkInAt: row.checkInAt, checkOutAt: row.checkOutAt } : null,
        });
        expect(row.status).toBe(expected.status);
        expect(row.lateMinutes).toBe(expected.lateMinutes);
      }
    }
  });

  it('hanya status HADIR, TELAT, PULANG_CEPAT, ALPA (tanpa CUTI/IZIN/SAKIT karena butuh pengajuan APPROVED)', () => {
    const allowed = new Set(['HADIR', 'TELAT', 'PULANG_CEPAT', 'ALPA']);
    expect(rows.length).toBeGreaterThan(1000);
    expect(rows.every((r) => allowed.has(r.status))).toBe(true);
    // keempat status benar-benar muncul pada populasi sebesar ini
    const seen = new Set(rows.map((r) => r.status));
    expect(seen).toEqual(allowed);
  });

  it('ALPA tanpa jam dan tanpa koordinat; selain ALPA lengkap', () => {
    for (const r of rows) {
      if (r.status === 'ALPA') {
        expect(r).toMatchObject({ checkInAt: null, checkOutAt: null, latIn: null, distanceM: null, lateMinutes: 0 });
      } else {
        expect(r.checkInAt).not.toBeNull();
        expect(r.checkOutAt).not.toBeNull();
        expect(r.latIn).not.toBeNull();
      }
    }
  });
});

describe('seed-attendance: jam dan GPS valid', () => {
  const kinds = ['pagi', 'siang', 'malam', 'reguler'];
  const cases = kinds.flatMap((k) => {
    const rosters = dateRange('2026-01-05', '2026-02-28').flatMap((d) =>
      Array.from({ length: 12 }, (_, i) => roster(`SIMT-W-${i}`, 'Produksi', d, k)),
    );
    return planAttendance(rosters, { now: NOW, holidays: NO_HOLIDAYS }).map((row) => ({
      row,
      r: rosters.find((x) => x.rosterId === row.rosterId)!,
    }));
  });

  it('check-out tidak lebih awal dari check-in', () => {
    for (const { row } of cases) {
      if (!row.checkInAt || !row.checkOutAt) continue;
      expect(row.checkOutAt.getTime()).toBeGreaterThanOrEqual(row.checkInAt.getTime());
    }
  });

  it('jam masuk jendela check-in (mulai - 2 jam sampai selesai + 2 jam), termasuk shift malam lintas hari', () => {
    const before = RULES.checkinWindowHoursBefore * 3_600_000;
    const after = RULES.checkinWindowHoursAfter * 3_600_000;
    let malam = 0;
    for (const { row, r } of cases) {
      if (!row.checkInAt || !row.checkOutAt) continue;
      const w = buildShiftWindow(r.shiftDate, r.shift);
      const lo = w.startsAt.getTime() - before;
      const hi = w.endsAt.getTime() + after;
      expect(row.checkInAt.getTime()).toBeGreaterThanOrEqual(lo);
      expect(row.checkInAt.getTime()).toBeLessThanOrEqual(hi);
      expect(row.checkOutAt.getTime()).toBeGreaterThanOrEqual(lo);
      expect(row.checkOutAt.getTime()).toBeLessThanOrEqual(hi);
      if (r.shift.startTime === '22:00') malam++;
    }
    expect(malam).toBeGreaterThan(100);
  });

  it('jam disimpan sebagai instan UTC: shift pagi 06:00 WIB = 23:00 UTC hari sebelumnya', () => {
    const r = roster('SIM0100', 'Produksi', '2026-03-10', 'pagi');
    const row = planAttendanceFor(r, { now: NOW, holidays: NO_HOLIDAYS })!;
    if (row.checkInAt) {
      const startsAt = Date.UTC(2026, 2, 9, 23, 0);
      expect(Math.abs(row.checkInAt.getTime() - startsAt)).toBeLessThan(3 * 3_600_000);
    }
  });

  it('GPS: jarak di dalam radius lokasi, akurasi <= batas aturan, dan jarak sesuai Haversine', () => {
    for (const { row } of cases) {
      if (row.latIn === null || row.lngIn === null || row.distanceM === null || row.accuracyM === null) continue;
      expect(row.distanceM).toBeLessThanOrEqual(LOC.radiusM);
      expect(row.accuracyM).toBeLessThanOrEqual(RULES.maxGpsAccuracyM);
      expect(row.accuracyM).toBeGreaterThan(0);
      expect(Math.abs(haversineMeters(row.latIn, row.lngIn, LOC.lat, LOC.lng) - row.distanceM)).toBeLessThan(0.05);
      expect(haversineMeters(row.latOut!, row.lngOut!, LOC.lat, LOC.lng)).toBeLessThanOrEqual(LOC.radiusM);
    }
  });
});

describe('seed-attendance: cakupan roster', () => {
  it('shift yang belum selesai (berjalan atau mendatang) tidak diberi absen', () => {
    const today = wibDateOf(NOW); // 2026-10-18 10:00 WIB
    // shift pagi hari ini selesai 14:00 -> belum selesai; siang hari ini belum mulai; kemarin sudah selesai
    expect(planAttendanceFor(roster('SIM0001', 'Produksi', today, 'pagi'), { now: NOW, holidays: NO_HOLIDAYS })).toBeNull();
    expect(planAttendanceFor(roster('SIM0001', 'Produksi', today, 'siang'), { now: NOW, holidays: NO_HOLIDAYS })).toBeNull();
    expect(planAttendanceFor(roster('SIM0001', 'Produksi', addDays(today, 10)), { now: NOW, holidays: NO_HOLIDAYS })).toBeNull();
    expect(planAttendanceFor(roster('SIM0001', 'Produksi', addDays(today, -1)), { now: NOW, holidays: NO_HOLIDAYS })).not.toBeNull();
  });

  it('shift malam kemarin (22:00-06:00) yang selesai pagi ini sudah diberi absen, malam hari ini belum', () => {
    const today = wibDateOf(NOW);
    expect(planAttendanceFor(roster('SIM0001', 'Produksi', addDays(today, -1), 'malam'), { now: NOW, holidays: NO_HOLIDAYS })).not.toBeNull();
    expect(planAttendanceFor(roster('SIM0001', 'Produksi', today, 'malam'), { now: NOW, holidays: NO_HOLIDAYS })).toBeNull();
  });

  it('hari libur nasional: tanpa jam absen, status LIBUR dari computeDailyStatus', () => {
    const row = planAttendanceFor(roster('SIM0001', 'Produksi', '2026-08-17'), {
      now: NOW,
      holidays: new Set(['2026-08-17']),
    })!;
    expect(row).toMatchObject({ status: 'LIBUR', checkInAt: null, checkOutAt: null, lateMinutes: 0 });
  });

  it('divisi tanpa profil ditolak dengan pesan jelas', () => {
    expect(() => planAttendanceFor(roster('SIM0001', 'Divisi Gaib', '2026-04-01'), { now: NOW, holidays: NO_HOLIDAYS })).toThrow(
      /Divisi Gaib/,
    );
  });
});

describe('seed-attendance: profil telat per divisi', () => {
  // 200 karyawan x 84 hari (12 minggu penuh, mulai Senin) per divisi.
  const from = '2026-01-05';
  const to = '2026-03-29';
  const rates = Object.fromEntries(
    Object.keys(DIVISION_PROFILES).map((d) => [d, lateRate(simulate(d, 200, from, to).rows)]),
  );

  it('tingkat telat tiap divisi mendekati profilnya (toleransi 25% relatif)', () => {
    for (const [division, profile] of Object.entries(DIVISION_PROFILES)) {
      const observed = rates[division];
      expect(Math.abs(observed - profile.lateRate) / profile.lateRate).toBeLessThan(0.25);
    }
  });

  it('urutan telat: Gudang > Produksi > Maintenance > Quality Control > HR', () => {
    expect(rates['Gudang']).toBeGreaterThan(rates['Produksi']);
    expect(rates['Produksi']).toBeGreaterThan(rates['Maintenance']);
    expect(rates['Maintenance']).toBeGreaterThan(rates['Quality Control']);
    expect(rates['Quality Control']).toBeGreaterThan(rates['HR']);
  });

  it('Senin lebih sering telat daripada hari lain (supaya heatmap tidak rata)', () => {
    const { rosters, rows } = simulate('Produksi', 300, from, to);
    const dateOf = new Map(rosters.map((r) => [r.rosterId, r.shiftDate]));
    const late = new Array(7).fill(0);
    const total = new Array(7).fill(0);
    for (const r of rows) {
      const wd = weekdayOf(dateOf.get(r.rosterId)!);
      total[wd]++;
      if (r.status === 'TELAT') late[wd]++;
    }
    const monday = late[1] / total[1];
    const others = [0, 2, 3, 4, 5, 6].map((d) => late[d] / total[d]);
    const avgOthers = others.reduce((a, b) => a + b, 0) / others.length;
    expect(monday).toBeGreaterThan(avgOthers * 1.15);
  });

  it('ada karyawan telat kronis, jauh di atas rata-rata divisinya', () => {
    const traits = Array.from({ length: 400 }, (_, i) => employeeTraits(`SIMT-CH-${i}`));
    const share = traits.filter((t) => t.chronic).length / traits.length;
    expect(share).toBeGreaterThan(0.04);
    expect(share).toBeLessThan(0.13);
    const chronic = traits.filter((t) => t.chronic);
    const normal = traits.filter((t) => !t.chronic);
    const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
    expect(avg(chronic.map((t) => t.lateFactor))).toBeGreaterThan(avg(normal.map((t) => t.lateFactor)) * 2);
  });
});

describe('seed-attendance: rentang tanggal', () => {
  it('startOfMonthsBack: tanggal 1, sekian bulan sebelum bulan ini (lintas tahun)', () => {
    expect(startOfMonthsBack('2026-10-18', 11)).toBe('2025-11-01');
    expect(startOfMonthsBack('2026-03-05', 11)).toBe('2025-04-01');
    expect(startOfMonthsBack('2026-01-31', 0)).toBe('2026-01-01');
    expect(startOfMonthsBack('2026-01-31', 12)).toBe('2025-01-01');
  });

  it('splitRange memecah per paling banyak 62 hari, tanpa celah dan tanpa tumpang tindih', () => {
    const chunks = splitRange('2025-11-01', '2026-11-17');
    expect(chunks.length).toBeGreaterThanOrEqual(7);
    expect(chunks[0].from).toBe('2025-11-01');
    expect(chunks[chunks.length - 1].to).toBe('2026-11-17');
    for (let i = 0; i < chunks.length; i++) {
      const days = dateRange(chunks[i].from, chunks[i].to).length;
      expect(days).toBeLessThanOrEqual(RULES.maxRosterRangeDays);
      if (i > 0) expect(chunks[i].from).toBe(addDays(chunks[i - 1].to, 1));
    }
  });

  it('splitRange: satu hari dan rentang terbalik', () => {
    expect(splitRange('2026-05-01', '2026-05-01')).toEqual([{ from: '2026-05-01', to: '2026-05-01' }]);
    expect(() => splitRange('2026-05-02', '2026-05-01')).toThrow();
  });
});
