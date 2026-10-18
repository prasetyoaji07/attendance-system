/**
 * SEED: generator absen historis SIMULASI (PURE, tanpa DB). Dipakai scripts/seed.ts dan dites di
 * src/tests/seed-attendance.test.ts. Semua data adalah simulasi.
 *
 * Prinsip:
 * - Deterministik: angka acak berasal dari seed tetap `nik|tanggal`, jadi run ulang menghasilkan nilai yang sama.
 * - Status TIDAK ditulis tangan. Jam check-in/out dibuat sesuai "kejadian" (normal, telat, pulang cepat, alpa),
 *   lalu status dan menit telat dihitung oleh computeDailyStatus (aturan satu tempat, konsisten dengan aturan 1-4).
 * - Hanya roster yang shift-nya sudah selesai (now >= endsAt) yang diberi absen.
 * - CUTI/IZIN/SAKIT tidak dibuat: statusnya harus berasal dari pengajuan APPROVED (Fase 3).
 * - Hari libur nasional: tanpa absen, statusnya LIBUR (hasil computeDailyStatus dengan isHoliday).
 * - Jam check-in/out ada di jendela check-in (mulai - 2 jam sampai selesai + 2 jam). GPS di dalam radius lokasi.
 */
import { RULES } from '../core/rules';
import type { AttendanceStatus } from '../core/roles';
import { computeDailyStatus } from './daily-status';
import { haversineMeters } from './haversine';
import { buildShiftWindow, type RosterWindow, type ShiftDef } from './shift-time';

const MS_MINUTE = 60_000;
const MS_HOUR = 3_600_000;
const WIB_OFFSET_MS = 7 * MS_HOUR;

// ---------- Acak deterministik ----------

