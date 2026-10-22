import type { ResultSetHeader, RowDataPacket } from 'mysql2';
import { dbOf } from '../../core/db-helpers';
import type { ReviewStatus } from '../../core/risk-flags';
import type { AttendanceStatus } from '../../core/roles';
import type { ReviewQueueRow, ReviewRepository, ReviewSelfieRef } from './review.service';

interface QueueRow extends RowDataPacket {
  attendanceId: number;
  nik: string;
  nama: string;
  shiftDate: string;
  shiftNama: string;
  locationNama: string;
  checkInAt: Date | null;
  checkOutAt: Date | null;
  checkInMethod: string;
  checkOutMethod: string | null;
  riskFlags: string | null;
  status: AttendanceStatus;
  lateMinutes: number;
}

interface SelfieRow extends RowDataPacket {
  id: number;
  attendanceId: number;
  jenis: 'IN' | 'OUT';
  capturedAt: Date;
}

interface StateRow extends RowDataPacket {
  reviewStatus: ReviewStatus;
  employeeId: number;
}

interface SelfieDetailRow extends RowDataPacket {
  id: number;
  attendanceId: number;
  jenis: 'IN' | 'OUT';
  fileRef: string;
  expiresAt: Date;
}

export const reviewRepository: ReviewRepository = {
  async listPending() {
    const [rows] = await dbOf().execute<QueueRow[]>(
      `SELECT a.id AS attendanceId, e.nik AS nik, e.nama AS nama,
              DATE_FORMAT(r.shift_date, '%Y-%m-%d') AS shiftDate, s.nama AS shiftNama, l.nama AS locationNama,
              a.check_in_at AS checkInAt, a.check_out_at AS checkOutAt,
              a.check_in_method AS checkInMethod, a.check_out_method AS checkOutMethod,
              a.risk_flags AS riskFlags, a.status AS status, a.late_minutes AS lateMinutes
         FROM attendance a
         JOIN rosters r ON r.id = a.roster_id
         JOIN employees e ON e.id = r.employee_id
         JOIN shifts s ON s.id = r.shift_id
         JOIN locations l ON l.id = r.location_id
        WHERE a.review_status = 'PENDING'
        ORDER BY a.check_in_at ASC
        LIMIT 100`,
    );
    if (rows.length === 0) return [];

    const ids = rows.map((r) => Number(r.attendanceId));
    const marks = ids.map(() => '?').join(',');
    const [selfieRows] = await dbOf().execute<SelfieRow[]>(
      `SELECT id, attendance_id AS attendanceId, jenis, captured_at AS capturedAt
         FROM attendance_selfies
        WHERE attendance_id IN (${marks})
        ORDER BY id`,
      ids,
    );
    const byAttendance = new Map<number, ReviewSelfieRef[]>();
    for (const s of selfieRows) {
      const list = byAttendance.get(Number(s.attendanceId)) ?? [];
      list.push({ id: Number(s.id), jenis: s.jenis, capturedAt: new Date(s.capturedAt) });
      byAttendance.set(Number(s.attendanceId), list);
    }

    return rows.map(
      (r): ReviewQueueRow => ({
        attendanceId: Number(r.attendanceId),
        nik: r.nik,
        nama: r.nama,
        shiftDate: r.shiftDate,
        shiftNama: r.shiftNama,
        locationNama: r.locationNama,
        checkInAt: r.checkInAt ? new Date(r.checkInAt) : null,
        checkOutAt: r.checkOutAt ? new Date(r.checkOutAt) : null,
        checkInMethod: r.checkInMethod,
        checkOutMethod: r.checkOutMethod,
        riskFlags: r.riskFlags,
        status: r.status,
        lateMinutes: Number(r.lateMinutes),
        selfies: byAttendance.get(Number(r.attendanceId)) ?? [],
      }),
    );
  },

  async findReviewState(attendanceId) {
    const [rows] = await dbOf().execute<StateRow[]>(
      `SELECT a.review_status AS reviewStatus, r.employee_id AS employeeId
         FROM attendance a
         JOIN rosters r ON r.id = a.roster_id
        WHERE a.id = ?`,
      [attendanceId],
    );
    const r = rows[0];
    if (!r) return null;
    return { reviewStatus: r.reviewStatus, employeeId: Number(r.employeeId) };
  },

  async markReviewed(d, tx) {
    const [res] = await dbOf(tx).execute<ResultSetHeader>(
      `UPDATE attendance
          SET review_status = ?, reviewed_by = ?, reviewed_at = ?
        WHERE id = ? AND review_status = 'PENDING'`,
      [d.decision, d.reviewerUserId, d.reviewedAt, d.attendanceId],
    );
    return res.affectedRows === 1;
  },

  async findSelfie(selfieId) {
    const [rows] = await dbOf().execute<SelfieDetailRow[]>(
      `SELECT id, attendance_id AS attendanceId, jenis, file_ref AS fileRef, expires_at AS expiresAt
         FROM attendance_selfies
        WHERE id = ?`,
      [selfieId],
    );
    const r = rows[0];
    if (!r) return null;
    return {
      id: Number(r.id),
      attendanceId: Number(r.attendanceId),
      jenis: r.jenis,
      fileRef: r.fileRef,
      expiresAt: new Date(r.expiresAt),
    };
  },
};
