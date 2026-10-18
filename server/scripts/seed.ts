/**
 * FASE 1: seed data SIMULASI. Semua orang, NIK (awalan SIM), lokasi, dan absen di sini fiktif.
 *
 * Isi: 5 divisi, 50 karyawan + akun, 2 lokasi, 4 shift, 2 pola rotasi, hari libur nasional (diverifikasi),
 * roster 12 bulan (bulan berjalan + 11 bulan ke belakang) + 30 hari ke depan (~14 ribu baris), dan absen
 * historis untuk roster yang shift-nya sudah selesai. Pola telat berbeda per divisi (utils/seed-attendance.ts).
 *
 * Pemakaian (dari root atau folder server):
 *   npm run seed                  # tulis ke database di server/.env
 *   npm run seed:dry              # hitung rencana dan ringkasan, TANPA menyentuh database
 *
 * Aman dijalankan berulang (idempotent): data yang sudah ada dilewati, yang baru ditambahkan.
 * Seed hanya MENAMBAH data. Tidak ada yang dihapus atau ditimpa.
 * Env opsional: SEED_PASSWORD (password semua akun simulasi, default "simulasi123"),
 *               SEED_FORCE=true (izinkan di NODE_ENV=production; SEED_PASSWORD wajib diisi).
 */
import type { PoolConnection, RowDataPacket } from 'mysql2/promise';
import { RULES } from '../src/core/rules';
import { addDays, findRestViolations, generateRosterEntries, type PatternShift, type PlannedRoster } from '../src/utils/roster-rules';
import {
  planAttendance,
  splitRange,
  startOfMonthsBack,
  wibDateOf,
  type SeedAttendanceRow,
  type SeedRoster,
} from '../src/utils/seed-attendance';
import {
  buildEmployees,
  DEPARTMENT_LOCATION,
  departmentHeads,
  PATTERN_ANCHOR_DATE,
  SEED_HOLIDAYS,
  SEED_LOCATIONS,
  SEED_PATTERNS,
  SEED_SHIFTS,
  SIM_PASSWORD_DEFAULT,
  type SeedEmployee,
} from '../src/utils/seed-data';
import type { ShiftDef } from '../src/utils/shift-time';

const MONTHS_BACK = 11; // + bulan berjalan = 12 titik bulanan untuk grafik tahunan
const DAYS_AHEAD = 30;
const INSERT_CHUNK = 500;

const DRY_RUN = process.argv.includes('--dry-run');

const placeholders = (n: number) => Array.from({ length: n }, () => '?').join(',');

// ---------- Rencana roster (dipakai dry-run dan run sungguhan) ----------

interface Prepared {
  emp: SeedEmployee;
  employeeId: number;
}

type PlannedWithNik = PlannedRoster & { nik: string };

function planRosters(preps: Prepared[], shifts: PatternShift[], from: string, to: string): PlannedWithNik[] {
  const nikById = new Map(preps.map((p) => [p.employeeId, p.emp.nik]));
  const planned = preps.flatMap((p) =>
    generateRosterEntries({
      employeeId: p.employeeId,
      urutan: p.emp.pattern.urutan,
      shifts,
      anchorDate: PATTERN_ANCHOR_DATE, // tetap, supaya run di tanggal lain tidak menggeser fase pola
      offset: p.emp.offset,
      from,
      to,
    }),
  );
  // Aturan bisnis 4 (jeda >= 11 jam) dicek untuk seluruh rentang sebelum ada yang ditulis.
  const violations = findRestViolations(
    planned.map((p) => ({ employeeId: p.employeeId, shiftDate: p.shiftDate, window: p.window, isNew: true })),
    RULES.minRestHoursBetweenShifts,
  );
  if (violations.length > 0) {
    const v = violations[0];
    throw new Error(
      `Pola seed melanggar jeda ${v.minRestHours} jam: karyawan #${v.employeeId}, ${v.previousDate} ke ${v.nextDate} (${v.restHours} jam).`,
    );
  }
  return planned.map((p) => ({ ...p, nik: nikById.get(p.employeeId)! }));
}

