import type { ResultSetHeader, RowDataPacket } from 'mysql2';
import { dbOf } from '../../core/db-helpers';
import type { DeviceRecord, DeviceStatus } from '../../utils/device-binding';
import type { DevicesRepository, PendingDevice } from './devices.service';

interface DeviceRow extends RowDataPacket {
  id: number;
  userId: number;
  deviceId: string;
  status: DeviceStatus;
}

interface PendingRow extends RowDataPacket {
  id: number;
  userId: number;
  nik: string;
  nama: string;
  departmentNama: string;
  requestedEpoch: string | number;
}

const SELECT = 'SELECT id, user_id AS userId, device_id AS deviceId, status FROM devices';

const toRecord = (r: DeviceRow): DeviceRecord => ({
  id: Number(r.id),
  userId: Number(r.userId),
  deviceId: r.deviceId,
  status: r.status,
});

export const devicesRepository: DevicesRepository = {
  async findByUser(userId, tx) {
    const [rows] = await dbOf(tx).execute<DeviceRow[]>(`${SELECT} WHERE user_id = ? ORDER BY id`, [userId]);
    return rows.map(toRecord);
  },
  async findById(id, tx) {
    const [rows] = await dbOf(tx).execute<DeviceRow[]>(`${SELECT} WHERE id = ? LIMIT 1`, [id]);
    return rows[0] ? toRecord(rows[0]) : null;
  },
  async insert(userId, deviceId, status, tx) {
    const [res] = await dbOf(tx).execute<ResultSetHeader>(
      'INSERT INTO devices (user_id, device_id, status) VALUES (?, ?, ?)',
      [userId, deviceId, status],
    );
    return res.insertId;
  },
  async remove(ids, tx) {
    if (ids.length === 0) return;
    await dbOf(tx).execute(`DELETE FROM devices WHERE id IN (${ids.map(() => '?').join(',')})`, ids);
  },
  async activate(id, tx) {
    await dbOf(tx).execute("UPDATE devices SET status = 'active' WHERE id = ?", [id]);
  },
  async listPending() {
    // UNIX_TIMESTAMP(TIMESTAMP) tidak bergantung pada zona waktu sesi, jadi aman dikonversi ke ISO UTC di sini.
    const [rows] = await dbOf().execute<PendingRow[]>(
      `SELECT d.id AS id, d.user_id AS userId, e.nik AS nik, e.nama AS nama, dep.nama AS departmentNama,
              UNIX_TIMESTAMP(d.created_at) AS requestedEpoch
       FROM devices d
       JOIN users u ON u.id = d.user_id
       JOIN employees e ON e.id = u.employee_id
       JOIN departments dep ON dep.id = e.department_id
       WHERE d.status = 'pending'
       ORDER BY d.created_at, d.id`,
    );
    return rows.map(
      (r): PendingDevice => ({
        id: Number(r.id),
        userId: Number(r.userId),
        nik: r.nik,
        nama: r.nama,
        departmentNama: r.departmentNama,
        requestedAt: new Date(Number(r.requestedEpoch) * 1000).toISOString(),
      }),
    );
  },
};
