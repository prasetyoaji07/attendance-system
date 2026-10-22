/**
 * Uji NYATA absen tanpa QR (selfie) + tinjauan HRD + purge selfie, lewat HTTP ke server yang sedang jalan
 * (npm run dev di jendela lain) dan TiDB asli. Semua data adalah simulasi.
 *
 * Jalankan dari folder server:
 *   npx tsx scripts/try-noqr.ts                  uji penuh langkah 1-5 (absen masuk + pulang SUNGGUHAN)
 *   npx tsx scripts/try-noqr.ts --resume         lanjut dari absen masuk tanpa QR yang SUDAH terlanjur dibuat
 *                                                (lewati langkah 2 dan pengiriman masuk; verifikasi masuk, lalu langkah 4-5)
 *   npx tsx scripts/try-noqr.ts --review-only    seperti --resume, tapi perangkat tidak wajib active dan langkah 4 (pulang)
 *                                                dilewati; dipakai bila pulang sudah dilakukan manual di browser
 *   npx tsx scripts/try-noqr.ts --backdate       langkah 6a: selfie uji dibuat kedaluwarsa (butuh uji penuh dulu)
 *   npx tsx scripts/try-noqr.ts --verify-purge   langkah 6b: cek selfie uji sudah terhapus (setelah purge-selfies)
 * Opsi: --emp=SIM0014 (karyawan), --hrd=SIM0001 (peninjau), --password=..., --base=http://127.0.0.1:3001/api
 *
 * PERHATIAN:
 *  - Uji penuh membuat absen masuk dan pulang SUNGGUHAN untuk karyawan uji hari ini. Tidak bisa diulang di hari yang sama.
 *  - Langkah 5 meng-UPDATE review_status absen uji itu LANGSUNG di database (jadi PENDING), karena undian 10%
 *    tidak bisa dipaksa. Skrip mencetak itu dengan jelas.
 *  - Folder selfie yang dicek skrip = <folder tempat skrip dijalankan>/uploads/selfies. Kalau server dijalankan dari
 *    folder lain, hitungan file tidak akan berubah dan uji ditandai GAGAL (itu memang bukti bahwa lokasinya beda).
 * Skrip tidak membaca server/.env langsung (koneksi lewat core/config dan core/db, seperti skrip lain).
 */
import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { RowDataPacket } from 'mysql2';
import { config } from '../src/core/config';
import { pool } from '../src/core/db';

/* eslint-disable @typescript-eslint/no-explicit-any */

const args = process.argv.slice(2);
const opt = (name: string) => args.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const flag = (name: string) => args.includes(`--${name}`);

const BASE = opt('base') ?? `http://127.0.0.1:${config.PORT}/api`;
const PASSWORD = opt('password') ?? 'simulasi123';
const EMP_NIK = opt('emp') ?? 'SIM0014';
const HRD_NIK = opt('hrd') ?? 'SIM0001';

const SELFIE_DIR = join(process.cwd(), 'uploads', 'selfies');
const STATE_FILE = join(process.cwd(), 'uploads', 'try-noqr-state.json');

let pass = 0;
let fail = 0;
function check(name: string, ok: boolean, detail?: unknown) {
  if (ok) pass++;
  else fail++;
  console.log(`${ok ? 'OK   ' : 'GAGAL'} ${name}${ok || detail === undefined ? '' : ` -> ${typeof detail === 'string' ? detail : JSON.stringify(detail)}`}`);
}
const heading = (t: string) => console.log(`\n=== ${t} ===`);
const wibDate = (offsetDays: number) => new Date(Date.now() + 7 * 3_600_000 + offsetDays * 86_400_000).toISOString().slice(0, 10);

async function call(method: string, path: string, o: { token?: string; device?: string; body?: unknown } = {}) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (o.token) headers.Authorization = `Bearer ${o.token}`;
  if (o.device) headers['X-Device-Id'] = o.device;
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    ...(o.body !== undefined ? { body: JSON.stringify(o.body) } : {}),
  });
  const text = await res.text();
  let body: any = null;
  try {
    body = JSON.parse(text);
  } catch {
    body = null;
  }
  return { status: res.status, body };
}
const code = (r: { body: any }) => r.body?.error?.code as string | undefined;

