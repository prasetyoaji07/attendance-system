# CLAUDE.md: Sistem Absensi

Panduan untuk Claude (atau developer mana pun) yang melanjutkan proyek ini. **Baca seluruh file ini dulu.**

## Konteks
Sistem absensi pabrik (shift, geofencing, QR dinamis, approval berjenjang, lembur, payroll-ready) sebagai proyek portofolio.
Pemilik: Prasetyo Aji (lulusan Informatika, target IT Support / Web Developer / Data). Proyek ini akan **diintegrasikan dengan maintenance-system miliknya** (satu login, satu data karyawan).
Semua data adalah **simulasi**. Tulis ini di README dan seed.

## Urutan baca wajib
1. `docs/alur.md`: arsitektur, database, flow, aturan bisnis, asumsi angka (**sumber kebenaran logika**)
2. `docs/design.md`: design system (**sumber kebenaran tampilan**)
3. `docs/TASKS.md`: daftar tugas per fase (centang saat selesai)

Jika kode dan dokumen bertentangan, **tanyakan ke pemilik**, lalu perbarui dokumennya. Jangan diam-diam menyimpang.

## Stack
- Server: Node.js + Express 5 + TypeScript (CommonJS), MySQL via `mysql2` (TiDB Cloud / MySQL lokal), JWT, zod 4, node-cron, exceljs, dayjs, vitest
- Client: React 18+ + Vite + TypeScript, Tailwind CSS **v3**, React Router, TanStack Query, lucide-react
- Alias client: `@/` = `client/src/`

## Perintah
```
npm run setup        # install semua (atau jalankan setup.bat di Windows)
npm run dev          # API :3001 + web :5173 (proxy /api)
npm test             # unit test server (vitest)
npm run typecheck    # server + client
npm run migrate      # jalankan database/migrations/*.sql berurutan
npm run seed         # seed data simulasi (belum dibuat)
```
Cek cepat: `GET http://localhost:3001/api/health`. Setiap modul punya `GET /api/<modul>/_ping` (stub, hapus saat modul diisi).

## Struktur
```
server/src/core/       config (zod env), db (pool + withTransaction), errors (AppError), rules (konstanta bisnis),
                       roles (enum), audit, middleware (auth, rbac, validate, error)
server/src/modules/*/  <nama>.routes.ts -> controller -> service -> repository
server/src/utils/      haversine.ts, hmac-qr.ts (sudah dites), shift-time.ts (TODO fase 1)
server/src/jobs/       cron (daily-close = TODO fase 4)
server/src/tests/      unit test
database/migrations/   file .sql bernomor (001_..., 002_...)
client/src/features/   satu folder per fitur (mirror modul server)
client/src/components/ui/  komponen dasar sesuai design.md (Button sudah ada)
client/src/styles/tokens.css  token desain (diambil dari design.md)
```

## Aturan kode: server
1. **Logika bisnis hanya di `service`.** Controller tipis (parse, panggil service, kirim respons). Repository hanya query SQL.
2. **Fungsi hitung harus pure** (tanpa DB) dan di-unit-test: telat, shift malam, lembur, saldo cuti, jendela check-in.
3. **TDD untuk aturan bisnis**: ubah `it.todo` di `src/tests/attendance-rules.test.ts` jadi test nyata dulu, baru implementasi.
4. **Validasi semua input dengan zod** lewat `validate(schema, 'body'|'query'|'params')`. Hasil ada di `res.locals.body` / `.query` / `.params` (bukan `req.query`, read-only di Express 5).
5. **Validasi di backend, jangan percaya frontend**, termasuk jarak geofence dan akurasi GPS.
6. **Query selalu parameterized** (`?`). Jangan pernah menyambung string SQL dari input.
7. **Aksi multi-tabel pakai `withTransaction`.** Cegah double submit dengan UNIQUE constraint (contoh: `rosters` UNIQUE(employee_id, shift_date), `attendance` UNIQUE(roster_id)).
8. **Error pakai `AppError`** (`AppError.conflict(...)`, dll). Pesan error berbahasa Indonesia, ramah, memberi solusi.
9. **Aksi sensitif wajib `writeAudit`**: koreksi absen, tutup periode, ganti device, ubah master, approval.
10. **Waktu**: simpan UTC di DB. Aturan shift dan tampilan memakai WIB (`Asia/Jakarta`). Shift malam dihitung ke `shift_date` hari MULAINYA.
11. **Angka aturan dari `core/rules.ts`**, jangan hardcode di service.
12. **RBAC di middleware** (`requireAuth`, `requireRole`), bukan sekadar menyembunyikan menu.
13. Password hash dengan `bcryptjs`. Jangan log data sensitif (password, token, koordinat mentah di log umum).

