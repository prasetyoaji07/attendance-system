/**
 * SEED: data master SIMULASI (PURE, tanpa DB). Dipakai scripts/seed.ts dan dites di src/tests/seed-data.test.ts.
 * Semua orang, NIK, dan lokasi di sini fiktif. NIK berawalan "SIM" supaya data simulasi mudah dikenali
 * (dan tidak bentrok dengan format NIK di maintenance-system; kalau format di sana sudah ada, ubah SIM_NIK_PREFIX).
 */
import type { Role } from '../core/roles';
import { RULES } from '../core/rules';
import { addDays } from './roster-rules';
import { makeRng } from './seed-attendance';

export const SIM_NIK_PREFIX = 'SIM';
export const SIM_PASSWORD_DEFAULT = 'simulasi123';

/** Awal pola rotasi. Harus hari Senin supaya pola 5-2 jatuh Senin-Jumat dan konsisten antar run. */
export const PATTERN_ANCHOR_DATE = '2025-01-06';

// ---------- Lokasi (fiktif, di area industri Cikarang) ----------

export interface SeedLocation {
  nama: string;
  lat: number;
  lng: number;
  radiusM: number;
}

export const SEED_LOCATIONS: SeedLocation[] = [
  { nama: 'Pabrik Simulasi - Gedung Produksi', lat: -6.3025, lng: 107.152, radiusM: RULES.defaultRadiusM },
  { nama: 'Pabrik Simulasi - Gudang', lat: -6.3041, lng: 107.1558, radiusM: RULES.defaultRadiusM },
];

// ---------- Shift dan pola ----------

export interface SeedShift {
  nama: string;
  jamMulai: string;
  jamSelesai: string;
  lintasHari: boolean;
  toleransiMenit: number;
}

export const SEED_SHIFTS: SeedShift[] = [
  { nama: 'Pagi', jamMulai: '06:00', jamSelesai: '14:00', lintasHari: false, toleransiMenit: RULES.lateToleranceMinutes },
  { nama: 'Siang', jamMulai: '14:00', jamSelesai: '22:00', lintasHari: false, toleransiMenit: RULES.lateToleranceMinutes },
  { nama: 'Malam', jamMulai: '22:00', jamSelesai: '06:00', lintasHari: true, toleransiMenit: RULES.lateToleranceMinutes },
  { nama: 'Reguler', jamMulai: '08:00', jamSelesai: '17:00', lintasHari: false, toleransiMenit: RULES.lateToleranceMinutes },
];

export interface SeedPattern {
  nama: string;
  urutan: string[];
}

export const ROTASI_PATTERN: SeedPattern = {
  nama: 'Rotasi 3 Shift',
  urutan: ['pagi', 'pagi', 'siang', 'siang', 'malam', 'malam', 'libur', 'libur'],
};
export const REGULER_PATTERN: SeedPattern = {
  nama: 'Reguler 5-2',
  urutan: ['reguler', 'reguler', 'reguler', 'reguler', 'reguler', 'libur', 'libur'],
};
export const SEED_PATTERNS: SeedPattern[] = [ROTASI_PATTERN, REGULER_PATTERN];

// ---------- Divisi dan karyawan ----------

export const DEPARTMENT_LOCATION: Record<string, string> = {
  HR: SEED_LOCATIONS[0].nama,
  Produksi: SEED_LOCATIONS[0].nama,
  Maintenance: SEED_LOCATIONS[0].nama,
  'Quality Control': SEED_LOCATIONS[0].nama,
  Gudang: SEED_LOCATIONS[1].nama,
};

interface DepartmentSpec {
  nama: string;
  pattern: SeedPattern;
  /** Jumlah per peran. HR diatur khusus. */
  spv: number;
  foreman: number;
  staff: number;
}

// HR dibuat pertama supaya SIM0001 adalah kepala HR (role HRD). Total 50 karyawan.
const DEPARTMENT_SPECS: DepartmentSpec[] = [
  { nama: 'HR', pattern: REGULER_PATTERN, spv: 0, foreman: 0, staff: 0 },
  { nama: 'Produksi', pattern: ROTASI_PATTERN, spv: 1, foreman: 2, staff: 15 },
  { nama: 'Gudang', pattern: ROTASI_PATTERN, spv: 1, foreman: 1, staff: 8 },
  { nama: 'Maintenance', pattern: ROTASI_PATTERN, spv: 1, foreman: 1, staff: 6 },
  { nama: 'Quality Control', pattern: REGULER_PATTERN, spv: 1, foreman: 1, staff: 5 },
];

