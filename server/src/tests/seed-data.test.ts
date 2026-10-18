import { describe, expect, it } from 'vitest';
import { RULES } from '../core/rules';
import { dateRange, findRestViolations, generateRosterEntries, type PatternShift } from '../utils/roster-rules';
import {
  buildEmployees,
  departmentHeads,
  DEPARTMENT_LOCATION,
  PATTERN_ANCHOR_DATE,
  SEED_HOLIDAYS,
  SEED_LOCATIONS,
  SEED_PATTERNS,
  SEED_SHIFTS,
  SIM_NIK_PREFIX,
} from '../utils/seed-data';
import { DIVISION_PROFILES, weekdayOf } from '../utils/seed-attendance';

const employees = buildEmployees();

const patternShifts: PatternShift[] = SEED_SHIFTS.map((s, i) => ({
  id: i + 1,
  nama: s.nama,
  def: { startTime: s.jamMulai, endTime: s.jamSelesai, lateToleranceMinutes: s.toleransiMenit },
}));

describe('seed-data: karyawan', () => {
  it('sekitar 50 karyawan, NIK unik berawalan SIM, nama unik', () => {
    expect(employees.length).toBe(50);
    expect(new Set(employees.map((e) => e.nik)).size).toBe(50);
    expect(employees.every((e) => e.nik.startsWith(SIM_NIK_PREFIX))).toBe(true);
    expect(new Set(employees.map((e) => e.nama)).size).toBe(50);
  });

  it('lima divisi, masing-masing punya profil telat dan lokasi', () => {
    const depts = new Set(employees.map((e) => e.department));
    expect(depts.size).toBe(5);
    for (const d of depts) {
      expect(DIVISION_PROFILES[d]).toBeDefined();
      expect(SEED_LOCATIONS.some((l) => l.nama === DEPARTMENT_LOCATION[d])).toBe(true);
    }
  });

  it('rantai atasan: karyawan -> foreman -> SPV -> kepala HR; tanpa siklus, atasan ada', () => {
    const byNik = new Map(employees.map((e) => [e.nik, e]));
    const roots = employees.filter((e) => e.atasanNik === null);
    expect(roots).toHaveLength(1);
    expect(roots[0].role).toBe('HRD');
    for (const e of employees) {
      let cur = e;
      for (let hops = 0; cur.atasanNik !== null; hops++) {
        expect(hops).toBeLessThan(5);
        cur = byNik.get(cur.atasanNik)!;
        expect(cur).toBeDefined();
      }
    }
    const heads = departmentHeads(employees);
    expect(Object.keys(heads)).toHaveLength(5);
  });

  it('peran lengkap untuk uji RBAC dan approval: EMPLOYEE, FOREMAN, SPV, HRD, ADMIN', () => {
    const roles = new Set(employees.map((e) => e.role));
    expect(roles).toEqual(new Set(['EMPLOYEE', 'FOREMAN', 'SPV', 'HRD', 'ADMIN']));
  });

  it('tanggal masuk sebelum rentang roster dimulai dan berupa tanggal valid', () => {
    for (const e of employees) {
      expect(e.tanggalMasuk >= '2018-01-01').toBe(true);
      expect(e.tanggalMasuk <= '2025-06-30').toBe(true);
    }
  });

  it('data deterministik: dua kali build sama persis', () => {
    expect(buildEmployees()).toEqual(buildEmployees());
  });
});