async function login(nik: string) {
  const r = await call('POST', '/auth/login', { body: { nik, password: PASSWORD } });
  const token = (r.body?.token ?? r.body?.data?.token) as string | undefined;
  return { status: r.status, token, user: (r.body?.user ?? r.body?.data?.user) as any };
}

/** JPEG palsu minimal: awalan FF D8 FF, isi acak, akhiran FF D9. Cukup untuk validasi server (hanya cek byte awal). */
function fakeJpeg(size: number): Buffer {
  return Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), randomBytes(size - 6), Buffer.from([0xff, 0xd9])]);
}
const b64 = (b: Buffer) => b.toString('base64');

const filesNow = (): string[] => (existsSync(SELFIE_DIR) ? readdirSync(SELFIE_DIR).filter((f) => f.endsWith('.jpg')) : []);

async function countAttendance(nik: string): Promise<number> {
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT COUNT(*) AS n FROM attendance a
       JOIN rosters r ON r.id = a.roster_id
       JOIN employees e ON e.id = r.employee_id
      WHERE e.nik = ? AND a.check_in_at IS NOT NULL`,
    [nik],
  );
  return Number(rows[0]?.n ?? 0);
}

async function attendanceRow(id: number) {
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT check_in_method AS inM, check_out_method AS outM, risk_flags AS flags, review_status AS rs,
            reviewed_by AS rb, reviewed_at AS ra, check_out_at AS outAt
       FROM attendance WHERE id = ?`,
    [id],
  );
  return rows[0];
}

async function selfieRows(attendanceId: number) {
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT id, jenis, file_ref AS fileRef, captured_at AS capturedAt, expires_at AS expiresAt
       FROM attendance_selfies WHERE attendance_id = ? ORDER BY id`,
    [attendanceId],
  );
  return rows;
}

async function lastAudit(attendanceId: number) {
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT user_id AS userId, before_json AS beforeJson, after_json AS afterJson
       FROM audit_logs WHERE action = 'ATTENDANCE_REVIEW' AND entity_id = ? ORDER BY id DESC LIMIT 1`,
    [attendanceId],
  );
  return rows[0];
}
const asText = (v: unknown) => (typeof v === 'string' ? v : JSON.stringify(v));

async function fetchSelfie(token: string, id: number) {
  const res = await fetch(`${BASE}/attendance/selfies/${id}`, { headers: { Authorization: `Bearer ${token}` } });
  const buf = Buffer.from(await res.arrayBuffer());
  return { status: res.status, type: res.headers.get('content-type') ?? '', cache: res.headers.get('cache-control') ?? '', buf };
}

interface State {
  attendanceId: number;
  selfies: { id: number; fileRef: string }[];
}
function readState(): State | null {
  if (!existsSync(STATE_FILE)) return null;
  return JSON.parse(readFileSync(STATE_FILE, 'utf8')) as State;
}

/* ------------------------------------------------------------------ mode 6a */
async function modeBackdate() {
  heading('Langkah 6a: buat selfie uji kedaluwarsa');
  const st = readState();
  if (!st) {
    console.log('Belum ada berkas state. Jalankan uji penuh dulu (tanpa opsi).');
    process.exitCode = 1;
    return;
  }
  const past = new Date(Date.now() - 86_400_000);
  await pool.execute('UPDATE attendance_selfies SET expires_at = ? WHERE attendance_id = ?', [past, st.attendanceId]);
  console.log(`UPDATE langsung di DB: expires_at selfie absen ${st.attendanceId} dimundurkan ke ${past.toISOString()}.`);
  const rows = await selfieRows(st.attendanceId);
  check('baris selfie masih ada sebelum purge', rows.length === st.selfies.length, rows.length);
  const hrd = await login(HRD_NIK);
  check(`login HRD ${HRD_NIK}`, hrd.status === 200 && !!hrd.token, hrd.status);
  if (!hrd.token || !st.selfies[0]) return;
  const r = await call('GET', `/attendance/selfies/${st.selfies[0].id}`, { token: hrd.token });
  check('lihat selfie kedaluwarsa: 410 SELFIE_EXPIRED', r.status === 410 && code(r) === 'SELFIE_EXPIRED', { status: r.status, code: code(r) });
  console.log(`\n${pass} lolos, ${fail} gagal.`);
  console.log('Berikutnya: jalankan purge-selfies, lalu skrip ini lagi dengan --verify-purge.');
  process.exitCode = fail === 0 ? 0 : 1;
}

