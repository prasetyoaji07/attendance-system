/**
 * Uji NYATA device binding lewat HTTP ke server yang sedang jalan (npm run dev di jendela lain) dan database asli.
 * Memeriksa pendaftaran, antrean pending, persetujuan/penolakan HRD, aturan "tidak boleh menyetujui perangkat
 * sendiri", dan guard di check-in. TIDAK membuat absen: guard dites dengan body kosong, jadi request yang lolos
 * guard berhenti di validasi (400) sebelum menyentuh tabel attendance.
 *
 * Jalankan dari folder server (migrasi 003 harus sudah dijalankan):
 *   npx tsx scripts/try-devices.ts
 *   npx tsx scripts/try-devices.ts --hrd=SIM0001 --employee=SIM0011
 * Opsi lain: --password=... (default simulasi123), API_URL di env (default http://127.0.0.1:PORT/api).
 *
 * Syarat: akun karyawan dan HRD yang dipakai belum punya perangkat selain "try-script-<NIK>" (atau belum punya sama
 * sekali). Kalau sudah punya perangkat lain, skrip berhenti dengan penjelasan dan tidak mengubah apa pun.
 * Akhir yang diharapkan: tiap akun hanya punya perangkat "try-script-<NIK>" yang active (skrip membersihkan dirinya).
 * Hanya untuk data simulasi di lingkungan pengembangan.
 */
const args = process.argv.slice(2);
const opt = (name: string) => args.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const hrdNik = opt('hrd') ?? 'SIM0001';
const empNik = opt('employee') ?? 'SIM0011';
const password = opt('password') ?? 'simulasi123';
const base = process.env.API_URL ?? `http://127.0.0.1:${process.env.PORT ?? 3001}/api`;

interface ApiBody {
  token?: string;
  data?: any; // eslint-disable-line @typescript-eslint/no-explicit-any
  error?: { code?: string; message?: string };
}

async function call(method: string, path: string, opts: { token?: string; device?: string; body?: unknown } = {}) {
  const headers: Record<string, string> = {};
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;
  if (opts.device) headers['X-Device-Id'] = opts.device;
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
    /* bukan JSON */
  }
  return { status: res.status, body, text };
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
const short = (r: { status: number; text: string }) => `HTTP ${r.status} ${r.text.slice(0, 200)}`;

async function login(nik: string): Promise<string> {
  const r = await call('POST', '/auth/login', { body: { nik, password } });
  if (r.status !== 200 || !r.body.token) {
    console.error(`Login ${nik} gagal: ${short(r)}`);
    process.exit(1);
  }
  return r.body.token;
}

/** Pastikan akun hanya punya perangkat skrip (active). Berhenti bila ada perangkat lain. */
async function ensureBaseDevice(label: string, token: string, deviceId: string) {
  const reg = await call('POST', '/devices/register', { token, body: { deviceId } });
  const me = await call('GET', '/devices/me', { token, device: deviceId });
  if (reg.status >= 300 || me.body.data?.current !== 'active' || me.body.data?.devices?.length !== 1) {
    console.error(
      `${label} sudah punya perangkat lain atau pendaftaran gagal (${short(reg)}). ` +
        'Skrip berhenti tanpa mengubah apa pun. Pakai akun lain lewat --employee= / --hrd=.',
    );
    process.exit(1);
  }
}

