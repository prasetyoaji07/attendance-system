/**
 * Uji NYATA check-out lewat HTTP ke server yang sedang jalan (npm run dev di jendela lain) dan TiDB asli.
 * Jalankan dari folder server:
 *   npx tsx scripts/try-checkout.ts <NIK>                    (kasus normal: koordinat + QR tepat di lokasi absennya)
 *   npx tsx scripts/try-checkout.ts <NIK> --lat=-6.5 --lng=107 (di luar radius)
 *   npx tsx scripts/try-checkout.ts <NIK> --acc=80             (akurasi GPS lemah)
 *   npx tsx scripts/try-checkout.ts <NIK> --bad-qr             (QR rusak)
 * Opsi lain: --password=... (default simulasi123), --base=http://127.0.0.1:3001/api
 * Skrip ini hanya MEMBACA absen terakhir karyawan dari database, lalu memanggil API. Tidak mencetak rahasia.
 * Semua data adalah simulasi.
 */
import type { RowDataPacket } from 'mysql2';
import { config } from '../src/core/config';
import { pool } from '../src/core/db';
import { RULES } from '../src/core/rules';
import { signQr } from '../src/utils/hmac-qr';

function arg(name: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : undefined;
}
const flag = (name: string) => process.argv.includes(`--${name}`);

interface LatestRow extends RowDataPacket {
  attendanceId: number;
  shiftDate: string;
  locationId: number;
  locationNama: string;
  lat: string;
  lng: string;
  checkInAt: Date;
  checkOutAt: Date | null;
  autoClosed: number;
}

async function main() {
  const nik = process.argv.slice(2).find((a) => !a.startsWith('--'));
  if (!nik) {
    console.error('Pemakaian: npx tsx scripts/try-checkout.ts <NIK> [--lat= --lng= --acc= --bad-qr]');
    process.exit(1);
  }
  const base = arg('base') ?? 'http://127.0.0.1:3001/api';
  const password = arg('password') ?? 'simulasi123';

  // 1) Absen terakhir karyawan (hanya membaca), untuk tahu lokasi yang harus dipakai.
  const [rows] = await pool.execute<LatestRow[]>(
    `SELECT a.id AS attendanceId, DATE_FORMAT(r.shift_date, '%Y-%m-%d') AS shiftDate,
            l.id AS locationId, l.nama AS locationNama, l.lat AS lat, l.lng AS lng,
            a.check_in_at AS checkInAt, a.check_out_at AS checkOutAt, a.auto_closed AS autoClosed
     FROM attendance a
     JOIN rosters r ON r.id = a.roster_id
     JOIN employees e ON e.id = r.employee_id
     JOIN locations l ON l.id = r.location_id
     WHERE e.nik = ? AND a.check_in_at IS NOT NULL
     ORDER BY a.check_in_at DESC LIMIT 1`,
    [nik],
  );
  const latest = rows[0];
  if (latest) {
    console.log(
      `Absen terakhir ${nik}: id ${latest.attendanceId}, shift ${latest.shiftDate}, lokasi ${latest.locationNama}, ` +
        `check-in ${new Date(latest.checkInAt).toISOString()}, check-out ${latest.checkOutAt ? new Date(latest.checkOutAt).toISOString() : '(belum)'}, ` +
        `auto-close ${Number(latest.autoClosed) === 1 ? 'ya' : 'tidak'}`,
    );
  } else {
    console.log(`Karyawan ${nik} belum punya absen sama sekali (yang diuji: NO_OPEN_ATTENDANCE).`);
  }

  // 2) Login.
  const loginRes = await fetch(`${base}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nik, password }),
  });
  const loginBody = (await loginRes.json()) as { token?: string };
  if (!loginRes.ok || !loginBody.token) {
    console.error(`Login gagal (status ${loginRes.status}). Cek NIK/password dan apakah server jalan.`);
    process.exit(1);
  }

  // 3) Susun body check-out.
  const locationId = latest ? Number(latest.locationId) : 1;
  const lat = arg('lat') !== undefined ? Number(arg('lat')) : latest ? Number(latest.lat) : 0;
  const lng = arg('lng') !== undefined ? Number(arg('lng')) : latest ? Number(latest.lng) : 0;
  const accuracyM = arg('acc') !== undefined ? Number(arg('acc')) : 10;
  const qr = flag('bad-qr') ? 'rusak.token.palsu' : signQr(locationId, config.QR_SECRET, RULES.qrTtlSeconds);

  console.log(`Kirim check-out: lat ${lat}, lng ${lng}, akurasi ${accuracyM} m, QR ${flag('bad-qr') ? 'RUSAK (sengaja)' : 'valid'}`);
  const res = await fetch(`${base}/attendance/check-out`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${loginBody.token}` },
    body: JSON.stringify({ lat, lng, accuracyM, qr }),
  });
  console.log(`HTTP ${res.status}`);
  console.log(JSON.stringify(await res.json(), null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
