import type { ResultSetHeader, RowDataPacket } from 'mysql2';
import { dbOf } from '../../core/db-helpers';
import type { OpenAttendanceRow } from '../../utils/auto-close';
import type { AutoCloseRepository } from './auto-close.service';
import type { AttendanceRecord, CheckOutRepository } from './checkout.service';

// DECIMAL dikembalikan mysql2 sebagai string, jadi lat/lng diubah ke number di sini.
interface LatestRow extends RowDataPacket {
  attendanceId: number;
  rosterId: number;
  shiftDate: string;
  shiftNama: string;
  jamMulai: string;
  jamSelesai: string;
  toleransi: number;
  locationId: number;
  locationNama: string;
  lat: string;
  lng: string;
  radiusM: number;
  checkInAt: Date;
  checkOutAt: Date | null;
  autoClosed: number;
}

export const checkOutRepository: CheckOutRepository = {
  async findLatestAttendance(employeeId) {
    const [rows] = await dbOf().execute<LatestRow[]>(
      `SELECT a.id AS attendanceId, a.roster_id AS rosterId, DATE_FORMAT(r.shift_date, '%Y-%m-%d') AS shiftDate,
              s.nama AS shiftNama, TIME_FORMAT(s.jam_mulai, '%H:%i') AS jamMulai, TIME_FORMAT(s.jam_selesai, '%H:%i') AS jamSelesai,
              s.toleransi_menit AS toleransi,
              l.id AS locationId, l.nama AS locationNama, l.lat AS lat, l.lng AS lng, l.radius_m AS radiusM,
              a.check_in_at AS checkInAt, a.check_out_at AS checkOutAt, a.auto_closed AS autoClosed
       FROM attendance a
       JOIN rosters r ON r.id = a.roster_id
       JOIN shifts s ON s.id = r.shift_id
       JOIN locations l ON l.id = r.location_id
       WHERE r.employee_id = ? AND a.check_in_at IS NOT NULL
       ORDER BY a.check_in_at DESC
       LIMIT 1`,
      [employeeId],
    );
    const r = rows[0];
    if (!r) return null;
    const record: AttendanceRecord = {
      attendanceId: Number(r.attendanceId),
      rosterId: Number(r.rosterId),
      shiftDate: r.shiftDate,
      shiftNama: r.shiftNama,
      shift: { startTime: r.jamMulai, endTime: r.jamSelesai, lateToleranceMinutes: Number(r.toleransi) },
      location: { id: Number(r.locationId), nama: r.locationNama, lat: Number(r.lat), lng: Number(r.lng), radiusM: Number(r.radiusM) },
      checkInAt: new Date(r.checkInAt),
      checkOutAt: r.checkOutAt ? new Date(r.checkOutAt) : null,
      autoClosed: Number(r.autoClosed) === 1,
    };
    return record;
  },

  async updateCheckOut(d, tx) {
    // Syarat di WHERE membuat UPDATE ini aman dari dua request bersamaan dan dari auto-close yang menyalip.
    const [res] = await dbOf(tx).execute<ResultSetHeader>(
      `UPDATE attendance
          SET check_out_at = ?, lat_out = ?, lng_out = ?, early_leave_minutes = ?, status = ?
        WHERE id = ? AND check_out_at IS NULL AND auto_closed = 0`,
      [d.checkOutAt, d.lat, d.lng, d.earlyLeaveMinutes, d.status, d.attendanceId],
    );
    return res.affectedRows === 1;
  },
};

interface OpenRow extends RowDataPacket {
  attendanceId: number;
  shiftDate: string;
  jamMulai: string;
  jamSelesai: string;
  toleransi: number;
}

export const autoCloseRepository: AutoCloseRepository = {
  async findOpen() {
    const [rows] = await dbOf().execute<OpenRow[]>(
      `SELECT a.id AS attendanceId, DATE_FORMAT(r.shift_date, '%Y-%m-%d') AS shiftDate,
              TIME_FORMAT(s.jam_mulai, '%H:%i') AS jamMulai, TIME_FORMAT(s.jam_selesai, '%H:%i') AS jamSelesai,
              s.toleransi_menit AS toleransi
       FROM attendance a
       JOIN rosters r ON r.id = a.roster_id
       JOIN shifts s ON s.id = r.shift_id
       WHERE a.check_in_at IS NOT NULL AND a.check_out_at IS NULL AND a.auto_closed = 0`,
    );
    return rows.map(
      (r): OpenAttendanceRow => ({
        attendanceId: Number(r.attendanceId),
        shiftDate: r.shiftDate,
        shift: { startTime: r.jamMulai, endTime: r.jamSelesai, lateToleranceMinutes: Number(r.toleransi) },
      }),
    );
  },

  async markAutoClosed(attendanceId, tx) {
    const [res] = await dbOf(tx).execute<ResultSetHeader>(
      `UPDATE attendance SET auto_closed = 1, needs_correction = 1
        WHERE id = ? AND check_out_at IS NULL AND auto_closed = 0`,
      [attendanceId],
    );
    return res.affectedRows === 1;
  },
};
