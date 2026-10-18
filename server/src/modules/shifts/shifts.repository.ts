import type { ResultSetHeader, RowDataPacket } from 'mysql2';
import { dbOf } from '../../core/db-helpers';
import type { ShiftRecord, ShiftsRepository } from './shifts.service';

interface ShiftRow extends RowDataPacket {
  id: number;
  nama: string;
  jamMulai: string;
  jamSelesai: string;
  lintasHari: number;
  toleransiMenit: number;
}

const SELECT = `SELECT id, nama, TIME_FORMAT(jam_mulai, '%H:%i') AS jamMulai, TIME_FORMAT(jam_selesai, '%H:%i') AS jamSelesai,
  lintas_hari AS lintasHari, toleransi_menit AS toleransiMenit FROM shifts`;

const toRecord = (r: ShiftRow): ShiftRecord => ({
  id: r.id,
  nama: r.nama,
  jamMulai: r.jamMulai,
  jamSelesai: r.jamSelesai,
  lintasHari: r.lintasHari === 1,
  toleransiMenit: r.toleransiMenit,
});

export const shiftsRepository: ShiftsRepository = {
  async findAll() {
    const [rows] = await dbOf().execute<ShiftRow[]>(`${SELECT} ORDER BY jam_mulai, nama`);
    return rows.map(toRecord);
  },
  async findById(id, tx) {
    const [rows] = await dbOf(tx).execute<ShiftRow[]>(`${SELECT} WHERE id = ? LIMIT 1`, [id]);
    return rows[0] ? toRecord(rows[0]) : null;
  },
  async insert(d, tx) {
    const [res] = await dbOf(tx).execute<ResultSetHeader>(
      'INSERT INTO shifts (nama, jam_mulai, jam_selesai, lintas_hari, toleransi_menit) VALUES (?, ?, ?, ?, ?)',
      [d.nama, d.jamMulai, d.jamSelesai, d.lintasHari ? 1 : 0, d.toleransiMenit],
    );
    return res.insertId;
  },
  async update(id, d, tx) {
    await dbOf(tx).execute(
      'UPDATE shifts SET nama = ?, jam_mulai = ?, jam_selesai = ?, lintas_hari = ?, toleransi_menit = ? WHERE id = ?',
      [d.nama, d.jamMulai, d.jamSelesai, d.lintasHari ? 1 : 0, d.toleransiMenit, id],
    );
  },
  async remove(id, tx) {
    await dbOf(tx).execute('DELETE FROM shifts WHERE id = ?', [id]);
  },
  async countRosters(id) {
    const [rows] = await dbOf().execute<(RowDataPacket & { n: number })[]>(
      'SELECT COUNT(*) AS n FROM rosters WHERE shift_id = ?',
      [id],
    );
    return Number(rows[0].n);
  },
};