function summarize(rows: SeedAttendanceRow[], rosterOf: Map<number, SeedRoster>): void {
  const per = new Map<string, Record<string, number>>();
  for (const r of rows) {
    const dept = rosterOf.get(r.rosterId)!.divisionName;
    const c = per.get(dept) ?? {};
    c[r.status] = (c[r.status] ?? 0) + 1;
    c.TOTAL = (c.TOTAL ?? 0) + 1;
    per.set(dept, c);
  }
  const pct = (c: Record<string, number>, k: string) => (((c[k] ?? 0) / (c.TOTAL - (c.LIBUR ?? 0))) * 100).toFixed(1) + '%';
  console.table(
    [...per.entries()]
      .map(([divisi, c]) => ({
        divisi,
        baris: c.TOTAL,
        telat: pct(c, 'TELAT'),
        'pulang cepat': pct(c, 'PULANG_CEPAT'),
        alpa: pct(c, 'ALPA'),
        hadir: pct(c, 'HADIR'),
        libur: c.LIBUR ?? 0,
      }))
      .sort((a, b) => parseFloat(b.telat) - parseFloat(a.telat)),
  );
}

// ---------- Dry run ----------

function dryRun(now: Date): void {
  const today = wibDateOf(now);
  const from = startOfMonthsBack(today, MONTHS_BACK);
  const to = addDays(today, DAYS_AHEAD);
  const employees = buildEmployees();
  const preps = employees.map((emp, i) => ({ emp, employeeId: i + 1 }));
  const shifts: PatternShift[] = SEED_SHIFTS.map((s, i) => ({
    id: i + 1,
    nama: s.nama,
    def: { startTime: s.jamMulai, endTime: s.jamSelesai, lateToleranceMinutes: s.toleransiMenit },
  }));
  const shiftById = new Map(shifts.map((s) => [s.id, s.def]));
  const empByNik = new Map(employees.map((e) => [e.nik, e]));
  const planned = planRosters(preps, shifts, from, to);

  const rosters: SeedRoster[] = planned.map((p, i) => {
    const emp = empByNik.get(p.nik)!;
    const loc = SEED_LOCATIONS.find((l) => l.nama === DEPARTMENT_LOCATION[emp.department])!;
    return {
      rosterId: i + 1,
      nik: p.nik,
      divisionName: emp.department,
      shiftDate: p.shiftDate,
      shift: shiftById.get(p.shiftId)!,
      location: { lat: loc.lat, lng: loc.lng, radiusM: loc.radiusM },
    };
  });
  const rows = planAttendance(rosters, { now, holidays: new Set(SEED_HOLIDAYS.map((h) => h.tanggal)) });
  const rosterOf = new Map(rosters.map((r) => [r.rosterId, r]));

  console.log('[DRY RUN] tidak ada yang ditulis ke database.');
  console.log(`Hari ini (WIB): ${today} | rentang roster: ${from} .. ${to}`);
  console.log(`Karyawan: ${employees.length} | roster: ${rosters.length} | absen historis: ${rows.length} | hari libur: ${SEED_HOLIDAYS.length}`);
  console.log(`Roster tanpa absen (shift belum selesai): ${rosters.length - rows.length}`);
  console.log('Persentase dihitung dari hari kerja (tanpa LIBUR):');
  summarize(rows, rosterOf);
}

// ---------- Run sungguhan ----------

interface Counters {
  rostersInserted: number;
  rostersExisting: number;
  attendanceInserted: number;
  notFinished: number;
}

