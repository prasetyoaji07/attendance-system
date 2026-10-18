/**
 * Alat bantu pengembangan: uji GET /api/locations/:id/qr lewat HTTP terhadap server yang sedang jalan.
 * Memeriksa: token dari endpoint lolos verifyQr (fungsi yang sama dengan check-in/out), HRD boleh,
 * karyawan biasa 403, tanpa token 401, lokasi tidak ada 404. TIDAK membuat absen apa pun.
 *
 * Pemakaian (npm run dev harus jalan), dari folder server:
 *   npx tsx scripts/try-qr.ts
 *   npx tsx scripts/try-qr.ts --hrd=SIM0001 --employee=SIM0011 --location=1
 * Opsi lain: --password=... (default simulasi123), API_URL di env (default http://127.0.0.1:PORT/api).
 *
 * Hanya untuk data simulasi di lingkungan pengembangan.
 */
import { config } from '../src/core/config';
import { RULES } from '../src/core/rules';
import { verifyQr } from '../src/utils/hmac-qr';

const args = process.argv.slice(2);
const opt = (name: string) => args.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const hrdNik = opt('hrd') ?? 'SIM0001';
const employeeNik = opt('employee') ?? 'SIM0011';
const password = opt('password') ?? 'simulasi123';
const base = process.env.API_URL ?? `http://127.0.0.1:${process.env.PORT ?? 3001}/api`;

interface ApiBody {
  token?: string;
  data?: unknown;
  error?: { code?: string; message?: string };
}
interface QrData {
  locationId: number;
  locationNama: string;
  token: string;
  refreshAt: string;
  ttlSeconds: number;
}

async function call(method: string, path: string, opts: { token?: string; body?: unknown } = {}) {
  const headers: Record<string, string> = {};
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
  const res = await fetch(`${base}${path}`, {
    method,
    headers,
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
  });
  const text = await res.text();
  let body: ApiBody = {};
  try {
    body = JSON.parse(text) as ApiBody;
  } catch {
    /* respons bukan JSON */
  }
  return { status: res.status, body, text, headers: res.headers };
}

let ok = 0;
let bad = 0;
function check(name: string, cond: boolean, detail = '') {
  if (cond) {
    console.log(`  [OK]    ${name}`);
    ok++;
  } else {
    console.log(`  [GAGAL] ${name}${detail ? ` -> ${detail}` : ''}`);
    bad++;
  }
}

async function login(nik: string): Promise<string> {
  const r = await call('POST', '/auth/login', { body: { nik, password } });
  if (r.status !== 200 || !r.body.token) {
    console.error(`Login ${nik} gagal (status ${r.status}): ${r.text}`);
    process.exit(1);
  }
  return r.body.token;
}

async function main() {
  console.log(`Uji QR dinamis (${base})`);
  const hrd = await login(hrdNik);
  const employee = await login(employeeNik);

  let locationId = Number(opt('location'));
  if (!Number.isInteger(locationId) || locationId <= 0) {
    const l = await call('GET', '/locations', { token: hrd });
    const first = (l.body.data as { id: number }[] | undefined)?.[0];
    if (!first) {
      console.error('Belum ada lokasi di database.');
      process.exit(1);
    }
    locationId = first.id;
  }

  console.log(`Lokasi id ${locationId}`);
  const r = await call('GET', `/locations/${locationId}/qr`, { token: hrd });
  check('HRD mengambil QR: 200', r.status === 200, `status ${r.status} ${r.text}`);
  const qr = r.body.data as QrData | undefined;
  if (qr) {
    console.log(`  token: ${qr.token.slice(0, 18)}...  refreshAt: ${qr.refreshAt}  ttl: ${qr.ttlSeconds} dtk`);
    const v = verifyQr(qr.token, config.QR_SECRET, RULES.qrTtlSeconds);
    check('token lolos verifyQr (fungsi yang sama dengan check-in/out)', v.valid);
    check('token menunjuk lokasi yang diminta', v.valid && v.locationId === locationId);
    check('ttlSeconds = RULES.qrTtlSeconds', qr.ttlSeconds === RULES.qrTtlSeconds);
    const msLeft = Date.parse(qr.refreshAt) - Date.now();
    check('refreshAt di masa depan, paling lama satu ttl', msLeft > 0 && msLeft <= RULES.qrTtlSeconds * 1000, `${msLeft} ms`);
  }
  check('Cache-Control: no-store', (r.headers.get('cache-control') ?? '').includes('no-store'));

  const again = await call('GET', `/locations/${locationId}/qr`, { token: hrd });
  const qr2 = again.body.data as QrData | undefined;
  check('dua kali ambil di window yang sama memberi token yang sama (atau window baru)', !!qr2 && (qr2.token === qr?.token || qr2.refreshAt !== qr?.refreshAt));

  const e = await call('GET', `/locations/${locationId}/qr`, { token: employee });
  check('karyawan biasa: 403', e.status === 403, `status ${e.status}`);
  const n = await call('GET', `/locations/${locationId}/qr`);
  check('tanpa token: 401', n.status === 401, `status ${n.status}`);
  const nf = await call('GET', '/locations/999999/qr', { token: hrd });
  check('lokasi tidak ada: 404', nf.status === 404, `status ${nf.status}`);
  const bi = await call('GET', '/locations/abc/qr', { token: hrd });
  check('id bukan angka: 400', bi.status === 400, `status ${bi.status}`);

  console.log(`\nSelesai: ${ok} lulus, ${bad} gagal`);
  if (bad > 0) process.exit(1);
}

main().catch((err) => {
  console.error('Gagal menjalankan skrip. Server hidup? (npm run dev)', err);
  process.exit(1);
});
