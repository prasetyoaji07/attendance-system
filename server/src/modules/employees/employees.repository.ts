import type { ResultSetHeader, RowDataPacket } from 'mysql2';
import { dbOf } from '../../core/db-helpers';
import type { Role } from '../../core/roles';
import type { DepartmentRecord, EmployeeRecord, EmployeesRepository } from './employees.service';

interface EmployeeRow extends RowDataPacket {
  id: number;
  nik: string;
  nama: string;
  departmentId: number;
  departmentNama: string;
  atasanId: number | null;
  atasanNama: string | null;
  tanggalMasuk: string;
  aktif: number;
  userId: number | null;
  role: Role | null;
}

// tanggal_masuk diformat di SQL agar tidak ikut bergeser oleh konversi zona waktu Date JS.
const SELECT_EMPLOYEE = `
  SELECT e.id, e.nik, e.nama, e.department_id AS departmentId, d.nama AS departmentNama,
         e.atasan_id AS atasanId, a.nama AS atasanNama,
         DATE_FORMAT(e.tanggal_masuk, '%Y-%m-%d') AS tanggalMasuk, e.aktif,
         u.id AS userId, u.role AS role`;
const FROM_EMPLOYEE = `
  FROM employees e
  JOIN departments d ON d.id = e.department_id
  LEFT JOIN employees a ON a.id = e.atasan_id
  LEFT JOIN users u ON u.employee_id = e.id`;

const toRecord = (r: EmployeeRow): EmployeeRecord => ({ ...r, aktif: r.aktif === 1 });

/** Escape karakter wildcard LIKE agar pencarian "50%" tidak jadi pola. */
const escapeLike = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

interface DepartmentRow extends RowDataPacket {
  id: number;
  nama: string;
  kepalaId: number | null;
  kepalaNama: string | null;
}
const SELECT_DEPARTMENT = `SELECT d.id, d.nama, d.kepala_id AS kepalaId, k.nama AS kepalaNama
  FROM departments d LEFT JOIN employees k ON k.id = d.kepala_id`;

export const employeesRepository: EmployeesRepository = {
  async list(f) {
    const where: string[] = [];
    const params: (string | number)[] = [];

    if (f.scope.kind === 'department') {
      where.push('e.department_id = ?');
      params.push(f.scope.departmentId);
    } else if (f.scope.kind === 'team') {
      where.push('e.atasan_id = ?');
      params.push(f.scope.atasanId);
    }
    if (f.departmentId !== undefined) {
      where.push('e.department_id = ?');
      params.push(f.departmentId);
    }
    if (f.aktif !== undefined) {
      where.push('e.aktif = ?');
      params.push(f.aktif ? 1 : 0);
    }
    if (f.q) {
      where.push('(e.nama LIKE ? OR e.nik LIKE ?)');
      const like = `%${escapeLike(f.q)}%`;
      params.push(like, like);
    }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    // LIMIT/OFFSET di-inline: nilainya integer hasil validasi zod, dan placeholder `?` pada
    // LIMIT sering bermasalah di prepared statement MySQL/TiDB.
    const limit = Math.trunc(f.limit);
    const offset = Math.trunc((f.page - 1) * f.limit);

    const db = dbOf();
    const [rows] = await db.execute<EmployeeRow[]>(
      `${SELECT_EMPLOYEE} ${FROM_EMPLOYEE} ${whereSql} ORDER BY e.nama, e.id LIMIT ${limit} OFFSET ${offset}`,
      params,
    );
    const [count] = await db.execute<(RowDataPacket & { total: number })[]>(
      `SELECT COUNT(*) AS total ${FROM_EMPLOYEE} ${whereSql}`,
      params,
    );
    return { rows: rows.map(toRecord), total: Number(count[0].total) };
  },

  async findById(id, tx) {
    const [rows] = await dbOf(tx).execute<EmployeeRow[]>(`${SELECT_EMPLOYEE} ${FROM_EMPLOYEE} WHERE e.id = ? LIMIT 1`, [id]);
    return rows[0] ? toRecord(rows[0]) : null;
  },

  async insertEmployee(d, tx) {
    const [res] = await dbOf(tx).execute<ResultSetHeader>(
      'INSERT INTO employees (nik, nama, department_id, atasan_id, tanggal_masuk) VALUES (?, ?, ?, ?, ?)',
      [d.nik, d.nama, d.departmentId, d.atasanId, d.tanggalMasuk],
    );
    return res.insertId;
  },

  async insertUser(employeeId, passwordHash, role, tx) {
    await dbOf(tx).execute('INSERT INTO users (employee_id, password_hash, role) VALUES (?, ?, ?)', [
      employeeId,
      passwordHash,
      role,
    ]);
  },

  async updateEmployee(id, fields, tx) {
    const columns: Record<string, string> = {
      nama: 'nama',
      departmentId: 'department_id',
      atasanId: 'atasan_id',
      tanggalMasuk: 'tanggal_masuk',
    };
    const sets: string[] = [];
    const params: (string | number | null)[] = [];
    for (const [key, col] of Object.entries(columns)) {
      const value = (fields as Record<string, string | number | null | undefined>)[key];
      if (value === undefined) continue; // null tetap diproses (mengosongkan atasan)
      sets.push(`${col} = ?`);
      params.push(value);
    }
    if (sets.length === 0) return;
    params.push(id);
    await dbOf(tx).execute(`UPDATE employees SET ${sets.join(', ')} WHERE id = ?`, params);
  },

  async updateUserRole(employeeId, role, tx) {
    await dbOf(tx).execute('UPDATE users SET role = ? WHERE employee_id = ?', [role, employeeId]);
  },

  async setAktif(id, aktif, tx) {
    await dbOf(tx).execute('UPDATE employees SET aktif = ? WHERE id = ?', [aktif ? 1 : 0, id]);
  },

  async updatePassword(employeeId, passwordHash, tx) {
    await dbOf(tx).execute('UPDATE users SET password_hash = ? WHERE employee_id = ?', [passwordHash, employeeId]);
  },

  async listDepartments() {
    const [rows] = await dbOf().execute<DepartmentRow[]>(`${SELECT_DEPARTMENT} ORDER BY d.nama`);
    return rows as DepartmentRecord[];
  },

  async findDepartment(id, tx) {
    const [rows] = await dbOf(tx).execute<DepartmentRow[]>(`${SELECT_DEPARTMENT} WHERE d.id = ? LIMIT 1`, [id]);
    return rows[0] ? (rows[0] as DepartmentRecord) : null;
  },

  async insertDepartment(d, tx) {
    const [res] = await dbOf(tx).execute<ResultSetHeader>('INSERT INTO departments (nama, kepala_id) VALUES (?, ?)', [
      d.nama,
      d.kepalaId,
    ]);
    return res.insertId;
  },

  async updateDepartment(id, d, tx) {
    await dbOf(tx).execute('UPDATE departments SET nama = ?, kepala_id = ? WHERE id = ?', [d.nama, d.kepalaId, id]);
  },
};