async function main(): Promise<void> {
  const now = new Date();
  if (DRY_RUN) return dryRun(now);

  // Modul yang butuh .env/DB dimuat belakangan, supaya --dry-run tidak butuh database.
  const { config } = await import('../src/core/config');
  if (config.NODE_ENV === 'production') {
    if (process.env.SEED_FORCE !== 'true') {
      console.error('Seed menolak jalan di NODE_ENV=production. Ini data simulasi. Set SEED_FORCE=true jika memang disengaja.');
      process.exit(1);
    }
    if (!process.env.SEED_PASSWORD) {
      console.error('Di production, SEED_PASSWORD wajib diisi (jangan pakai password bawaan).');
      process.exit(1);
    }
  }
  const password = process.env.SEED_PASSWORD ?? SIM_PASSWORD_DEFAULT;
  if (password.length < 8) {
    console.error('SEED_PASSWORD minimal 8 karakter.');
    process.exit(1);
  }

  const { pool, withTransaction } = await import('../src/core/db');
  const { hashPassword } = await import('../src/core/password');
  const { rosterRepository } = await import('../src/modules/roster/roster.repository');

  try {
    const today = wibDateOf(now);
    const from = startOfMonthsBack(today, MONTHS_BACK);
    const to = addDays(today, DAYS_AHEAD);
    const employees = buildEmployees();
    const holidays = new Set(SEED_HOLIDAYS.map((h) => h.tanggal));
    console.log(`Seed data simulasi. Hari ini (WIB): ${today} | roster ${from} .. ${to}`);

    // 1) Data master (satu transaksi). Hash password sekali dan dipakai ulang (salt ada di dalam hash).
    const passwordHash = await hashPassword(password);
    const master = await withTransaction((conn) => seedMaster(conn, employees, passwordHash));
    console.log(
      `Master baru: ${master.newDepartments} divisi, ${master.newEmployees} karyawan, ${master.newUsers} akun, ${master.newHolidays} hari libur.`,
    );

    // 2) Baca balik dari DB (nilai shift dan lokasi di DB yang jadi acuan).
    const { shiftsByName, locationsByName } = await loadReference();
    const preps: Prepared[] = employees.map((emp) => ({ emp, employeeId: master.employeeIdByNik.get(emp.nik)! }));
    const patternShifts: PatternShift[] = SEED_SHIFTS.map((s) => {
      const row = shiftsByName.get(s.nama.toLowerCase());
      if (!row) throw new Error(`Shift "${s.nama}" tidak ada di database`);
      return { id: row.id, nama: row.nama, def: row.def };
    });
    const shiftDefById = new Map(patternShifts.map((s) => [s.id, s.def]));
    const empByEmployeeId = new Map(preps.map((p) => [p.employeeId, p.emp]));
    const employeeIds = preps.map((p) => p.employeeId);

    // 3) Rencana roster seluruh rentang + cek jeda 11 jam sebelum menulis roster apa pun.
    const planned = planRosters(preps, patternShifts, from, to);

    // 4) Roster + absen per potongan <= 62 hari (batas API roster), satu transaksi kecil per potongan.
    const totals: Counters = { rostersInserted: 0, rostersExisting: 0, attendanceInserted: 0, notFinished: 0 };
    for (const chunk of splitRange(from, to)) {
      const part = planned.filter((p) => p.shiftDate >= chunk.from && p.shiftDate <= chunk.to);
      const c = await withTransaction((conn) =>
        seedChunk(conn, { chunk, part, employeeIds, locationsByName, shiftDefById, empByEmployeeId, holidays, now, rosterRepository }),
      );
      totals.rostersInserted += c.rostersInserted;
      totals.rostersExisting += c.rostersExisting;
      totals.attendanceInserted += c.attendanceInserted;
      totals.notFinished += c.notFinished;
      console.log(
        `  ${chunk.from}..${chunk.to}: roster +${c.rostersInserted} (sudah ada ${c.rostersExisting}), absen +${c.attendanceInserted}, belum selesai ${c.notFinished}`,
      );
    }

    console.log(
      `\nSelesai. Roster baru: ${totals.rostersInserted}, absen baru: ${totals.attendanceInserted}, roster sudah ada (dilewati): ${totals.rostersExisting}.`,
    );
    console.log(
      `Login simulasi: NIK ${employees[0].nik} (HRD) sampai ${employees[employees.length - 1].nik}, password: ${
        process.env.SEED_PASSWORD ? '(isi SEED_PASSWORD)' : SIM_PASSWORD_DEFAULT
      }`,
    );
    console.log('Semua data ini SIMULASI. Jangan dipakai di lingkungan sungguhan.');
  } finally {
    await pool.end();
  }
}

// ---------- Master ----------

interface MasterResult {
  newDepartments: number;
  newEmployees: number;
  newUsers: number;
  newHolidays: number;
  employeeIdByNik: Map<string, number>;
}

type NamedTable = 'departments' | 'locations' | 'shifts' | 'shift_patterns';

async function idByNama(conn: PoolConnection, table: NamedTable, nama: string): Promise<number | null> {
  const [rows] = await conn.execute<RowDataPacket[]>(`SELECT id FROM ${table} WHERE nama = ? LIMIT 1`, [nama]);
  return rows[0] ? Number(rows[0].id) : null;
}

