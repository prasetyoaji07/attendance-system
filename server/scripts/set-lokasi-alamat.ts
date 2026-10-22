/**
 * Lihat dan ubah alamat serta koordinat lokasi kerja. Langsung ke database; TIDAK masuk audit log.
 * Jalankan dari folder server:
 *   npx tsx scripts/set-lokasi-alamat.ts                                          daftar lokasi (hanya membaca)
 *   npx tsx scripts/set-lokasi-alamat.ts --id=1 "--alamat=Desa Pasirsari, Kec. Cikarang Selatan, Kab. Bekasi"
 *   npx tsx scripts/set-lokasi-alamat.ts --id=1 "--alamat="                      mengosongkan alamat (NULL)
 *   npx tsx scripts/set-lokasi-alamat.ts --id=1 --lat=-6.317228 --lng=107.112445  memindahkan titik lokasi
 * --lat dan --lng harus diisi berdua. Boleh digabung dengan --alamat dalam satu perintah.
 * Setelah titik pindah, ubah juga Sensors DevTools di browser ke koordinat yang sama.
 */
import type { ResultSetHeader, RowDataPacket } from 'mysql2';
import { pool } from '../src/core/db';

const args = process.argv.slice(2);
const opt = (name: string) => args.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);

async function daftar() {
  const [rows] = await pool.execute<RowDataPacket[]>(
    'SELECT id, nama, lat, lng, radius_m AS radiusM, alamat FROM locations ORDER BY id',
  );
  console.log(`\n== Lokasi (${rows.length}) ==`);
  for (const r of rows) {
    console.log(
      `id ${r.id} | ${r.nama} | lat ${Number(r.lat)} | lng ${Number(r.lng)} | radius ${r.radiusM} m | alamat: ${r.alamat ?? '(belum diisi)'}`,
    );
  }
}

/** Ubah teks jadi angka; null bila kosong atau bukan angka. */
function toNumber(raw: string): number | null {
  if (raw.trim() === '') return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

async function main() {
  const idRaw = opt('id');
  const alamatRaw = opt('alamat');
  const latRaw = opt('lat');
  const lngRaw = opt('lng');

  if (idRaw === undefined && alamatRaw === undefined && latRaw === undefined && lngRaw === undefined) {
    await daftar();
    return;
  }

  const id = Number(idRaw);
  if (!Number.isInteger(id) || id <= 0) {
    console.log('Pakai: --id=ANGKA, lalu --alamat=TEKS dan/atau --lat=ANGKA --lng=ANGKA (alamat pakai tanda kutip bila ada spasi).');
    process.exitCode = 1;
    return;
  }

  // Alamat (opsional)
  const mengubahAlamat = alamatRaw !== undefined;
  const alamat = alamatRaw === undefined || alamatRaw.trim() === '' ? null : alamatRaw.trim();
  if (alamat !== null && alamat.length > 200) {
    console.log(`Alamat terlalu panjang (${alamat.length} karakter, maksimal 200).`);
    process.exitCode = 1;
    return;
  }

  // Koordinat (opsional, tapi lat dan lng harus berdua)
  const mengubahTitik = latRaw !== undefined || lngRaw !== undefined;
  let lat = 0;
  let lng = 0;
  if (mengubahTitik) {
    if (latRaw === undefined || lngRaw === undefined) {
      console.log('--lat dan --lng harus diisi berdua.');
      process.exitCode = 1;
      return;
    }
    const latN = toNumber(latRaw);
    const lngN = toNumber(lngRaw);
    if (latN === null || lngN === null) {
      console.log('--lat dan --lng harus berupa angka, contoh: --lat=-6.317228 --lng=107.112445');
      process.exitCode = 1;
      return;
    }
    if (latN < -90 || latN > 90) {
      console.log('Latitude harus -90 sampai 90.');
      process.exitCode = 1;
      return;
    }
    if (lngN < -180 || lngN > 180) {
      console.log('Longitude harus -180 sampai 180.');
      process.exitCode = 1;
      return;
    }
    lat = latN;
    lng = lngN;
  }

  if (!mengubahAlamat && !mengubahTitik) {
    console.log('Tidak ada yang diubah. Isi --alamat=TEKS dan/atau --lat=ANGKA --lng=ANGKA.');
    process.exitCode = 1;
    return;
  }

  const [found] = await pool.execute<RowDataPacket[]>('SELECT id, nama, lat, lng, alamat FROM locations WHERE id = ?', [id]);
  if (found.length === 0) {
    console.log(`Lokasi dengan id ${id} tidak ada. Jalankan tanpa argumen untuk melihat daftarnya.`);
    process.exitCode = 1;
    return;
  }
  const lama = found[0];

  const sets: string[] = [];
  const params: (string | number | null)[] = [];
  if (mengubahAlamat) {
    sets.push('alamat = ?');
    params.push(alamat);
  }
  if (mengubahTitik) {
    sets.push('lat = ?', 'lng = ?');
    params.push(lat, lng);
  }
  params.push(id);

  console.log(`Lokasi ${id} (${lama.nama})`);
  if (mengubahTitik) console.log(`  titik: ${Number(lama.lat)}, ${Number(lama.lng)}  ->  ${lat}, ${lng}`);
  if (mengubahAlamat) console.log(`  alamat: ${lama.alamat ?? '(kosong)'}  ->  ${alamat ?? '(kosong)'}`);

  const [res] = await pool.execute<ResultSetHeader>(`UPDATE locations SET ${sets.join(', ')} WHERE id = ?`, params);
  console.log(`UPDATE langsung di DB selesai (baris terkena: ${res.affectedRows}).`);
  await daftar();
}

main()
  .catch((err) => {
    console.error('Gagal:', err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
