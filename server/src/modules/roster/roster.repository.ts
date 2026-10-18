import type { ResultSetHeader, RowDataPacket } from 'mysql2';
import { dbOf } from '../../core/db-helpers';
import type { PatternRecord, RosterInsert, RosterListItem, RosterRepository, RosterRow } from './roster.service';

interface PatternRow extends RowDataPacket {
  id: number;
  nama: string;
  urutan: unknown; // JSON: mysql2 biasanya sudah mengurai, tetapi string tetap ditangani
}

const parseUrutan = (v: unknown): string[] => {
  const parsed = typeof v === 'string' ? JSON.parse(v) : v;
  return Array.isArray(parsed) ? parsed.map(String) : [];
};
const toPattern = (r: PatternRow): PatternRecord => ({ id: r.id, nama: r.nama, urutan: parseUrutan(r.urutan) });

const placeholders = (n: number) => Array.from({ length: n }, () => '?').join(',');
const CHUNK = 500;

interface ListRow extends RowDataPacket {
  id: number;
  employeeId: number;
  employeeNama: string;
  shiftDate: string;
  shiftId: number;
  shiftNama: string;
  jamMulai: string;
  jamSelesai: string;
  lintasHari: number;
  locationId: number;
  locationNama: string;
}

export const rosterRepository: RosterRepository = {
  async findPatterns() {
    const [rows] = await dbOf().execute<PatternRow[]>('SELECT id, nama, urutan FROM shift_patterns ORDER BY nama');
    return rows.map(toPattern);
  },
  async findPatternById(id) {
    const [rows] = await dbOf().execute<PatternRow[]>('SELECT id, nama, urutan FROM shift_patterns WHERE id = ? LIMIT 1', [id]);
    return rows[0] ? toPattern(rows[0]) : null;
  },
  async insertPattern(d, tx) {
    const [res] = await dbOf(tx).execute<ResultSetHeader>('INSERT INTO shift_patterns (nama, urutan) VALUES (?, ?)', [
      d.nama,
      JSON.stringify(d.urutan),
    ]);
    return res.insertId;
  },
  async findActiveEmployeeIds(ids) {
    if (ids.length === 0) return [];
    const [rows] = await dbOf().execute<(RowDataPacket & { id: number })[]>(
      `SELECT id FROM employees WHERE aktif = 1 AND id IN (${placeholders(ids.length)})`,
      ids,
    );
    return rows.map((r) => Number(r.id));
  },
  async findRosters(employeeIds, from, to) {
    if (employeeIds.length === 0) return [];
    const [rows] = await dbOf().execute<(RowDataPacket & RosterRow)[]>(
      `SELECT id, employee_id AS employeeId, DATE_FORMAT(shift_date, '%Y-%m-%d') AS shiftDate, shift_id AS shiftId, location_id AS locationId
       FROM rosters WHERE employee_id IN (${placeholders(employeeIds.length)}) AND shift_date BETWEEN ? AND ?`,
      [...employeeIds, from, to],
    );
    return rows.map((r) => ({ id: r.id, employeeId: r.employeeId, shiftDate: r.shiftDate, shiftId: r.shiftId, locationId: r.locationId }));
  },
  async insertRosters(rows: RosterInsert[], tx) {
    for (let i = 0; i < rows.length; i += CHUNK) {
      const part = rows.slice(i, i + CHUNK);
      await dbOf(tx).execute(
        `INSERT INTO rosters (employee_id, shift_date, shift_id, location_id) VALUES ${part.map(() => '(?,?,?,?)').join(',')}`,
        part.flatMap((r) => [r.employeeId, r.shiftDate, r.shiftId, r.locationId]),
      );
    }
  },
  async list({ from, to, employeeId }) {
    const where = employeeId === undefined ? '' : ' AND r.employee_id = ?';
    const params: (string | number)[] = [from, to];
    if (employeeId !== undefined) params.push(employeeId);
    const [rows] = await dbOf().execute<ListRow[]>(
      `SELECT r.id, r.employee_id AS employeeId, e.nama AS employeeNama,
              DATE_FORMAT(r.shift_date, '%Y-%m-%d') AS shiftDate,
              r.shift_id AS shiftId, s.nama AS shiftNama,
              TIME_FORMAT(s.jam_mulai, '%H:%i') AS jamMulai, TIME_FORMAT(s.jam_selesai, '%H:%i') AS jamSelesai,
              s.lintas_hari AS lintasHari, r.location_id AS locationId, l.nama AS locationNama
       FROM rosters r
       JOIN employees e ON e.id = r.employee_id
       JOIN shifts s ON s.id = r.shift_id
       JOIN locations l ON l.id = r.location_id
       WHERE r.shift_date BETWEEN ? AND ?${where}
       ORDER BY r.shift_date, e.nama`,
      params,
    );
    return rows.map(
      (r): RosterListItem => ({
        id: r.id,
        employeeId: r.employeeId,
        employeeNama: r.employeeNama,
        shiftDate: r.shiftDate,
        shiftId: r.shiftId,
        shiftNama: r.shiftNama,
        jamMulai: r.jamMulai,
        jamSelesai: r.jamSelesai,
        lintasHari: r.lintasHari === 1,
        locationId: r.locationId,
        locationNama: r.locationNama,
      }),
    );
  },
};
