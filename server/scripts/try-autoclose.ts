/**
 * Uji NYATA penutupan otomatis terhadap TiDB asli, tanpa menunggu cron.
 * Jalankan dari folder server:
 *   npx tsx scripts/try-autoclose.ts                                  (cek SEKARANG, hanya melihat, tidak menulis)
 *   npx tsx scripts/try-autoclose.ts --at=2026-10-19T09:00:00+07:00   (pura-pura sekarang = jam itu, hanya melihat)
 *   npx tsx scripts/try-autoclose.ts --at=2026-10-19T09:00:00+07:00 --apply   (benar-benar menutup)
 * Tanpa --apply skrip ini TIDAK mengubah database. Dengan --apply, baris yang lewat batas ditandai
 * auto_closed=1 dan needs_correction=1, dan tercatat di audit_logs.
 * Semua data adalah simulasi.
 */
import type { RowDataPacket } from 'mysql2';
import { pool } from '../src/core/db';
import { autoCloseService } from '../src/jobs/auto-close';

function arg(name: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : undefined;
}

interface InfoRow extends RowDataPacket {
  attendanceId: number;
  nik: string;
  nama: string;
  shiftDate: string;
  shiftNama: string;
  checkInAt: Date;
}

async function describe(ids: number[]) {
  if (ids.length === 0) return;
  const [rows] = await pool.execute<InfoRow[]>(
    `SELECT a.id AS attendanceId, e.nik AS nik, e.nama AS nama, DATE_FORMAT(r.shift_date, '%Y-%m-%d') AS shiftDate,
            s.nama AS shiftNama, a.check_in_at AS checkInAt
     FROM attendance a
     JOIN rosters r ON r.id = a.roster_id
     JOIN employees e ON e.id = r.employee_id
     JOIN shifts s ON s.id = r.shift_id
     WHERE a.id IN (${ids.map(() => '?').join(',')})
     ORDER BY a.id`,
    ids,
  );
  for (const r of rows) {
    console.log(`  - absen ${r.attendanceId}: ${r.nik} ${r.nama}, shift ${r.shiftNama} ${r.shiftDate}, check-in ${new Date(r.checkInAt).toISOString()}`);
  }
}

async function main() {
  const atArg = arg('at');
  const at = atArg ? new Date(atArg) : new Date();
  if (Number.isNaN(at.getTime())) {
    console.error(`--at tidak valid: "${atArg}". Contoh: --at=2026-10-19T09:00:00+07:00`);
    process.exit(1);
  }
  const apply = process.argv.includes('--apply');
  console.log(`Waktu acuan: ${at.toISOString()} (${apply ? 'MENULIS ke database' : 'hanya melihat'})`);

  if (!apply) {
    const p = await autoCloseService.preview(at);
    console.log(`Absen terbuka: ${p.checked}. Yang sudah lewat batas dan AKAN ditutup: ${p.due.length}`);
    await describe(p.due);
    return;
  }
  const r = await autoCloseService.run(at);
  console.log(`Absen terbuka: ${r.checked}. Lewat batas: ${r.due}. Ditutup: ${r.closed.length}. Gagal: ${r.failed.length}`);
  await describe(r.closed);
  if (r.failed.length > 0) console.log(`  Gagal: ${r.failed.join(', ')}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
