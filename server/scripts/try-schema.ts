/**
 * Bukti struktur migrasi 005-011 (HANYA MEMBACA, tidak mengubah data).
 * Jalankan dari folder server:
 *   npx tsx scripts/try-schema.ts
 */
import { pool } from '../src/core/db';

type Row = Record<string, unknown>;

async function kolom(tabel: string, daftar?: string[]) {
  const [rows] = await pool.query(
    `SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT
       FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?
      ORDER BY ORDINAL_POSITION`,
    [tabel],
  );
  const semua = rows as Row[];
  console.log(`\n== Kolom tabel ${tabel} (${semua.length} kolom ditemukan) ==`);
  if (semua.length === 0) {
    console.log('(tabel tidak ditemukan)');
    return;
  }
  const ditampilkan = daftar ? semua.filter((r) => daftar.includes(String(r.COLUMN_NAME))) : semua;
  for (const r of ditampilkan) {
    console.log(
      `${r.COLUMN_NAME} | ${r.COLUMN_TYPE} | boleh NULL: ${r.IS_NULLABLE} | default: ${r.COLUMN_DEFAULT === null ? 'NULL' : r.COLUMN_DEFAULT}`,
    );
  }
  if (daftar) {
    const ada = new Set(semua.map((r) => String(r.COLUMN_NAME)));
    const hilang = daftar.filter((d) => !ada.has(d));
    console.log(hilang.length ? `HILANG: ${hilang.join(', ')}` : 'Semua kolom yang dicari ADA.');
  }
}

async function constraint(tabel: string) {
  const [rows] = await pool.query(
    `SELECT tc.CONSTRAINT_NAME, tc.CONSTRAINT_TYPE,
            GROUP_CONCAT(kcu.COLUMN_NAME ORDER BY kcu.ORDINAL_POSITION) AS KOLOM,
            MAX(kcu.REFERENCED_TABLE_NAME) AS REF_TABEL
       FROM information_schema.TABLE_CONSTRAINTS tc
       JOIN information_schema.KEY_COLUMN_USAGE kcu
         ON kcu.CONSTRAINT_SCHEMA = tc.CONSTRAINT_SCHEMA
        AND kcu.CONSTRAINT_NAME = tc.CONSTRAINT_NAME
        AND kcu.TABLE_NAME = tc.TABLE_NAME
      WHERE tc.TABLE_SCHEMA = DATABASE() AND tc.TABLE_NAME = ?
      GROUP BY tc.CONSTRAINT_NAME, tc.CONSTRAINT_TYPE`,
    [tabel],
  );
  const semua = rows as Row[];
  console.log(`\n== Constraint tabel ${tabel} (${semua.length} ditemukan) ==`);
  for (const r of semua) {
    console.log(
      `${r.CONSTRAINT_NAME} | ${r.CONSTRAINT_TYPE} | kolom: ${r.KOLOM}${r.REF_TABEL ? ` -> ${r.REF_TABEL}` : ''}`,
    );
  }
}

async function main() {
  await kolom('attendance', [
    'check_in_method',
    'check_out_method',
    'review_status',
    'risk_flags',
    'reviewed_by',
    'reviewed_at',
  ]);
  await kolom('attendance_selfies');
  await constraint('attendance_selfies');
}

main()
  .catch((err) => {
    console.error('Gagal membaca struktur:', err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => pool.end());