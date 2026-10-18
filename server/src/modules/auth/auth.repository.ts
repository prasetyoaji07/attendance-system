import type { RowDataPacket } from 'mysql2';
import { pool } from '../../core/db';
import type { Role } from '../../core/roles';
import type { AccountRecord, AuthRepository } from './auth.service';

interface AccountRow extends RowDataPacket {
  userId: number;
  employeeId: number;
  passwordHash: string;
  role: Role;
  nik: string;
  nama: string;
  aktif: number;
  departmentId: number;
  departmentNama: string;
  atasanId: number | null;
}

const SELECT_ACCOUNT = `
  SELECT u.id AS userId, u.employee_id AS employeeId, u.password_hash AS passwordHash, u.role,
         e.nik, e.nama, e.aktif, e.department_id AS departmentId, d.nama AS departmentNama, e.atasan_id AS atasanId
  FROM users u
  JOIN employees e ON e.id = u.employee_id
  JOIN departments d ON d.id = e.department_id`;

const toRecord = (r: AccountRow): AccountRecord => ({ ...r, aktif: r.aktif === 1 });

export const authRepository: AuthRepository = {
  async findByNik(nik) {
    const [rows] = await pool.execute<AccountRow[]>(`${SELECT_ACCOUNT} WHERE e.nik = ? LIMIT 1`, [nik]);
    return rows[0] ? toRecord(rows[0]) : null;
  },
  async findByUserId(userId) {
    const [rows] = await pool.execute<AccountRow[]>(`${SELECT_ACCOUNT} WHERE u.id = ? LIMIT 1`, [userId]);
    return rows[0] ? toRecord(rows[0]) : null;
  },
};