const FIRST_NAMES = [
  'Agus', 'Budi', 'Citra', 'Dewi', 'Eko', 'Fitri', 'Gilang', 'Hendra', 'Indah', 'Joko',
  'Kartika', 'Lestari', 'Maya', 'Nanda', 'Oki', 'Putri', 'Rudi', 'Siti', 'Teguh', 'Umi',
  'Vina', 'Wahyu', 'Yanti', 'Zaki', 'Andi', 'Bayu', 'Dian', 'Fajar', 'Galih', 'Intan',
];
const LAST_NAMES = [
  'Santoso', 'Wijaya', 'Pratama', 'Saputra', 'Hidayat', 'Nugroho', 'Kurniawan', 'Setiawan', 'Ramadhan', 'Permana',
  'Susanto', 'Firmansyah', 'Maulana', 'Purnomo', 'Hakim', 'Wibowo', 'Syahputra', 'Kusuma', 'Gunawan', 'Febrianto',
  'Mahendra', 'Prasetya', 'Mulyadi', 'Suryanto', 'Hermawan',
];

/** Nama fiktif unik per nomor urut (pasangan depan-belakang tidak berulang untuk 50+ orang). */
export function simName(index: number): string {
  const first = FIRST_NAMES[(index * 7) % FIRST_NAMES.length];
  const last = LAST_NAMES[(index * 11 + Math.floor(index / FIRST_NAMES.length)) % LAST_NAMES.length];
  return `${first} ${last}`;
}

export const simNik = (n: number) => `${SIM_NIK_PREFIX}${String(n).padStart(4, '0')}`;

export interface SeedEmployee {
  nik: string;
  nama: string;
  department: string;
  role: Role;
  atasanNik: string | null;
  tanggalMasuk: string; // 'YYYY-MM-DD', selalu sebelum rentang roster
  pattern: SeedPattern;
  /** Geser posisi pola supaya tim tersebar rata di tiap shift. */
  offset: number;
}

/** Tanggal masuk deterministik antara 2018-01-01 dan 2025-06-30 (sebelum roster dimulai). */
function joinDate(nik: string): string {
  const days = Math.floor(makeRng(`join|${nik}`)() * 2737);
  return addDays('2018-01-01', days);
}

export function buildEmployees(): SeedEmployee[] {
  const out: SeedEmployee[] = [];
  let n = 0;
  const push = (e: Omit<SeedEmployee, 'nik' | 'nama' | 'tanggalMasuk'>): SeedEmployee => {
    n++;
    const nik = simNik(n);
    const emp: SeedEmployee = { ...e, nik, nama: simName(n), tanggalMasuk: joinDate(nik) };
    out.push(emp);
    return emp;
  };

  // HR: 1 kepala (HRD), 2 staf HRD, 1 admin sistem, 3 staf biasa.
  const hr = DEPARTMENT_SPECS[0];
  const manager = push({ department: hr.nama, role: 'HRD', atasanNik: null, pattern: hr.pattern, offset: 0 });
  push({ department: hr.nama, role: 'HRD', atasanNik: manager.nik, pattern: hr.pattern, offset: 0 });
  push({ department: hr.nama, role: 'HRD', atasanNik: manager.nik, pattern: hr.pattern, offset: 0 });
  push({ department: hr.nama, role: 'ADMIN', atasanNik: manager.nik, pattern: hr.pattern, offset: 0 });
  for (let i = 0; i < 3; i++) {
    push({ department: hr.nama, role: 'EMPLOYEE', atasanNik: manager.nik, pattern: hr.pattern, offset: 0 });
  }

  for (const spec of DEPARTMENT_SPECS.slice(1)) {
    let idx = 0;
    const offsetFor = () => (spec.pattern.urutan.length === ROTASI_PATTERN.urutan.length ? idx % spec.pattern.urutan.length : 0);
    const spv = push({ department: spec.nama, role: 'SPV', atasanNik: manager.nik, pattern: spec.pattern, offset: offsetFor() });
    idx++;
    const foremen: SeedEmployee[] = [];
    for (let i = 0; i < spec.foreman; i++) {
      foremen.push(push({ department: spec.nama, role: 'FOREMAN', atasanNik: spv.nik, pattern: spec.pattern, offset: offsetFor() }));
      idx++;
    }
    for (let i = 0; i < spec.staff; i++) {
      push({
        department: spec.nama,
        role: 'EMPLOYEE',
        atasanNik: foremen[i % foremen.length].nik,
        pattern: spec.pattern,
        offset: offsetFor(),
      });
      idx++;
    }
  }
  return out;
}