async function seedMaster(conn: PoolConnection, employees: SeedEmployee[], passwordHash: string): Promise<MasterResult> {
  const res: MasterResult = { newDepartments: 0, newEmployees: 0, newUsers: 0, newHolidays: 0, employeeIdByNik: new Map() };

  const departmentId = new Map<string, number>();
  for (const nama of [...new Set(employees.map((e) => e.department))]) {
    let id = await idByNama(conn, 'departments', nama);
    if (id === null) {
      const [r] = await conn.execute('INSERT INTO departments (nama) VALUES (?)', [nama]);
      id = (r as { insertId: number }).insertId;
      res.newDepartments++;
    }
    departmentId.set(nama, id);
  }

  for (const l of SEED_LOCATIONS) {
    if ((await idByNama(conn, 'locations', l.nama)) === null) {
      await conn.execute('INSERT INTO locations (nama, lat, lng, radius_m) VALUES (?, ?, ?, ?)', [l.nama, l.lat, l.lng, l.radiusM]);
    }
  }
  for (const s of SEED_SHIFTS) {
    if ((await idByNama(conn, 'shifts', s.nama)) === null) {
      await conn.execute(
        'INSERT INTO shifts (nama, jam_mulai, jam_selesai, lintas_hari, toleransi_menit) VALUES (?, ?, ?, ?, ?)',
        [s.nama, s.jamMulai, s.jamSelesai, s.lintasHari ? 1 : 0, s.toleransiMenit],
      );
    }
  }
  for (const p of SEED_PATTERNS) {
    if ((await idByNama(conn, 'shift_patterns', p.nama)) === null) {
      await conn.execute('INSERT INTO shift_patterns (nama, urutan) VALUES (?, ?)', [p.nama, JSON.stringify(p.urutan)]);
    }
  }
  for (const h of SEED_HOLIDAYS) {
    const [r] = await conn.execute('INSERT INTO holidays (tanggal, nama) VALUES (?, ?) ON DUPLICATE KEY UPDATE tanggal = tanggal', [
      h.tanggal,
      h.nama,
    ]);
    if ((r as { affectedRows: number }).affectedRows === 1) res.newHolidays++;
  }

  // Karyawan dan akun. Yang sudah ada (NIK sama) dilewati.
  for (const e of employees) {
    const [found] = await conn.execute<RowDataPacket[]>('SELECT id FROM employees WHERE nik = ? LIMIT 1', [e.nik]);
    let employeeId: number;
    if (found[0]) {
      employeeId = Number(found[0].id);
    } else {
      const [r] = await conn.execute('INSERT INTO employees (nik, nama, department_id, tanggal_masuk) VALUES (?, ?, ?, ?)', [
        e.nik,
        e.nama,
        departmentId.get(e.department)!,
        e.tanggalMasuk,
      ]);
      employeeId = (r as { insertId: number }).insertId;
      res.newEmployees++;
    }
    res.employeeIdByNik.set(e.nik, employeeId);

    const [user] = await conn.execute<RowDataPacket[]>('SELECT id FROM users WHERE employee_id = ? LIMIT 1', [employeeId]);
    if (!user[0]) {
      await conn.execute('INSERT INTO users (employee_id, password_hash, role) VALUES (?, ?, ?)', [employeeId, passwordHash, e.role]);
      res.newUsers++;
    }
  }

  // Atasan dan kepala divisi: hanya diisi bila masih kosong (tidak menimpa perubahan manual).
  for (const e of employees) {
    if (!e.atasanNik) continue;
    await conn.execute('UPDATE employees SET atasan_id = ? WHERE id = ? AND atasan_id IS NULL', [
      res.employeeIdByNik.get(e.atasanNik)!,
      res.employeeIdByNik.get(e.nik)!,
    ]);
  }
  for (const [dept, nik] of Object.entries(departmentHeads(employees))) {
    await conn.execute('UPDATE departments SET kepala_id = ? WHERE id = ? AND kepala_id IS NULL', [
      res.employeeIdByNik.get(nik)!,
      departmentId.get(dept)!,
    ]);
  }
  return res;
}

// ---------- Referensi dari DB ----------

interface ShiftRow {
  id: number;
  nama: string;
  def: ShiftDef;
}
interface LocationRow {
  id: number;
  lat: number;
  lng: number;
  radiusM: number;
}

async function loadReference(): Promise<{ shiftsByName: Map<string, ShiftRow>; locationsByName: Map<string, LocationRow> }> {
  const { pool } = await import('../src/core/db');
  const [shiftRows] = await pool.execute<RowDataPacket[]>(
    `SELECT id, nama, TIME_FORMAT(jam_mulai, '%H:%i') AS jamMulai, TIME_FORMAT(jam_selesai, '%H:%i') AS jamSelesai,
            toleransi_menit AS toleransi FROM shifts`,
  );
  const shiftsByName = new Map<string, ShiftRow>();
  for (const r of shiftRows) {
    shiftsByName.set(String(r.nama).toLowerCase(), {
      id: Number(r.id),
      nama: String(r.nama),
      def: { startTime: String(r.jamMulai), endTime: String(r.jamSelesai), lateToleranceMinutes: Number(r.toleransi) },
    });
  }
  const [locRows] = await pool.execute<RowDataPacket[]>('SELECT id, nama, lat, lng, radius_m AS radiusM FROM locations');
  const locationsByName = new Map<string, LocationRow>();
  for (const r of locRows) {
    locationsByName.set(String(r.nama), { id: Number(r.id), lat: Number(r.lat), lng: Number(r.lng), radiusM: Number(r.radiusM) });
  }
  return { shiftsByName, locationsByName };
}