/* ------------------------------------------------------------------ mode 6b */
async function modeVerifyPurge() {
  heading('Langkah 6b: cek hasil purge');
  const st = readState();
  if (!st) {
    console.log('Belum ada berkas state. Jalankan uji penuh dulu (tanpa opsi).');
    process.exitCode = 1;
    return;
  }
  const rows = await selfieRows(st.attendanceId);
  check('baris attendance_selfies uji sudah terhapus', rows.length === 0, `${rows.length} baris tersisa`);
  const left = st.selfies.filter((s) => existsSync(join(SELFIE_DIR, s.fileRef)));
  check('file selfie uji sudah terhapus dari disk', left.length === 0, left.map((s) => s.fileRef));
  const row = await attendanceRow(st.attendanceId);
  check('baris absen itu sendiri masih ada (hanya selfie yang dihapus)', !!row);
  console.log(`\n${pass} lolos, ${fail} gagal.`);
  process.exitCode = fail === 0 ? 0 : 1;
}

/* ------------------------------------------------------------------ uji penuh */
async function modeFull(resume: boolean) {
  const reviewOnly = flag('review-only');
  console.log(`Uji absen tanpa QR (${BASE})`);
  console.log(`Folder selfie yang dicek skrip: ${SELFIE_DIR}`);

  /* ---- Langkah 1: persiapan */
  heading('Langkah 1: persiapan');
  const emp = await login(EMP_NIK);
  check(`login karyawan ${EMP_NIK}`, emp.status === 200 && !!emp.token, emp.status);
  const hrd = await login(HRD_NIK);
  check(`login HRD ${HRD_NIK}`, hrd.status === 200 && !!hrd.token, hrd.status);
  if (!emp.token || !hrd.token) return;

  const deviceId = `try-script-${EMP_NIK}`;
  const reg = await call('POST', '/devices/register', { token: emp.token, body: { deviceId } });
  const devStatus = reg.body?.data?.status as string | undefined;
  console.log(`Perangkat ${deviceId}: ${devStatus ?? `pendaftaran gagal (HTTP ${reg.status}) ${JSON.stringify(reg.body)}`}`);
  if (!reviewOnly && devStatus !== 'active') {
    console.log('Perangkat belum active, jadi absen akan ditolak. Selesaikan dulu (HRD/ADMIN menyetujui perangkat), lalu ulangi.');
    process.exitCode = 1;
    return;
  }

  const today = await call('GET', '/attendance/today', { token: emp.token });
  const status = today.body?.data?.status as string | undefined;
  console.log(`Status Beranda ${EMP_NIK} sekarang: ${status ?? `(tidak terbaca, HTTP ${today.status})`}`);
  if (!resume && status !== 'NOT_CHECKED_IN') {
    console.log('Uji masuk hanya bisa jalan saat status NOT_CHECKED_IN (ada jadwal, jendela absen terbuka, belum absen).');
    console.log('Pilih akun lain dengan --emp=NIK, atau tunggu jendela absen terbuka. Tidak ada yang diubah.');
    process.exitCode = 1;
    return;
  }

  const rosters = await call('GET', `/roster?from=${wibDate(-1)}&to=${wibDate(1)}&employeeId=${emp.user?.employeeId}`, { token: emp.token });
  const list: any[] = rosters.body?.data ?? [];
  const target = list.find((r) => r.shiftDate === wibDate(0)) ?? list[0];
  if (!target) {
    console.log('Tidak ada roster di sekitar hari ini, jadi tidak ada lokasi untuk dipakai.');
    process.exitCode = 1;
    return;
  }
  const locRes = await call('GET', `/locations/${target.locationId}`, { token: emp.token });
  const L = locRes.body?.data;
  if (!L) {
    console.log(`Gagal membaca lokasi (HTTP ${locRes.status}).`);
    process.exitCode = 1;
    return;
  }
  console.log(`Roster ${target.shiftDate} ${target.shiftNama} @ ${L.nama} (${L.lat}, ${L.lng}), radius ${L.radiusM} m`);

  const here = { lat: Number(L.lat), lng: Number(L.lng), accuracyM: 10 };
  const good = fakeJpeg(400);
  const attBefore = await countAttendance(EMP_NIK);
  const filesBefore = filesNow();
  console.log(`Sebelum uji: absen tercatat ${attBefore}, file selfie di disk ${filesBefore.length}.`);

  let attendanceId = 0;
  const send = (body: unknown) => call('POST', '/attendance/check-in', { token: emp.token, device: deviceId, body });

  if (resume) {
    heading('Mode --resume: memakai absen tanpa QR yang sudah ada (langkah 2 dan pengiriman masuk dilewati)');
    const [found] = await pool.execute<RowDataPacket[]>(
      `SELECT a.id AS id FROM attendance a
         JOIN rosters r ON r.id = a.roster_id
         JOIN employees e ON e.id = r.employee_id
        WHERE e.nik = ? AND a.check_in_method = 'NO_QR'
        ORDER BY a.check_in_at DESC LIMIT 1`,
      [EMP_NIK],
    );
    attendanceId = Number(found[0]?.id ?? 0);
    check(`ada absen NO_QR terakhir milik ${EMP_NIK} di DB`, attendanceId > 0);
    if (attendanceId === 0) return;
    console.log(`Memakai absen id ${attendanceId}.`);
  } else {
  /* ---- Langkah 2: uji tolak */
  heading('Langkah 2: uji tolak (tidak boleh menulis apa pun)');

  let r = await send({ ...here });
  check('tanpa selfie: 422 SELFIE_REQUIRED', r.status === 422 && code(r) === 'SELFIE_REQUIRED', { status: r.status, code: code(r) });

  r = await send({ ...here, selfie: b64(Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47]), randomBytes(400)])) });
  check('selfie bukan JPEG (PNG): 422 SELFIE_INVALID', r.status === 422 && code(r) === 'SELFIE_INVALID', { status: r.status, code: code(r) });

  const big = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(300_001 - 4, 1)]);
  r = await send({ ...here, selfie: b64(big) });
  check('selfie 300.001 byte: 422 SELFIE_INVALID', r.status === 422 && code(r) === 'SELFIE_INVALID', { status: r.status, code: code(r) });

  r = await send({ ...here, selfie: b64(good), qr: 'qr-palsu' });
  check('QR salah + selfie valid: 400 INVALID_QR (tidak dialihkan diam-diam)', r.status === 400 && code(r) === 'INVALID_QR', { status: r.status, code: code(r) });

  r = await send({ ...here, accuracyM: 80, selfie: b64(good) });
  check('GPS lemah (80 m): 422 GPS_ACCURACY_LOW', r.status === 422 && code(r) === 'GPS_ACCURACY_LOW', { status: r.status, code: code(r) });

  r = await send({ ...here, lat: here.lat + 0.1, selfie: b64(good) });
  check('lokasi jauh: 422 OUT_OF_RADIUS', r.status === 422 && code(r) === 'OUT_OF_RADIUS', { status: r.status, code: code(r) });

  const attAfterReject = await countAttendance(EMP_NIK);
  const filesAfterReject = filesNow();
  check('setelah semua penolakan: jumlah absen di DB tidak berubah', attAfterReject === attBefore, { sebelum: attBefore, sesudah: attAfterReject });
  check('setelah semua penolakan: jumlah file selfie di disk tidak berubah', filesAfterReject.length === filesBefore.length, {
    sebelum: filesBefore.length,
    sesudah: filesAfterReject.length,
  });

  /* ---- Langkah 3: absen masuk tanpa QR */
  heading('Langkah 3: absen masuk tanpa QR (SUNGGUHAN)');
  const inRes = await send({ ...here, selfie: `data:image/jpeg;base64,${b64(good)}` });
  console.log(`HTTP ${inRes.status}: ${JSON.stringify(inRes.body)}`);
  const inData = inRes.body?.data ?? inRes.body;
  check(`absen masuk tanpa QR: sukses (HTTP ${inRes.status}; 201 = baris baru dibuat)`, inRes.status === 201 || inRes.status === 200, { status: inRes.status, code: code(inRes) });
  if (inRes.status !== 201 && inRes.status !== 200) {
    console.log('Absen masuk gagal, uji dihentikan. Tempel hasil di atas.');
    process.exitCode = 1;
    return;
  }
  attendanceId = Number(inData.attendanceId);
  check('respons method = NO_QR', inData.method === 'NO_QR', inData.method);
  const respText = JSON.stringify(inRes.body).toLowerCase();
  check('respons TIDAK memuat review_status/reviewStatus (rahasia dari karyawan)', !respText.includes('reviewstatus') && !respText.includes('review_status'));
  }

  const row1 = await attendanceRow(attendanceId);
  if (reviewOnly) {
    console.log(
      `Info (--review-only): check_out_method ${row1?.outM ?? '(NULL)'}, check_out_at ${row1?.outAt ? new Date(row1.outAt).toISOString() : '(kosong)'}.`,
    );
  }
  check('DB: check_in_method = NO_QR', row1?.inM === 'NO_QR', row1?.inM);
  check('DB: risk_flags memuat NO_QR', String(row1?.flags ?? '').split(',').includes('NO_QR'), row1?.flags);
  check('DB: review_status NOT_REQUIRED atau PENDING (hasil undian)', ['NOT_REQUIRED', 'PENDING'].includes(row1?.rs), row1?.rs);
  console.log(`   (review_status hasil undian: ${row1?.rs})`);
  const rsAfterIn = String(row1?.rs);

  const s1 = await selfieRows(attendanceId);
  const inRows = s1.filter((s) => s.jenis === 'IN');
  check('DB: tepat 1 baris selfie jenis IN', inRows.length === 1, s1.map((s) => s.jenis));
  const inSelfie = inRows[0];
  if (inSelfie) {
    const p = join(SELFIE_DIR, String(inSelfie.fileRef));
    check(`disk: file ${inSelfie.fileRef} ada di ${SELFIE_DIR}`, existsSync(p), 'tidak ada; server mungkin dijalankan dari folder lain');
    if (existsSync(p)) {
      check(
        'disk: ukuran file sesuai (sama dengan yang dikirim; mode --resume: minimal 200 byte)',
        resume ? statSync(p).size >= 200 : statSync(p).size === good.length,
        { disk: statSync(p).size },
      );
      const head = readFileSync(p).subarray(0, 3);
      check('disk: file berawal FF D8 FF', head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff);
    }
    const days = (new Date(inSelfie.expiresAt).getTime() - new Date(inSelfie.capturedAt).getTime()) / 86_400_000;
    check('expires_at = captured_at + 30 hari', Math.abs(days - 30) < 0.01, days);
  }
  check(
    resume ? 'jumlah file selfie di disk >= jumlah baris selfie di DB' : 'jumlah file selfie di disk bertambah 1',
    resume ? filesNow().length >= s1.length : filesNow().length === filesBefore.length + 1,
    { sebelum: filesBefore.length, sekarang: filesNow().length, barisDB: s1.length },
  );

  /* ---- Langkah 4: absen pulang tanpa QR */
  if (reviewOnly) {
    console.log('\nLangkah 4 dilewati (--review-only): pulang tanpa QR TIDAK terbukti di jalankan ini.');
  } else {
  heading('Langkah 4: absen pulang tanpa QR (SUNGGUHAN)');
  const outGood = fakeJpeg(450);
  const outRes = await call('POST', '/attendance/check-out', {
    token: emp.token,
    device: deviceId,
    body: { ...here, selfie: b64(outGood), earlyLeaveReason: 'LAINNYA' },
  });
  console.log(`HTTP ${outRes.status}: ${JSON.stringify(outRes.body)}`);
  const outOk = outRes.status >= 200 && outRes.status < 300;
  check(`absen pulang tanpa QR: sukses (HTTP ${outRes.status})`, outOk, { status: outRes.status, code: code(outRes) });
  if (outOk) {
    const row2 = await attendanceRow(attendanceId);
    check('DB: check_out_method = NO_QR', row2?.outM === 'NO_QR', row2?.outM);
    check('DB: risk_flags tetap memuat NO_QR (dan tidak dobel)', String(row2?.flags ?? '').split(',').filter((f) => f === 'NO_QR').length === 1, row2?.flags);
    const okRs = rsAfterIn === 'PENDING' ? row2?.rs === 'PENDING' : ['NOT_REQUIRED', 'PENDING'].includes(row2?.rs);
    check('DB: review_status tidak turun/berubah liar', okRs, { sebelum: rsAfterIn, sesudah: row2?.rs });
    const s2 = await selfieRows(attendanceId);
    check('DB: ada 2 baris selfie (IN dan OUT)', s2.length === 2 && s2.some((s) => s.jenis === 'IN') && s2.some((s) => s.jenis === 'OUT'), s2.map((s) => s.jenis));
    check(
      resume ? 'jumlah file selfie di disk bertambah 1 sejak skrip ini mulai (file OUT)' : 'jumlah file selfie di disk bertambah 2 dari awal',
      filesNow().length === filesBefore.length + (resume ? 1 : 2),
      { awal: filesBefore.length, sekarang: filesNow().length },
    );
  } else {
    console.log('Pulang gagal: langkah 5 tetap lanjut memakai selfie IN saja.');
  }

  }

  const stRows = await selfieRows(attendanceId);
  mkdirSync(join(process.cwd(), 'uploads'), { recursive: true });
  const state: State = { attendanceId, selfies: stRows.map((s) => ({ id: Number(s.id), fileRef: String(s.fileRef) })) };
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
  console.log(`Berkas state disimpan untuk langkah 6: ${STATE_FILE}`);

  /* ---- Langkah 5: tinjauan HRD */
  heading('Langkah 5: tinjauan HRD');
  console.log(`CATATAN: review_status absen ${attendanceId} di-UPDATE langsung di DB menjadi PENDING (undian 10% tidak bisa dipaksa).`);
  const forcePending = () => pool.execute(`UPDATE attendance SET review_status = 'PENDING', reviewed_by = NULL, reviewed_at = NULL WHERE id = ?`, [attendanceId]);
  await forcePending();

  const empList = await call('GET', '/attendance/reviews', { token: emp.token });
  check('karyawan biasa melihat antrean: 403', empList.status === 403, empList.status);

  const hrdList = await call('GET', '/attendance/reviews', { token: hrd.token });
  check('HRD melihat antrean: 200', hrdList.status === 200, hrdList.status);
  const item = (hrdList.body?.data ?? []).find((x: any) => Number(x.attendanceId) === attendanceId);
  check('absen uji ada di antrean', !!item);
  check('antrean: riskFlags memuat NO_QR', Array.isArray(item?.riskFlags) && item.riskFlags.includes('NO_QR'), item?.riskFlags);
  check('antrean: jumlah selfie sesuai DB', (item?.selfies?.length ?? 0) === state.selfies.length, item?.selfies?.length);

  const inRef = (item?.selfies ?? []).find((s: any) => s.jenis === 'IN');
  if (inRef) {
    const empSelfie = await call('GET', `/attendance/selfies/${inRef.id}`, { token: emp.token });
    check('karyawan biasa membuka selfie: 403', empSelfie.status === 403, empSelfie.status);
    const sf = await fetchSelfie(hrd.token, Number(inRef.id));
    check('HRD membuka selfie IN: 200', sf.status === 200, sf.status);
    check('Content-Type image/jpeg', sf.type.includes('image/jpeg'), sf.type);
    check('Cache-Control no-store', sf.cache.includes('no-store'), sf.cache);
    const diskRef = state.selfies.find((s) => s.id === Number(inRef.id))?.fileRef;
    const expected = !resume ? good : diskRef && existsSync(join(SELFIE_DIR, diskRef)) ? readFileSync(join(SELFIE_DIR, diskRef)) : Buffer.alloc(0);
    check(
      resume ? 'isi byte sama persis dengan file di disk' : 'isi byte sama persis dengan yang dikirim',
      expected.length > 0 && sf.buf.equals(expected),
      { diterima: sf.buf.length, pembanding: expected.length },
    );
  } else {
    check('ada selfie IN di antrean untuk dibuka', false);
  }
  const nf = await call('GET', '/attendance/selfies/999999999', { token: hrd.token });
  check('selfie tidak ada: 404', nf.status === 404, nf.status);

  const bad = await call('POST', `/attendance/${attendanceId}/review`, { token: hrd.token, body: { keputusan: 'ASAL' } });
  check('keputusan tidak dikenal: 400', bad.status === 400, { status: bad.status, code: code(bad) });

  // Putaran 1: MENCURIGAKAN
  const m1 = await call('POST', `/attendance/${attendanceId}/review`, { token: hrd.token, body: { keputusan: 'MENCURIGAKAN' } });
  check('HRD tandai MENCURIGAKAN: 200', m1.status === 200 && m1.body?.data?.reviewStatus === 'MENCURIGAKAN', { status: m1.status, body: m1.body });
  const rowM = await attendanceRow(attendanceId);
  check('DB: review_status = MENCURIGAKAN', rowM?.rs === 'MENCURIGAKAN', rowM?.rs);
  check('DB: reviewed_by dan reviewed_at terisi', rowM?.rb != null && rowM?.ra != null, { reviewedBy: rowM?.rb, reviewedAt: rowM?.ra });
  const auM = await lastAudit(attendanceId);
  check('audit log ATTENDANCE_REVIEW tercatat (after = MENCURIGAKAN)', !!auM && asText(auM.afterJson).includes('MENCURIGAKAN'), auM ? asText(auM.afterJson) : 'tidak ada baris');

  // Putaran 2: SESUAI (reset ke PENDING lewat DB)
  console.log('CATATAN: review_status di-UPDATE langsung di DB menjadi PENDING lagi untuk putaran kedua.');
  await forcePending();
  const m2 = await call('POST', `/attendance/${attendanceId}/review`, { token: hrd.token, body: { keputusan: 'SESUAI' } });
  check('HRD tandai SESUAI: 200', m2.status === 200 && m2.body?.data?.reviewStatus === 'SESUAI', { status: m2.status, body: m2.body });
  const rowS = await attendanceRow(attendanceId);
  check('DB: review_status = SESUAI', rowS?.rs === 'SESUAI', rowS?.rs);
  const auS = await lastAudit(attendanceId);
  check('audit log (after = SESUAI)', !!auS && asText(auS.afterJson).includes('SESUAI'), auS ? asText(auS.afterJson) : 'tidak ada baris');
  const m3 = await call('POST', `/attendance/${attendanceId}/review`, { token: hrd.token, body: { keputusan: 'SESUAI' } });
  check('meninjau ulang yang sudah ditinjau: 409', m3.status === 409, { status: m3.status, code: code(m3) });
  const after = await call('GET', '/attendance/reviews', { token: hrd.token });
  const still = (after.body?.data ?? []).some((x: any) => Number(x.attendanceId) === attendanceId);
  check('setelah ditinjau, absen keluar dari antrean', !still);

  console.log(`\n${pass} lolos, ${fail} gagal.`);
  console.log('Berikutnya (langkah 6): npx tsx scripts/try-noqr.ts --backdate');
  process.exitCode = fail === 0 ? 0 : 1;
}

async function main() {
  if (flag('backdate')) return modeBackdate();
  if (flag('verify-purge')) return modeVerifyPurge();
  return modeFull(flag('resume') || flag('review-only'));
}

main()
  .catch((e) => {
    console.error('Skrip gagal jalan. Server sudah hidup (npm run dev)?', e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
