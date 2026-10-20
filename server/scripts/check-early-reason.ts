/**
 * Bukti di database: tampilkan 5 check-out terbaru beserta early_leave_reason. HANYA MEMBACA (SELECT).
 *
 * Jalankan dari folder `server`:
 *   npx tsx scripts/check-early-reason.ts
 *
 * Memakai pool server (membaca server/.env lewat config, sama seperti server). Koordinat tidak ditampilkan.
 */
import type { RowDataPacket } from 'mysql2';
import { pool } from '../src/core/db';

async function main() {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT a.id AS attendance_id, r.employee_id, DATE_FORMAT(r.shift_date, '%Y-%m-%d') AS shift_date,
            a.check_in_at, a.check_out_at, a.early_leave_minutes, a.early_leave_reason, a.status
       FROM attendance a
       JOIN rosters r ON r.id = a.roster_id
      WHERE a.check_out_at IS NOT NULL
      ORDER BY a.check_out_at DESC
      LIMIT 5`,
  );
  console.table(
    rows.map((r) => ({
      attendance_id: r.attendance_id,
      employee_id: r.employee_id,
      shift_date: r.shift_date,
      check_in_utc: new Date(r.check_in_at).toISOString(),
      check_out_utc: new Date(r.check_out_at).toISOString(),
      early_min: r.early_leave_minutes,
      early_reason: r.early_leave_reason,
      status: r.status,
    })),
  );
}

main()
  .catch((err) => {
    console.error('Skrip gagal:', err);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
