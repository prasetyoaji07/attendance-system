/**
 * Alat bantu pengembangan: coba check-in dari terminal tanpa client.
 * Login sebagai NIK yang diberikan, mendaftarkan "perangkat skrip" (device binding), mencari lokasi roster-nya,
 * membuat QR yang sah, lalu memanggil POST /api/attendance/check-in dan mencetak jawaban server apa adanya.
 *
 * Pemakaian (server harus sedang jalan: npm run dev), dari folder server:
 *   npx tsx scripts/try-checkin.ts SIM0011
 *   npx tsx scripts/try-checkin.ts SIM0011 --lat=-6.31 --lng=107.2     # pura-pura jauh dari lokasi
 *   npx tsx scripts/try-checkin.ts SIM0011 --acc=80                      # pura-pura sinyal GPS lemah
 *   npx tsx scripts/try-checkin.ts SIM0011 --bad-qr                      # QR sengaja salah
 *   npx tsx scripts/try-checkin.ts SIM0011 --device=ID-PERANGKAT-LAIN    # pakai ID perangkat tertentu
 * Opsi lain: --password=... (default simulasi123), API_URL di env (default http://localhost:PORT/api).
 * ID perangkat bawaan: "try-script-<NIK>". Akun yang belum punya perangkat otomatis mendapat perangkat ini (active).
 * Kalau akun sudah punya perangkat lain, perangkat skrip jadi pending dan check-in ditolak 403 DEVICE_PENDING
 * sampai HRD menyetujuinya (itu perilaku yang benar).
 *
 * Hanya untuk data simulasi di lingkungan pengembangan.
 */
import { config } from '../src/core/config';
import { RULES } from '../src/core/rules';
import { signQr } from '../src/utils/hmac-qr';

const args = process.argv.slice(2);
const nik = args.find((a) => !a.startsWith('--'));
const opt = (name: string) => args.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
if (!nik) {
  console.error('Pemakaian: npx tsx scripts/try-checkin.ts <NIK> [--lat=..] [--lng=..] [--acc=..] [--bad-qr] [--device=..] [--password=..]');
  process.exit(1);
}

const BASE = process.env.API_URL ?? `http://localhost:${config.PORT}/api`;
const wibDate = (offsetDays: number) => new Date(Date.now() + 7 * 3_600_000 + offsetDays * 86_400_000).toISOString().slice(0, 10);

async function call<T>(path: string, init: RequestInit = {}, token?: string, deviceId?: string): Promise<{ status: number; body: T }> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(deviceId ? { 'X-Device-Id': deviceId } : {}),
    },
  });
  return { status: res.status, body: (await res.json().catch(() => null)) as T };
}

async function main() {
  const login = await call<{ token: string; user: { employeeId: number; nama: string } }>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ nik, password: opt('password') ?? 'simulasi123' }),
  });
  if (login.status !== 200) {
    console.error(`Login gagal (${login.status}):`, JSON.stringify(login.body));
    process.exit(1);
  }
  const { token, user } = login.body;
  console.log(`Login sebagai ${user.nama} (${nik}).`);

  // Device binding: daftarkan perangkat skrip (aman diulang). Perangkat pertama akun langsung active.
  const deviceId = opt('device') ?? `try-script-${nik}`;
  const reg = await call<{ data?: { status: string; message: string }; error?: { message?: string } }>(
    '/devices/register',
    { method: 'POST', body: JSON.stringify({ deviceId }) },
    token,
  );
  console.log(
    `Perangkat ${deviceId}: ${reg.body?.data ? `${reg.body.data.status} (${reg.body.data.message})` : `pendaftaran gagal (HTTP ${reg.status}) ${JSON.stringify(reg.body)}`}`,
  );

  const rosters = await call<{ data: { shiftDate: string; shiftNama: string; jamMulai: string; jamSelesai: string; locationId: number; locationNama: string }[] }>(
    `/roster?from=${wibDate(-1)}&to=${wibDate(1)}&employeeId=${user.employeeId}`,
    {},
    token,
  );
  const list = rosters.body?.data ?? [];
  console.log('Roster kemarin/hari ini/besok:');
  for (const r of list) console.log(`  ${r.shiftDate}  ${r.shiftNama} ${r.jamMulai}-${r.jamSelesai}  @ ${r.locationNama}`);
  const target = list.find((r) => r.shiftDate === wibDate(0)) ?? list[0];
  if (!target) {
    console.error('Tidak ada roster di sekitar hari ini, jadi tidak ada lokasi untuk dipakai.');
    process.exit(1);
  }

  const loc = await call<{ data: { id: number; nama: string; lat: number; lng: number; radiusM: number } }>(`/locations/${target.locationId}`, {}, token);
  const L = loc.body.data;
  console.log(`Lokasi: ${L.nama} (${L.lat}, ${L.lng}), radius ${L.radiusM} m`);

  const payload = {
    lat: Number(opt('lat') ?? L.lat),
    lng: Number(opt('lng') ?? L.lng),
    accuracyM: Number(opt('acc') ?? 10),
    qr: args.includes('--bad-qr') ? 'qr-palsu' : signQr(L.id, config.QR_SECRET, RULES.qrTtlSeconds),
  };
  console.log('Mengirim check-in:', JSON.stringify({ ...payload, qr: payload.qr.slice(0, 18) + '...' }));
  const res = await call('/attendance/check-in', { method: 'POST', body: JSON.stringify(payload) }, token, deviceId);
  console.log(`\nJawaban server: HTTP ${res.status}`);
  console.log(JSON.stringify(res.body, null, 2));
}

main().catch((e) => {
  console.error('Gagal terhubung ke server. Sudah jalan (npm run dev)?', e instanceof Error ? e.message : e);
  process.exit(1);
});
