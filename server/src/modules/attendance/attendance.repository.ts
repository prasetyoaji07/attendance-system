import type { ResultSetHeader, RowDataPacket } from 'mysql2';
import { dbOf } from '../../core/db-helpers';
import type { AttendanceRepository, RosterCandidate } from './attendance.service';

// DECIMAL dikembalikan mysql2 sebagai string, jadi lat/lng diubah ke number di sini.
interface CandidateRow extends RowDataPacket {
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
  checkInAt: Date | null;
}

const placeholders = (n: number) => Array.from({ length: n }, () => '?').join(',');

export const attendanceRepository: AttendanceRepository = {
  async findCandidates(employeeId, shiftDates) {
    if (shiftDates.length === 0) return [];
    const [rows] = await dbOf().execute<CandidateRow[]>(
      `SELECT r.id AS rosterId, DATE_FORMAT(r.shift_date, '%Y-%m-%d') AS shiftDate,
              s.nama AS shiftNama, TIME_FORMAT(s.jam_mulai, '%H:%i') AS jamMulai, TIME_FORMAT(s.jam_selesai, '%H:%i') AS jamSelesai,
              s.toleransi_menit AS toleransi,
              l.id AS locationId, l.nama AS locationNama, l.lat AS lat, l.lng AS lng, l.radius_m AS radiusM,
              a.check_in_at AS checkInAt
       FROM rosters r
       JOIN shifts s ON s.id = r.shift_id
       JOIN locations l ON l.id = r.location_id
       LEFT JOIN attendance a ON a.roster_id = r.id
       WHERE r.employee_id = ? AND r.shift_date IN (${placeholders(shiftDates.length)})`,
      [employeeId, ...shiftDates],
    );
    return rows.map(
      (r): RosterCandidate => ({
        rosterId: Number(r.rosterId),
        shiftDate: r.shiftDate,
        shiftNama: r.shiftNama,
        shift: { startTime: r.jamMulai, endTime: r.jamSelesai, lateToleranceMinutes: Number(r.toleransi) },
        location: { id: Number(r.locationId), nama: r.locationNama, lat: Number(r.lat), lng: Number(r.lng), radiusM: Number(r.radiusM) },
        checkInAt: r.checkInAt ? new Date(r.checkInAt) : null,
      }),
    );
  },

  async insertCheckIn(d, tx) {
    const [res] = await dbOf(tx).execute<ResultSetHeader>(
      `INSERT INTO attendance (roster_id, check_in_at, lat_in, lng_in, distance_m, accuracy_m, late_minutes, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [d.rosterId, d.checkInAt, d.lat, d.lng, d.distanceM, d.accuracyM, d.lateMinutes, d.status],
    );
    return res.insertId;
  },
};
