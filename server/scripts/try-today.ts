/**
 * Uji GET /attendance/today lewat HTTP asli. HANYA MEMBACA (tidak membuat absen).
 *
 * Jalankan dari folder `server` (server harus sudah hidup: npm run dev):
 *   npx tsx scripts/try-today.ts            -> pakai SIM0011 (karyawan Produksi)
 *   npx tsx scripts/try-today.ts SIM0010    -> pakai NIK lain
 *
 * Opsi lewat environment: API_URL (default http://localhost:3001/api), SEED_PASSWORD (default simulasi123).
 * Skrip ini tidak membaca server/.env.
 */
export {};

const API = process.env.API_URL ?? 'http://localhost:3001/api';
const PASSWORD = process.env.SEED_PASSWORD ?? 'simulasi123';
const NIK = process.argv[2] ?? 'SIM0011';

const STATUSES = ['NO_SCHEDULE', 'UPCOMING', 'NOT_CHECKED_IN', 'CHECKED_IN', 'CHECKED_OUT', 'AUTO_CLOSED'];

let pass = 0;
let fail = 0;
function check(name: string, ok: boolean, detail?: unknown) {
  if (ok) pass++;
  else fail++;
  console.log(`${ok ? 'OK  ' : 'GAGAL'} ${name}${ok || detail === undefined ? '' : ` -> ${JSON.stringify(detail)}`}`);
}

async function main() {
  // 1) Tanpa token harus 401.
  const noAuth = await fetch(`${API}/attendance/today`);
  check('tanpa token -> 401', noAuth.status === 401, noAuth.status);

  // 2) Login.
  const login = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nik: NIK, password: PASSWORD }),
  });
  const loginBody = (await login.json()) as { token?: string; data?: { token?: string } };
  const token = loginBody.token ?? loginBody.data?.token;
  check(`login ${NIK}`, login.status === 200 && !!token, { status: login.status, keys: Object.keys(loginBody) });
  if (!token) return;

  // 3) GET /attendance/today (sengaja tanpa header X-Device-Id: endpoint ini hanya membaca).
  const before = Date.now();
  const res = await fetch(`${API}/attendance/today`, { headers: { Authorization: `Bearer ${token}` } });
  const body = (await res.json()) as {
    data?: {
      serverTime: string;
      status: string;
      roster: unknown;
      window: unknown;
      canCheckIn: boolean;
      checkOut: unknown;
      attendance: unknown;
    };
  };
  const d = body.data;
  check('200 dan ada data', res.status === 200 && !!d, res.status);
  check('Cache-Control: no-store', (res.headers.get('cache-control') ?? '').includes('no-store'), res.headers.get('cache-control'));
  if (!d) return;

  console.log('\nRespons:\n' + JSON.stringify(d, null, 2) + '\n');

  check('status termasuk daftar yang dikenal', STATUSES.includes(d.status), d.status);
  check('serverTime dekat jam komputer ini (selisih < 2 menit)', Math.abs(new Date(d.serverTime).getTime() - before) < 120_000, d.serverTime);
  check('canCheckIn hanya true saat NOT_CHECKED_IN', d.canCheckIn === (d.status === 'NOT_CHECKED_IN'), { status: d.status, canCheckIn: d.canCheckIn });
  check('checkOut hanya terisi saat CHECKED_IN', (d.checkOut !== null) === (d.status === 'CHECKED_IN'), { status: d.status });
  if (d.status === 'NO_SCHEDULE') {
    check('NO_SCHEDULE -> roster, window, attendance null', d.roster === null && d.window === null && d.attendance === null);
  } else {
    check('status selain NO_SCHEDULE -> roster dan window terisi', d.roster !== null && d.window !== null);
  }

  console.log(`\n${pass} lolos, ${fail} gagal.`);
  process.exitCode = fail === 0 ? 0 : 1;
}

main().catch((err) => {
  console.error('Skrip gagal jalan. Apakah server sudah hidup di', API, '?', err);
  process.exitCode = 1;
});
