/**
 * Lihat dan isi alamat lokasi kerja (dicetak di foto selfie). Langsung ke database; TIDAK masuk audit log.
 * Jalankan dari folder server:
 *   npx tsx scripts/set-lokasi-alamat.ts                         daftar lokasi dan alamatnya (hanya membaca)
 *   npx tsx scripts/set-lokasi-alamat.ts --id=1 "--alamat=Desa Pasirsari, Kec. Cikarang Selatan, Kab. Bekasi"
 *   npx tsx scripts/set-lokasi-alamat.ts --id=1 "--alamat="     mengosongkan alamat (NULL)
 */
import type { ResultSetHeader, RowDataPacket } from 'mysql2';
import { pool } from '../src/core/db';

const args = process.argv.slice(2);
const opt = (name: string) => args.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);

async function daftar() {
  const [rows] = await pool.execute<RowDataPacket[]>('SELECT id, nama, alamat FROM locations ORDER BY id');
  console.log(`\n== Lokasi (${rows.length}) ==`);
  for (const r of rows) console.log(`id ${r.id} | ${r.nama} | alamat: ${r.alamat ?? '(belum diisi)'}`);
}

async function main() {
  const idRaw = opt('id');
  const alamatRaw = opt('alamat');

  if (idRaw === undefined && alamatRaw === undefined) {
    await daftar();
    return;
  }
  const id = Number(idRaw);
  if (!Number.isInteger(id) || id <= 0 || alamatRaw === undefined) {
    console.log('Pakai: --id=ANGKA dan --alamat=TEKS (tulis "--alamat=..." dengan tanda kutip bila ada spasi).');
    process.exitCode = 1;
    return;
  }
  const alamat = alamatRaw.trim() === '' ? null : alamatRaw.trim();
  if (alamat !== null && alamat.length > 200) {
    console.log(`Alamat terlalu panjang (${alamat.length} karakter, maksimal 200).`);
    process.exitCode = 1;
    return;
  }

  const [found] = await pool.execute<RowDataPacket[]>('SELECT id, nama FROM locations WHERE id = ?', [id]);
  if (found.length === 0) {
    console.log(`Lokasi dengan id ${id} tidak ada. Jalankan tanpa argumen untuk melihat daftarnya.`);
    process.exitCode = 1;
    return;
  }
  const [res] = await pool.execute<ResultSetHeader>('UPDATE locations SET alamat = ? WHERE id = ?', [alamat, id]);
  console.log(`UPDATE langsung di DB: lokasi ${id} (${found[0].nama}) alamat = ${alamat ?? 'NULL'} (baris terkena: ${res.affectedRows}).`);
  await daftar();
}

main()
  .catch((err) => {
    console.error('Gagal:', err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