async function main() {
  console.log(`Uji device binding (${base})`);
  const hrd = await login(hrdNik);
  const emp = await login(empNik);
  const A = `try-script-${empNik}`; // perangkat dasar karyawan
  const B = `try-script-B-${empNik}`; // perangkat kedua karyawan
  const hrdA = `try-script-${hrdNik}`;
  const hrdB = `try-script-B-${hrdNik}`;

  console.log('\n1. Pendaftaran');
  await ensureBaseDevice(`Karyawan ${empNik}`, emp, A);
  await ensureBaseDevice(`HRD ${hrdNik}`, hrd, hrdA);
  check('akun uji hanya punya perangkat skrip, status active', true);
  const again = await call('POST', '/devices/register', { token: emp, body: { deviceId: A } });
  check('daftar ulang perangkat yang sama: 200, created=false', again.status === 200 && again.body.data?.created === false, short(again));
  const badId = await call('POST', '/devices/register', { token: emp, body: { deviceId: 'pendek' } });
  check('ID perangkat tidak valid: 400', badId.status === 400, short(badId));
  const noAuth = await call('POST', '/devices/register', { body: { deviceId: B } });
  check('tanpa token: 401', noAuth.status === 401, short(noAuth));

  console.log('\n2. Guard check-in (body kosong, tidak membuat absen)');
  const noHeader = await call('POST', '/attendance/check-in', { token: emp, body: {} });
  check('tanpa header perangkat: 403 DEVICE_REQUIRED', noHeader.status === 403 && noHeader.body.error?.code === 'DEVICE_REQUIRED', short(noHeader));
  const unknown = await call('POST', '/attendance/check-in', { token: emp, device: B, body: {} });
  check('perangkat belum terdaftar: 403 DEVICE_NOT_REGISTERED', unknown.status === 403 && unknown.body.error?.code === 'DEVICE_NOT_REGISTERED', short(unknown));
  const passed = await call('POST', '/attendance/check-in', { token: emp, device: A, body: {} });
  check('perangkat active lolos guard (berhenti di validasi: 400)', passed.status === 400, short(passed));
  const outNoHeader = await call('POST', '/attendance/check-out', { token: emp, body: {} });
  check('check-out juga dijaga: tanpa header 403 DEVICE_REQUIRED', outNoHeader.status === 403 && outNoHeader.body.error?.code === 'DEVICE_REQUIRED', short(outNoHeader));

  console.log('\n3. Perangkat baru jadi pending');
  const regB = await call('POST', '/devices/register', { token: emp, body: { deviceId: B } });
  check('perangkat kedua: 201 status pending', regB.status === 201 && regB.body.data?.status === 'pending', short(regB));
  const regB2 = await call('POST', '/devices/register', { token: emp, body: { deviceId: B } });
  check('daftar ulang yang pending: 200, tetap pending, tidak ganda', regB2.status === 200 && regB2.body.data?.status === 'pending' && regB2.body.data?.created === false, short(regB2));
  const pendingTry = await call('POST', '/attendance/check-in', { token: emp, device: B, body: {} });
  check('check-in dari perangkat pending: 403 DEVICE_PENDING', pendingTry.status === 403 && pendingTry.body.error?.code === 'DEVICE_PENDING', short(pendingTry));
  const stillA = await call('POST', '/attendance/check-in', { token: emp, device: A, body: {} });
  check('perangkat lama tetap bisa (lolos guard)', stillA.status === 400, short(stillA));

  console.log('\n4. Antrean HRD dan hak akses');
  const empList = await call('GET', '/devices/pending', { token: emp });
  check('karyawan biasa melihat antrean: 403', empList.status === 403, short(empList));
  const list = await call('GET', '/devices/pending', { token: hrd });
  const mine = (list.body.data as { id: number; nik: string }[] | undefined)?.find((d) => d.nik === empNik);
  check('HRD melihat permintaan karyawan di antrean', list.status === 200 && !!mine, short(list));
  if (!mine) {
    console.error('Antrean tidak memuat permintaan; langkah berikutnya dilewati.');
    return finish();
  }
  const empApprove = await call('POST', `/devices/${mine.id}/approve`, { token: emp });
  check('karyawan menyetujui perangkatnya sendiri: 403', empApprove.status === 403, short(empApprove));

  console.log('\n5. HRD menyetujui: perangkat lama diganti');
  const nf = await call('POST', '/devices/999999/approve', { token: hrd });
  check('id tidak ada: 404', nf.status === 404, short(nf));
  const meA = await call('GET', '/devices/me', { token: emp, device: A });
  const activeId = (meA.body.data?.devices as { id: number; status: string }[] | undefined)?.find((d) => d.status === 'active')?.id;
  const onActive = await call('POST', `/devices/${activeId}/approve`, { token: hrd });
  check('menyetujui perangkat yang sudah active: 409', onActive.status === 409, short(onActive));
  const appr = await call('POST', `/devices/${mine.id}/approve`, { token: hrd });
  check('HRD menyetujui: 200, 1 perangkat lama diganti', appr.status === 200 && appr.body.data?.replacedDevices === 1, short(appr));
  const meAfterA = await call('GET', '/devices/me', { token: emp, device: A });
  const meAfterB = await call('GET', '/devices/me', { token: emp, device: B });
  check('perangkat lama (A) tidak terdaftar lagi', meAfterA.body.data?.current === 'unregistered', short(meAfterA));
  check('perangkat baru (B) active', meAfterB.body.data?.current === 'active', short(meAfterB));
  const nowB = await call('POST', '/attendance/check-in', { token: emp, device: B, body: {} });
  check('perangkat baru lolos guard (400)', nowB.status === 400, short(nowB));

  console.log('\n6. Kembalikan ke perangkat dasar (A) lewat persetujuan lagi, sekalian uji tolak');
  const regA = await call('POST', '/devices/register', { token: emp, body: { deviceId: A } });
  check('A daftar lagi: pending (karena B active)', regA.body.data?.status === 'pending', short(regA));
  const list2 = await call('GET', '/devices/pending', { token: hrd });
  const pa = (list2.body.data as { id: number; nik: string }[] | undefined)?.find((d) => d.nik === empNik);
  const rej = pa ? await call('POST', `/devices/${pa.id}/reject`, { token: hrd }) : null;
  check('HRD menolak: 200', !!rej && rej.status === 200, rej ? short(rej) : 'tidak ada di antrean');
  const afterRej = await call('POST', '/attendance/check-in', { token: emp, device: A, body: {} });
  check('setelah ditolak, A tidak terdaftar: 403 DEVICE_NOT_REGISTERED', afterRej.body.error?.code === 'DEVICE_NOT_REGISTERED', short(afterRej));
  const stillB = await call('GET', '/devices/me', { token: emp, device: B });
  check('penolakan tidak menyentuh perangkat active (B tetap active)', stillB.body.data?.current === 'active', short(stillB));
  await call('POST', '/devices/register', { token: emp, body: { deviceId: A } });
  const list3 = await call('GET', '/devices/pending', { token: hrd });
  const pa2 = (list3.body.data as { id: number; nik: string }[] | undefined)?.find((d) => d.nik === empNik);
  const back = pa2 ? await call('POST', `/devices/${pa2.id}/approve`, { token: hrd }) : null;
  check('A disetujui lagi: B diganti', !!back && back.status === 200 && back.body.data?.replacedDevices === 1, back ? short(back) : 'tidak ada di antrean');
  const meEnd = await call('GET', '/devices/me', { token: emp, device: A });
  check('akhir: karyawan hanya punya A (active)', meEnd.body.data?.current === 'active' && meEnd.body.data?.devices?.length === 1, short(meEnd));

  console.log('\n7. HRD tidak boleh menyetujui perangkatnya sendiri');
  const hr = await call('POST', '/devices/register', { token: hrd, body: { deviceId: hrdB } });
  check('perangkat kedua HRD: pending', hr.body.data?.status === 'pending', short(hr));
  const hl = await call('GET', '/devices/pending', { token: hrd });
  const own = (hl.body.data as { id: number; nik: string }[] | undefined)?.find((d) => d.nik === hrdNik);
  const self = own ? await call('POST', `/devices/${own.id}/approve`, { token: hrd }) : null;
  check('HRD menyetujui perangkat sendiri: 403', !!self && self.status === 403, self ? short(self) : 'tidak ada di antrean');
  const clean = own ? await call('POST', `/devices/${own.id}/reject`, { token: hrd }) : null;
  check('bersih-bersih: HRD menolak permintaannya sendiri: 200', !!clean && clean.status === 200, clean ? short(clean) : '');

  finish();
}

function finish() {
  console.log(`\nSelesai: ${ok} lulus, ${bad} gagal`);
  if (bad > 0) {
    console.log('Ada yang gagal: perangkat uji mungkin tertinggal. Tempel hasil ini, jangan hapus data manual dulu.');
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Gagal menjalankan skrip. Server hidup? Migrasi 003 sudah jalan?', err);
  process.exit(1);
});