/** Kepala divisi: HRD kepala untuk HR, SPV untuk divisi lain. Hasil: nama divisi -> NIK. */
export function departmentHeads(employees: SeedEmployee[]): Record<string, string> {
  const heads: Record<string, string> = {};
  for (const e of employees) {
    const isHead = e.department === 'HR' ? e.atasanNik === null : e.role === 'SPV';
    if (isHead) heads[e.department] = e.nik;
  }
  return heads;
}

// ---------- Hari libur nasional dan cuti bersama ----------

export interface SeedHoliday {
  tanggal: string;
  nama: string;
}

/**
 * Sumber: SKB 3 Menteri tentang Hari Libur Nasional dan Cuti Bersama (2026: 17 libur nasional + 8 cuti bersama,
 * Kemenag/Kemenaker/KemenPAN-RB No. 1497/2/5 Tahun 2025) dan SKB 2025 untuk Natal 2025.
 * Diverifikasi lewat pencarian pada 18 Okt 2026. Tidak ada libur/cuti bersama di Nov 2025 dan Sep-Nov 2026.
 * Cuti bersama ditandai di nama dan diperlakukan sebagai libur di simulasi ini.
 * Hari libur yang jatuh di akhir pekan tetap dicatat (22 Mar, 5 Apr, 31 Mei 2026).
 */
export const SEED_HOLIDAYS: SeedHoliday[] = [
  { tanggal: '2025-12-25', nama: 'Hari Raya Natal' },
  { tanggal: '2025-12-26', nama: 'Cuti Bersama Natal' },
  { tanggal: '2026-01-01', nama: 'Tahun Baru 2026 Masehi' },
  { tanggal: '2026-01-16', nama: "Isra Mi'raj Nabi Muhammad SAW" },
  { tanggal: '2026-02-16', nama: 'Cuti Bersama Tahun Baru Imlek' },
  { tanggal: '2026-02-17', nama: 'Tahun Baru Imlek 2577 Kongzili' },
  { tanggal: '2026-03-18', nama: 'Cuti Bersama Hari Suci Nyepi' },
  { tanggal: '2026-03-19', nama: 'Hari Suci Nyepi (Tahun Baru Saka 1948)' },
  { tanggal: '2026-03-20', nama: 'Cuti Bersama Idul Fitri 1447 H' },
  { tanggal: '2026-03-21', nama: 'Hari Raya Idul Fitri 1447 H' },
  { tanggal: '2026-03-22', nama: 'Hari Raya Idul Fitri 1447 H (hari kedua)' },
  { tanggal: '2026-03-23', nama: 'Cuti Bersama Idul Fitri 1447 H' },
  { tanggal: '2026-03-24', nama: 'Cuti Bersama Idul Fitri 1447 H' },
  { tanggal: '2026-04-03', nama: 'Wafat Yesus Kristus' },
  { tanggal: '2026-04-05', nama: 'Hari Kebangkitan Yesus Kristus (Paskah)' },
  { tanggal: '2026-05-01', nama: 'Hari Buruh Internasional' },
  { tanggal: '2026-05-14', nama: 'Kenaikan Yesus Kristus' },
  { tanggal: '2026-05-15', nama: 'Cuti Bersama Kenaikan Yesus Kristus' },
  { tanggal: '2026-05-27', nama: 'Hari Raya Idul Adha 1447 H' },
  { tanggal: '2026-05-28', nama: 'Cuti Bersama Idul Adha 1447 H' },
  { tanggal: '2026-05-31', nama: 'Hari Raya Waisak 2570 BE' },
  { tanggal: '2026-06-01', nama: 'Hari Lahir Pancasila' },
  { tanggal: '2026-06-16', nama: 'Tahun Baru Islam 1448 H' },
  { tanggal: '2026-08-17', nama: 'Hari Kemerdekaan Republik Indonesia' },
  { tanggal: '2026-08-25', nama: 'Maulid Nabi Muhammad SAW' },
  { tanggal: '2026-12-24', nama: 'Cuti Bersama Natal' },
  { tanggal: '2026-12-25', nama: 'Hari Raya Natal' },
];