describe('seed-data: pola shift memenuhi aturan jeda >= 11 jam (aturan bisnis 4)', () => {
  it('semua karyawan, rentang 2 tahun, tidak ada pelanggaran jeda', () => {
    const items = employees.flatMap((emp, idx) =>
      generateRosterEntries({
        employeeId: idx + 1,
        urutan: emp.pattern.urutan,
        shifts: patternShifts,
        anchorDate: PATTERN_ANCHOR_DATE,
        offset: emp.offset,
        from: '2025-11-01',
        to: '2026-12-31',
      }).map((p) => ({ employeeId: p.employeeId, shiftDate: p.shiftDate, window: p.window, isNew: true })),
    );
    expect(items.length).toBeGreaterThan(15_000);
    expect(findRestViolations(items, RULES.minRestHoursBetweenShifts)).toEqual([]);
  });

  it('pola memakai hanya shift yang ada di SEED_SHIFTS (atau "libur")', () => {
    const names = new Set(SEED_SHIFTS.map((s) => s.nama.toLowerCase()));
    for (const p of SEED_PATTERNS) {
      for (const n of p.urutan) expect(n === 'libur' || names.has(n)).toBe(true);
    }
  });

  it('pola 5-2 jatuh Senin-Jumat (anchor hari Senin), Sabtu-Minggu libur', () => {
    expect(weekdayOf(PATTERN_ANCHOR_DATE)).toBe(1);
    const emp = employees.find((e) => e.pattern.nama === 'Reguler 5-2')!;
    const entries = generateRosterEntries({
      employeeId: 1,
      urutan: emp.pattern.urutan,
      shifts: patternShifts,
      anchorDate: PATTERN_ANCHOR_DATE,
      offset: emp.offset,
      from: '2026-01-01',
      to: '2026-03-31',
    });
    expect(entries.every((e) => weekdayOf(e.shiftDate) >= 1 && weekdayOf(e.shiftDate) <= 5)).toBe(true);
  });

  it('rotasi tersebar: tiap hari divisi Produksi punya orang di pagi, siang, dan malam', () => {
    const prod = employees.filter((e) => e.department === 'Produksi');
    const perDay = new Map<string, Set<string>>();
    prod.forEach((emp, idx) => {
      for (const p of generateRosterEntries({
        employeeId: idx + 1,
        urutan: emp.pattern.urutan,
        shifts: patternShifts,
        anchorDate: PATTERN_ANCHOR_DATE,
        offset: emp.offset,
        from: '2026-03-01',
        to: '2026-03-31',
      })) {
        const set = perDay.get(p.shiftDate) ?? new Set<string>();
        set.add(p.shiftName);
        perDay.set(p.shiftDate, set);
      }
    });
    for (const d of dateRange('2026-03-01', '2026-03-31')) {
      expect(perDay.get(d)).toEqual(new Set(['Pagi', 'Siang', 'Malam']));
    }
  });
});

describe('seed-data: hari libur nasional', () => {
  const only2026 = SEED_HOLIDAYS.filter((h) => h.tanggal.startsWith('2026'));
  const cuti = (h: { nama: string }) => h.nama.startsWith('Cuti Bersama');

  it('2026 sesuai SKB 3 Menteri: 17 libur nasional + 8 cuti bersama', () => {
    expect(only2026.filter((h) => !cuti(h))).toHaveLength(17);
    expect(only2026.filter(cuti)).toHaveLength(8);
  });

  it('akhir 2025: Natal 25 Des dan cuti bersama 26 Des; tanggal unik, urut, dan valid', () => {
    expect(SEED_HOLIDAYS.filter((h) => h.tanggal.startsWith('2025')).map((h) => h.tanggal)).toEqual(['2025-12-25', '2025-12-26']);
    const dates = SEED_HOLIDAYS.map((h) => h.tanggal);
    expect(new Set(dates).size).toBe(dates.length);
    expect([...dates].sort()).toEqual(dates);
    for (const d of dates) expect(Number.isNaN(Date.parse(d))).toBe(false);
  });

  it('titik kunci: Kemerdekaan 17 Agustus dan Natal 25 Desember 2026', () => {
    const find = (t: string) => SEED_HOLIDAYS.find((h) => h.tanggal === t)?.nama ?? '';
    expect(find('2026-08-17')).toMatch(/Kemerdekaan/);
    expect(find('2026-12-25')).toMatch(/Natal/);
  });
});