/** Hash string -> uint32 (FNV-1a). */
export function hashSeed(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Generator acak mulberry32: mengembalikan fungsi yang menghasilkan angka [0, 1). */
export function makeRng(seed: string | number): () => number {
  let a = typeof seed === 'string' ? hashSeed(seed) : seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Eksponensial dengan rata-rata `mean` (u dijaga agar log tidak tak hingga). */
const expDraw = (rng: () => number, mean: number) => -Math.log(1 - Math.min(rng(), 0.999999)) * mean;
const between = (rng: () => number, lo: number, hi: number) => lo + rng() * (hi - lo);

// ---------- Profil divisi ----------

export interface DivisionProfile {
  /** Peluang telat dasar per hari kerja (sebelum faktor karyawan dan hari). */
  lateRate: number;
  /** Peluang pulang cepat per hari kerja. */
  earlyLeaveRate: number;
  /** Peluang alpa per hari kerja. */
  alpaRate: number;
}

/**
 * Pola telat berbeda per divisi supaya grafik tren dan "siapa paling rajin" punya jawaban.
 * Urutan telat: Gudang > Produksi > Maintenance > Quality Control > HR.
 */
export const DIVISION_PROFILES: Record<string, DivisionProfile> = {
  Gudang: { lateRate: 0.16, earlyLeaveRate: 0.03, alpaRate: 0.025 },
  Produksi: { lateRate: 0.1, earlyLeaveRate: 0.03, alpaRate: 0.02 },
  Maintenance: { lateRate: 0.07, earlyLeaveRate: 0.025, alpaRate: 0.015 },
  'Quality Control': { lateRate: 0.04, earlyLeaveRate: 0.02, alpaRate: 0.01 },
  HR: { lateRate: 0.025, earlyLeaveRate: 0.015, alpaRate: 0.008 },
};

/** Pengali hari (0 = Minggu ... 6 = Sabtu, menurut tanggal kalender WIB). Senin sedikit lebih sering telat. */
export const WEEKDAY_LATE_FACTOR: readonly number[] = [1.0, 1.4, 1.0, 1.0, 1.0, 1.0, 1.0];

/** Karyawan telat kronis: ~8% populasi, peluang telatnya 2.2-3.0x profil divisi. */
const CHRONIC_SHARE = 0.08;

export interface EmployeeTraits {
  /** Pengali peluang telat (rata-rata populasi mendekati 0.94, lalu dikali pengali hari ~1.06 jadi ~1.0). */
  lateFactor: number;
  chronic: boolean;
  /** Pengali peluang alpa dan pulang cepat. */
  discipline: number;
}

/** Sifat karyawan ditentukan oleh NIK (stabil antar run). */
export function employeeTraits(nik: string): EmployeeTraits {
  const rng = makeRng(`traits|${nik}`);
  const chronic = rng() < CHRONIC_SHARE;
  const lateFactor = chronic ? between(rng, 2.2, 3.0) : between(rng, 0.5, 1.1);
  const discipline = chronic ? between(rng, 1.2, 1.8) : between(rng, 0.6, 1.2);
  return { lateFactor, chronic, discipline };
}

// ---------- Input / output ----------

export interface SeedRoster {
  rosterId: number;
  nik: string;
  divisionName: string;
  shiftDate: string; // 'YYYY-MM-DD'
  shift: ShiftDef;
  location: { lat: number; lng: number; radiusM: number };
}

export interface SeedAttendanceRow {
  rosterId: number;
  checkInAt: Date | null; // UTC
  checkOutAt: Date | null; // UTC
  latIn: number | null;
  lngIn: number | null;
  latOut: number | null;
  lngOut: number | null;
  distanceM: number | null;
  accuracyM: number | null;
  lateMinutes: number;
  status: AttendanceStatus;
}

/** Hari dalam seminggu (0 = Minggu) untuk tanggal kalender 'YYYY-MM-DD'. */
export function weekdayOf(shiftDate: string): number {
  const [y, m, d] = shiftDate.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/** Tanggal WIB hari ini ('YYYY-MM-DD') dari instan `now`. */
export function wibDateOf(now: Date): string {
  return new Date(now.getTime() + WIB_OFFSET_MS).toISOString().slice(0, 10);
}

// ---------- GPS simulasi ----------

const M_PER_DEG_LAT = 111_320;

/** Titik acak di dalam lingkaran radius lokasi (maksimal 85% radius, supaya selalu lolos geofence). */
function randomPointInside(
  rng: () => number,
  center: { lat: number; lng: number },
  radiusM: number,
): { lat: number; lng: number; distanceM: number } {
  const dist = Math.sqrt(rng()) * radiusM * 0.85;
  const angle = rng() * 2 * Math.PI;
  const dLat = (dist * Math.cos(angle)) / M_PER_DEG_LAT;
  const dLng = (dist * Math.sin(angle)) / (M_PER_DEG_LAT * Math.cos((center.lat * Math.PI) / 180));
  const lat = Math.round((center.lat + dLat) * 1e7) / 1e7;
  const lng = Math.round((center.lng + dLng) * 1e7) / 1e7;
  return { lat, lng, distanceM: Math.round(haversineMeters(lat, lng, center.lat, center.lng) * 100) / 100 };
}

// ---------- Generator utama ----------

export interface PlanOptions {
  now: Date;
  /** Tanggal libur nasional ('YYYY-MM-DD'). Roster di tanggal ini tidak diberi absen (status LIBUR). */
  holidays: ReadonlySet<string>;
}

/**
 * Hasilkan baris attendance untuk satu roster, atau null bila shift belum selesai.
 * Status dan menit telat dihitung oleh computeDailyStatus dari jam yang dibuat.
 */
export function planAttendanceFor(r: SeedRoster, opts: PlanOptions): SeedAttendanceRow | null {
  const window: RosterWindow = buildShiftWindow(r.shiftDate, r.shift);
  if (opts.now.getTime() < window.endsAt.getTime()) return null; // shift berjalan/akan datang: tanpa absen

  const tol = r.shift.lateToleranceMinutes;
  const noShow: SeedAttendanceRow = {
    rosterId: r.rosterId,
    checkInAt: null,
    checkOutAt: null,
    latIn: null,
    lngIn: null,
    latOut: null,
    lngOut: null,
    distanceM: null,
    accuracyM: null,
    lateMinutes: 0,
    status: 'ALPA',
  };

  if (opts.holidays.has(r.shiftDate)) {
    const res = computeDailyStatus({ now: opts.now, window, toleranceMinutes: tol, attendance: null, isHoliday: true });
    return { ...noShow, status: res.status ?? 'LIBUR' };
  }

  const profile = DIVISION_PROFILES[r.divisionName];
  if (!profile) throw new Error(`Divisi tanpa profil seed: "${r.divisionName}"`);
  const traits = employeeTraits(r.nik);
  const rng = makeRng(`att|${r.nik}|${r.shiftDate}`);

  // Urutan pemakaian rng tetap supaya hasil stabil.
  const uAlpa = rng();
  const uLate = rng();
  const uEarly = rng();

  const pAlpa = Math.min(0.5, profile.alpaRate * traits.discipline);
  if (uAlpa < pAlpa) {
    const res = computeDailyStatus({ now: opts.now, window, toleranceMinutes: tol, attendance: null });
    return { ...noShow, status: res.status ?? 'ALPA' };
  }

  const pLate = Math.min(0.6, profile.lateRate * traits.lateFactor * WEEKDAY_LATE_FACTOR[weekdayOf(r.shiftDate)]);
  const isLate = uLate < pLate;
  const isEarly = uEarly < Math.min(0.3, profile.earlyLeaveRate * traits.discipline);

  const beforeMs = RULES.checkinWindowHoursBefore * MS_HOUR;
  const afterMs = RULES.checkinWindowHoursAfter * MS_HOUR;
  const startMs = window.startsAt.getTime();
  const endMs = window.endsAt.getTime();
  const deadlineMs = startMs + tol * MS_MINUTE;

  // --- Check-in ---
  let checkInMs: number;
  if (isLate) {
    // Telat 1 menit atau lebih setelah batas toleransi; kronis cenderung lebih lama.
    const lateMin = 1 + Math.floor(expDraw(rng, traits.chronic ? 18 : 10));
    checkInMs = deadlineMs + Math.min(lateMin, 90) * MS_MINUTE + Math.floor(rng() * 60) * 1000;
  } else {
    // Tepat waktu: paling lambat tepat di batas toleransi, rata-rata ~12 menit sebelum batas.
    const earlyBy = Math.min(Math.floor(expDraw(rng, 12 * 60)), (beforeMs - 5 * MS_MINUTE) / 1000);
    checkInMs = deadlineMs - earlyBy * 1000;
  }
  checkInMs = Math.max(startMs - beforeMs, Math.min(checkInMs, endMs + afterMs));

  // --- Check-out ---
  let checkOutMs: number;
  if (isEarly) {
    // Pulang cepat 1 menit atau lebih sebelum (selesai - toleransi), maksimal 2 jam.
    const earlyMin = 1 + Math.floor(expDraw(rng, 25));
    checkOutMs = endMs - tol * MS_MINUTE - Math.min(earlyMin, 120) * MS_MINUTE - Math.floor(rng() * 60) * 1000;
  } else {
    // Normal: tidak lebih awal dari (selesai - toleransi), rata-rata sekitar selesai + beberapa menit.
    const extra = Math.floor(expDraw(rng, (tol + 8) * 60)) * 1000;
    checkOutMs = endMs - tol * MS_MINUTE + Math.min(extra, afterMs - 10 * MS_MINUTE);
  }
  // Tidak lebih awal dari check-in (+1 menit) dan tetap di dalam jendela.
  checkOutMs = Math.max(checkOutMs, checkInMs + MS_MINUTE);
  checkOutMs = Math.min(checkOutMs, endMs + afterMs);

  const checkInAt = new Date(checkInMs);
  const checkOutAt = new Date(checkOutMs);
  const result = computeDailyStatus({
    now: opts.now,
    window,
    toleranceMinutes: tol,
    attendance: { checkInAt, checkOutAt },
  });

  // GPS: titik acak di dalam radius, akurasi 5-35 m (batas aturan 50 m).
  const pIn = randomPointInside(rng, r.location, r.location.radiusM);
  const pOut = randomPointInside(rng, r.location, r.location.radiusM);
  const accuracyM = Math.round(between(rng, 5, 35) * 100) / 100;

  return {
    rosterId: r.rosterId,
    checkInAt,
    checkOutAt,
    latIn: pIn.lat,
    lngIn: pIn.lng,
    latOut: pOut.lat,
    lngOut: pOut.lng,
    distanceM: pIn.distanceM,
    accuracyM,
    lateMinutes: result.lateMinutes,
    status: result.status ?? 'HADIR',
  };
}

/** Rencana absen untuk banyak roster. Roster yang shift-nya belum selesai dilewati. */
export function planAttendance(rosters: SeedRoster[], opts: PlanOptions): SeedAttendanceRow[] {
  const rows: SeedAttendanceRow[] = [];
  for (const r of rosters) {
    const row = planAttendanceFor(r, opts);
    if (row) rows.push(row);
  }
  return rows;
}

// ---------- Rentang tanggal seed ----------

/** Tanggal 1, `monthsBack` bulan sebelum bulan dari `today` ('YYYY-MM-DD'). */
export function startOfMonthsBack(today: string, monthsBack: number): string {
  const [y, m] = today.split('-').map(Number);
  const idx = y * 12 + (m - 1) - monthsBack;
  const yy = Math.floor(idx / 12);
  const mm = (idx % 12) + 1;
  return `${String(yy).padStart(4, '0')}-${String(mm).padStart(2, '0')}-01`;
}

/**
 * Pecah [from, to] menjadi potongan paling banyak `maxDays` hari (default sesuai batas API roster).
 * Dipakai supaya tiap transaksi seed kecil.
 */
export function splitRange(from: string, to: string, maxDays: number = RULES.maxRosterRangeDays): { from: string; to: string }[] {
  const dayMs = 86_400_000;
  const parse = (s: string) => {
    const [y, m, d] = s.split('-').map(Number);
    return Date.UTC(y, m - 1, d);
  };
  const fmt = (t: number) => new Date(t).toISOString().slice(0, 10);
  const out: { from: string; to: string }[] = [];
  let cur = parse(from);
  const end = parse(to);
  if (end < cur) throw new Error('Tanggal akhir tidak boleh sebelum tanggal awal');
  while (cur <= end) {
    const chunkEnd = Math.min(cur + (maxDays - 1) * dayMs, end);
    out.push({ from: fmt(cur), to: fmt(chunkEnd) });
    cur = chunkEnd + dayMs;
  }
  return out;
}