## Aturan kode: client
1. **Semua gaya wajib memakai token** dari `design.md` (kelas Tailwind yang sudah dipetakan di `tailwind.config.ts`). Dilarang hex, px, atau bayangan "asal".
2. **Jangan ubah `tokens.css` / `tailwind.config.ts` sembarangan.** Perlu nilai baru? Tambahkan ke `design.md` dulu, lalu sinkronkan.
3. Satu tombol `primary` per layar. Efek 3D hanya untuk tombol aksi, tombol Absen, `card-hero`.
4. Status absensi memakai peta di `design.md` bagian 2.4 (warna + ikon + teks, bukan warna saja).
5. Mobile-first. Area sentuh minimal 44 px. Tabel jadi daftar kartu di mobile.
6. Wajib ada state **loading (skeleton), empty, dan error** di tiap halaman data.
7. Panggil API lewat `src/lib/api.ts` + TanStack Query. Teks UI bergaya santai ("kamu", kalimat pendek).
8. Hormati `prefers-reduced-motion`. Cek mode gelap untuk tiap halaman baru.
9. Browser storage (localStorage) boleh dipakai di app ini (ini bukan artifact Claude.ai).

## Aturan bisnis kritis (detail: docs/alur.md bagian 7 dan 8)
- Check-in: JWT -> device -> roster aktif (cek hari ini dan kemarin, jendela mulai-2j s/d selesai+2j) -> belum check-in -> accuracy <= 50 m -> Haversine <= radius -> QR valid -> hitung telat -> simpan (transaksi) -> flag risiko.
- Telat = `max(0, now - (jam_mulai + toleransi))`.
- Workflow approval **generik dan configurable** (`workflow_templates`, `workflow_steps`). Jangan hardcode Foreman -> SPV -> HRD.
- Periode `LOCKED` tidak boleh diubah langsung, hanya lewat adjustment + audit log.
- Lembur dibayar = irisan(jam disetujui, jam absen aktual) x pengali dari tabel aturan.
- Koreksi absen lewat pengajuan, bukan edit langsung.

## Cara bekerja (penting)
- Kerjakan **satu fase / satu modul per sesi**. Ikuti urutan di `docs/TASKS.md`.
- Sebelum menulis kode: sebutkan rencana singkat dan file yang akan disentuh.
- Setelah selesai: jalankan `npm run typecheck` dan `npm test`, centang tugas di `docs/TASKS.md`, ringkas perubahan.
- Jika skema atau alur berubah, **perbarui `docs/alur.md`** di commit yang sama.
- Jangan menambah dependency besar tanpa alasan. Yang diperkirakan nanti: `leaflet` + `react-leaflet` (peta admin), `recharts` (grafik dashboard), `vite-plugin-pwa` (PWA).
- Keterbatasan jujur yang harus tertulis di README: web tidak bisa mendeteksi fake GPS (dilapisi QR dinamis, device binding, flag risiko). Aturan lembur/cuti adalah simulasi.

## Prompt awal yang disarankan
> Baca CLAUDE.md, docs/alur.md, docs/design.md, dan docs/TASKS.md. Mulai **Fase 1** dari tugas pertama yang belum dicentang.
> Tulis rencana singkat dulu, lalu migration 001 (DDL lengkap fase 1), lalu fungsi di `shift-time.ts` dengan TDD.
