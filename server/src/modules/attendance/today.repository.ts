import type { RowDataPacket } from 'mysql2';
import { dbOf } from '../../core/db-helpers';
import type { AttendanceStatus } from '../../core/roles';
import type { TodayCandidate } from '../../utils/today-state';
import type { TodayRepository } from './today.service';

// DECIMAL dikembalikan mysql2 sebagai string, jadi lat/lng diubah ke number di sini.
// Kolom a.* bernilai NULL jika roster belum punya baris attendance (LEFT JOIN).
interface TodayRow extends RowDataPacket {
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
  alamat: string | null;
  attendanceId: number | null;
  checkInAt: Date | null;
  checkOutAt: Date | null;
  attStatus: string | null;
  lateMinutes: number | null;
  earlyLeaveMinutes: number | null;
  autoClosed: number | null;
  needsCorrection: number | null;
}

const placeholders = (n: number) => Array.from({ length: n }, () => '?').join(',');

export const todayRepository: TodayRepository = {
  async findTodayCandidates(employeeId, shiftDates) {
    if (shiftDates.length === 0) return [];
    const [rows] = await dbOf().execute<TodayRow[]>(
      `SELECT r.id AS rosterId, DATE_FORMAT(r.shift_date, '%Y-%m-%d') AS shiftDate,
              s.nama AS shiftNama, TIME_FORMAT(s.jam_mulai, '%H:%i') AS jamMulai, TIME_FORMAT(s.jam_selesai, '%H:%i') AS jamSelesai,
              s.toleransi_menit AS toleransi,
              l.id AS locationId, l.nama AS locationNama, l.lat AS lat, l.lng AS lng, l.radius_m AS radiusM, l.alamat AS alamat,
              a.id AS attendanceId, a.check_in_at AS checkInAt, a.check_out_at AS checkOutAt, a.status AS attStatus,
              a.late_minutes AS lateMinutes, a.early_leave_minutes AS earlyLeaveMinutes,
              a.auto_closed AS autoClosed, a.needs_correction AS needsCorrection
       FROM rosters r
       JOIN shifts s ON s.id = r.shift_id
       JOIN locations l ON l.id = r.location_id
       LEFT JOIN attendance a ON a.roster_id = r.id
       WHERE r.employee_id = ? AND r.shift_date IN (${placeholders(shiftDates.length)})`,
      [employeeId, ...shiftDates],
    );
    return rows.map(
      (r): TodayCandidate => ({
        rosterId: Number(r.rosterId),
        shiftDate: r.shiftDate,
        shiftNama: r.shiftNama,
        shift: { startTime: r.jamMulai, endTime: r.jamSelesai, lateToleranceMinutes: Number(r.toleransi) },
        location: {
          id: Number(r.locationId),
          nama: r.locationNama,
          lat: Number(r.lat),
          lng: Number(r.lng),
          radiusM: Number(r.radiusM),
          alamat: r.alamat ?? null,
        },
        attendance:
          r.attendanceId === null
            ? null
            : {
                attendanceId: Number(r.attendanceId),
                checkInAt: r.checkInAt ? new Date(r.checkInAt) : null,
                checkOutAt: r.checkOutAt ? new Date(r.checkOutAt) : null,
                status: r.attStatus as AttendanceStatus | null,
                lateMinutes: Number(r.lateMinutes ?? 0),
                earlyLeaveMinutes: Number(r.earlyLeaveMinutes ?? 0),
                autoClosed: Number(r.autoClosed ?? 0) === 1,
                needsCorrection: Number(r.needsCorrection ?? 0) === 1,
              },
      }),
    );
  },
};