// ---------- Satu potongan rentang: roster lalu absen ----------

interface ChunkCtx {
  chunk: { from: string; to: string };
  part: PlannedWithNik[];
  employeeIds: number[];
  locationsByName: Map<string, LocationRow>;
  shiftDefById: Map<number, ShiftDef>;
  empByEmployeeId: Map<number, SeedEmployee>;
  holidays: ReadonlySet<string>;
  now: Date;
  rosterRepository: typeof import('../src/modules/roster/roster.repository').rosterRepository;
}

async function seedChunk(conn: PoolConnection, ctx: ChunkCtx): Promise<Counters> {
  const { chunk, part, employeeIds, rosterRepository } = ctx;
  const out: Counters = { rostersInserted: 0, rostersExisting: 0, attendanceInserted: 0, notFinished: 0 };

  // Roster: lewati yang sudah ada (UNIQUE(employee_id, shift_date) jadi lapis kedua).
  const existing = await rosterRepository.findRosters(employeeIds, chunk.from, chunk.to);
  const have = new Set(existing.map((r) => `${r.employeeId}|${r.shiftDate}`));
  const toInsert = part
    .filter((p) => !have.has(`${p.employeeId}|${p.shiftDate}`))
    .map((p) => {
      const dept = ctx.empByEmployeeId.get(p.employeeId)!.department;
      const loc = ctx.locationsByName.get(DEPARTMENT_LOCATION[dept]);
      if (!loc) throw new Error(`Lokasi "${DEPARTMENT_LOCATION[dept]}" tidak ada di database`);
      return { employeeId: p.employeeId, shiftDate: p.shiftDate, shiftId: p.shiftId, locationId: loc.id };
    });
  if (toInsert.length > 0) await rosterRepository.insertRosters(toInsert, conn);
  out.rostersInserted = toInsert.length;
  out.rostersExisting = part.length - toInsert.length;

  // Absen: roster karyawan seed di potongan ini yang belum punya attendance (select dulu, UNIQUE(roster_id) lapis kedua).
  const [pending] = await conn.execute<RowDataPacket[]>(
    `SELECT r.id AS rosterId, r.employee_id AS employeeId, DATE_FORMAT(r.shift_date, '%Y-%m-%d') AS shiftDate,
            r.shift_id AS shiftId, r.location_id AS locationId
     FROM rosters r LEFT JOIN attendance a ON a.roster_id = r.id
     WHERE r.employee_id IN (${placeholders(employeeIds.length)}) AND r.shift_date BETWEEN ? AND ? AND a.id IS NULL`,
    [...employeeIds, chunk.from, chunk.to],
  );
  const locById = new Map([...ctx.locationsByName.values()].map((l) => [l.id, l]));
  const seedRosters: SeedRoster[] = pending.map((r) => {
    const emp = ctx.empByEmployeeId.get(Number(r.employeeId))!;
    const loc = locById.get(Number(r.locationId))!;
    return {
      rosterId: Number(r.rosterId),
      nik: emp.nik,
      divisionName: emp.department,
      shiftDate: String(r.shiftDate),
      shift: ctx.shiftDefById.get(Number(r.shiftId))!,
      location: { lat: loc.lat, lng: loc.lng, radiusM: loc.radiusM },
    };
  });
  const rows = planAttendance(seedRosters, { now: ctx.now, holidays: ctx.holidays });
  out.notFinished = seedRosters.length - rows.length;
  for (let i = 0; i < rows.length; i += INSERT_CHUNK) {
    const slice = rows.slice(i, i + INSERT_CHUNK);
    await conn.execute(
      `INSERT INTO attendance (roster_id, check_in_at, check_out_at, lat_in, lng_in, lat_out, lng_out, distance_m, accuracy_m, late_minutes, status)
       VALUES ${slice.map(() => '(?,?,?,?,?,?,?,?,?,?,?)').join(',')}`,
      slice.flatMap((a) => [
        a.rosterId, a.checkInAt, a.checkOutAt, a.latIn, a.lngIn, a.latOut, a.lngOut, a.distanceM, a.accuracyM, a.lateMinutes, a.status,
      ]),
    );
  }
  out.attendanceInserted = rows.length;
  return out;
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
