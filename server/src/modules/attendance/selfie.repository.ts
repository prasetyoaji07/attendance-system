import type { ResultSetHeader, RowDataPacket } from 'mysql2';
import { dbOf } from '../../core/db-helpers';
import type { NewSelfie } from './selfie';
import type { ExpiredSelfie, SelfiePurgeRepository } from './selfie-purge.service';

export type SelfieKind = 'IN' | 'OUT';

/** Tulis metadata selfie. Dipanggil di dalam transaksi yang sama dengan insert/update absen. */
export async function insertSelfie(attendanceId: number, jenis: SelfieKind, s: NewSelfie, tx?: unknown): Promise<void> {
  await dbOf(tx).execute<ResultSetHeader>(
    `INSERT INTO attendance_selfies (attendance_id, jenis, file_ref, captured_at, expires_at)
     VALUES (?, ?, ?, ?, ?)`,
    [attendanceId, jenis, s.fileRef, s.capturedAt, s.expiresAt],
  );
}

interface ExpiredRow extends RowDataPacket {
  id: number;
  fileRef: string;
}

export const selfiePurgeRepository: SelfiePurgeRepository = {
  async findExpired(now) {
    const [rows] = await dbOf().execute<ExpiredRow[]>(
      `SELECT id, file_ref AS fileRef FROM attendance_selfies
        WHERE expires_at <= ?
        ORDER BY id
        LIMIT 500`,
      [now],
    );
    return rows.map((r): ExpiredSelfie => ({ id: Number(r.id), fileRef: r.fileRef }));
  },

  async deleteByIds(ids) {
    if (ids.length === 0) return;
    const marks = ids.map(() => '?').join(',');
    await dbOf().execute<ResultSetHeader>(`DELETE FROM attendance_selfies WHERE id IN (${marks})`, ids);
  },
};
