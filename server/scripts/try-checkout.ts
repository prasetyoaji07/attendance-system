/**
 * Uji NYATA check-out lewat HTTP ke server yang sedang jalan (npm run dev di jendela lain) dan TiDB asli.
 * Jalankan dari folder server:
 *   npx tsx scripts/try-checkout.ts <NIK>                    (kasus normal: koordinat + QR tepat di lokasi absennya)
 *   npx tsx scripts/try-checkout.ts <NIK> --lat=-6.5 --lng=107 (di luar radius)
 *   npx tsx scripts/try-checkout.ts <NIK> --acc=80             (akurasi GPS lemah)
 *   npx tsx scripts/try-checkout.ts <NIK> --bad-qr             (QR rusak)
 *   npx tsx scripts/try-checkout.ts <NIK> --device=ID-LAIN     (ID perangkat tertentu)
 *   npx tsx scripts/try-checkout.ts <NIK> --reason=LAINNYA     (alasan pulang awal: SAKIT_KECELAKAAN, URUSAN_KELUARGA,
 *                                                               DISURUH_ATASAN, KERJAAN_SELESAI, LAINNYA)
 * Tanpa --reason, check-out SEBELUM jam selesai shift ditolak 422 EARLY_LEAVE_REASON_REQUIRED (tidak menulis apa pun).
 * Dengan --reason setelah jam selesai, alasan diabaikan (respons dan kolom DB null).
 * Opsi lain: --password=... (default simulasi123), --base=http://127.0.0.1:3001/api
 * Perangkat: memakai "try-script-<NIK>" dan mendaftarkannya dulu (device binding). Sama dengan try-checkin.ts.
 * Skrip ini MEMBACA baris absen terakhir karyawan dari database (sebelum dan sesudah request), lalu memanggil API.
 * Tidak mencetak rahasia.
 * PERHATIAN: selama batas waktu check-out belum lewat dan syaratnya terpenuhi, skrip ini melakukan check-out SUNGGUHAN.
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

interface RowNow extends RowDataPacket {
  checkOutAt: Date | null;
  earlyLeaveMinutes: number;
  earlyLeaveReason: string | null;
  status: string;
  autoClosed: number;
}

/** Cetak isi baris attendance di DB. Sekaligus membuktikan kolom early_leave_reason ada (kalau tidak, query error). */
async function showRow(label: string, attendanceId: number) {
  const [r] = await pool.execute<RowNow[]>(
    `SELECT check_out_at AS checkOutAt, early_leave_minutes AS earlyLeaveMinutes,
            early_leave_reason AS earlyLeaveReason, status, auto_closed AS autoClosed
     FROM attendance WHERE id = ?`,
    [attendanceId],
  );
  const row = r[0];
  if (!row) {
    console.log(`${label}: baris tidak ditemukan`);
    return;
  }
  console.log(
    `${label}: check_out_at ${row.checkOutAt ? new Date(row.checkOutAt).toISOString() : '(kosong)'}, ` +
      `status ${row.status}, early_leave_minutes ${row.earlyLeaveMinutes}, ` +
      `early_leave_reason ${row.earlyLeaveReason ?? '(NULL)'}`,
  );
}

async function main() {
  const nik = process.argv.slice(2).find((a) => !a.startsWith('--'));
  if (!nik) {
    console.error('Pemakaian: npx tsx scripts/try-checkout.ts <NIK> [--lat= --lng= --acc= --bad-qr --device= --reason=]');
    process.exit(1);
  }
  const base = arg('base') ?? 'http://127.0.0.1:3001/api';
  const password = arg('password') ?? 'simulasi123';
  const reason = arg('reason');

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
    await showRow('DB sebelum request', Number(latest.attendanceId));
  } else {
    console.log(`Belum ada absen untuk NIK ${nik} di database (NIK salah ketik, atau memang belum pernah absen). Yang diuji: respons "tidak ada absen terbuka".`);
  }

  // 2) Login.
  const loginRes = await fetch(`${base}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nik, password }),
  });
  const loginBody = (await loginRes.json()) as { token?: string; data?: { token?: string } };
  const token = loginBody.token ?? loginBody.data?.token;
  if (!loginRes.ok || !token) {
    console.error(`Login gagal (status ${loginRes.status}). Cek NIK/password dan apakah server jalan.`);
    process.exit(1);
  }

  // 3) Device binding: daftarkan perangkat skrip (aman diulang).
  const deviceId = arg('device') ?? `try-script-${nik}`;
  const regRes = await fetch(`${base}/devices/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ deviceId }),
  });
  const regBody = (await regRes.json().catch(() => null)) as { data?: { status: string } } | null;
  console.log(`Perangkat ${deviceId}: ${regBody?.data ? regBody.data.status : `pendaftaran gagal (HTTP ${regRes.status})`}`);

  // 4) Susun body check-out.
  const locationId = latest ? Number(latest.locationId) : 1;
  const lat = arg('lat') !== undefined ? Number(arg('lat')) : latest ? Number(latest.lat) : 0;
  const lng = arg('lng') !== undefined ? Number(arg('lng')) : latest ? Number(latest.lng) : 0;
  const accuracyM = arg('acc') !== undefined ? Number(arg('acc')) : 10;
  const qr = flag('bad-qr') ? 'rusak.token.palsu' : signQr(locationId, config.QR_SECRET, RULES.qrTtlSeconds);

  console.log(
    `Kirim check-out: lat ${lat}, lng ${lng}, akurasi ${accuracyM} m, QR ${flag('bad-qr') ? 'RUSAK (sengaja)' : 'valid'}, ` +
      `alasan ${reason ?? '(tidak dikirim)'}`,
  );
  const res = await fetch(`${base}/attendance/check-out`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, 'X-Device-Id': deviceId },
    body: JSON.stringify({ lat, lng, accuracyM, qr, ...(reason !== undefined ? { earlyLeaveReason: reason } : {}) }),
  });
  console.log(`HTTP ${res.status}`);
  console.log(JSON.stringify(await res.json(), null, 2));

  if (latest) await showRow('DB sesudah request', Number(latest.attendanceId));
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
