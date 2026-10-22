# Daftar Tugas

Centang saat selesai. Urutan penting: fase berikutnya bergantung pada fase sebelumnya.

## Fase 0: Setup (selesai oleh scaffold)
- [x] Struktur folder, config TS, env, middleware dasar
- [x] Token desain + Button 3D + halaman uji (Home)
- [x] `haversine.ts` dan `hmac-qr.ts` + unit test
- [x] Migration runner (`npm run migrate`)
- [x] Isi `server/.env` dan pastikan `/api/health` menunjukkan `db: ok`
- [x] Commit pertama (docs + scaffold)

## Fase 1: Fondasi (master data, shift, roster, engine status)
- [x] `database/migrations/001_init.sql`: semua tabel master + `rosters`, `attendance`, `audit_logs` (lihat alur.md bagian 5)
- [x] `utils/shift-time.ts`: `buildShiftWindow`, `pickActiveRoster`, `calcLateMinutes` (TDD, termasuk shift malam)
- [x] Modul `auth`: login JWT, hash password, `GET /auth/me` (device binding menyusul di Fase 2)
- [x] Modul `employees`, `locations`, `shifts` (CRUD + validasi zod + RBAC; karyawan dinonaktifkan, bukan dihapus; termasuk divisi)
- [x] Modul `roster`: generate dari `shift_patterns`, validasi jeda >= 11 jam (+ pola shift, daftar jadwal; tukar shift menyusul di Fase 3)
- [x] Fungsi status harian (pure, `utils/daily-status.ts`) + test aturan bisnis 1-4 (aturan 5-7 dan 10 menunggu modulnya)
- [x] `scripts/seed.ts`: 50 karyawan, 5 divisi, roster 12 bulan ke belakang + 30 hari ke depan (~14 ribu baris) + absen historis dengan profil telat per divisi (label "data simulasi"). Kode di `utils/seed-attendance.ts`, `utils/seed-data.ts` (+ tes); sudah dijalankan lewat `npm run seed`
- [x] Client: login, AppShell (sidebar desktop + bottom nav mobile), halaman Jadwal

## Fase 2: Check-in
- [x] Endpoint `POST /attendance/check-in` sesuai flow alur.md 7.1
- [x] Check-out + auto-close (`POST /attendance/check-out`, `jobs/auto-close.ts`; cron 15 menit: kode ada, tick nyata di server belum terbukti)
- [x] Endpoint QR dinamis per lokasi: `GET /locations/:id/qr` (HRD/ADMIN). Halaman layarnya ada di item client "QR Lokasi" di bawah
- [x] Device binding (daftar, pending, approval ganti device): `/devices/*` + guard header `X-Device-Id` di check-in/check-out (migrasi 003). Terbukti lewat HTTP + TiDB asli (`scripts/try-devices.ts`, 30 pemeriksaan). Check-in sungguhan dengan header perangkat pada shift aktif sudah terbukti lewat layar (lihat item scan QR). Belum dicoba: pengecekan baris `audit_logs` aksi `DEVICE_*`
- [x] Client: daftar perangkat setelah login (UUID acak di localStorage, kirim header `X-Device-Id`) + halaman antrean persetujuan perangkat untuk HRD/ADMIN. Terbukti di browser + TiDB asli: antrean, setujui, tolak, dialog di HP dan desktop, state kosong, tombol Setujui nonaktif untuk perangkat HRD sendiri, menu Perangkat tersembunyi untuk karyawan. Belum terbukti: ID perangkat tetap sama setelah ganti akun, banner "Perangkat belum terdaftar", skeleton dan error halaman Perangkat, dialog mode terang, route /perangkat diblokir untuk karyawan, pesan 403/404/409
- [x] Endpoint `GET /attendance/today` (C0): status Beranda (NO_SCHEDULE, UPCOMING, NOT_CHECKED_IN, CHECKED_IN, CHECKED_OUT, AUTO_CLOSED) dari jendela roster yang sama dengan check-in. Lolos tes dan typecheck. Terbukti lewat HTTP + TiDB asli (`scripts/try-today.ts`, 9 pemeriksaan) untuk 401 dan status UPCOMING. Lewat layar dengan data asli juga terbukti NOT_CHECKED_IN, CHECKED_IN, CHECKED_OUT. Belum terbukti dengan data asli: NO_SCHEDULE dan AUTO_CLOSED (tercakup tes unit)
- [x] C0b: check-out wajib alasan jika pulang sebelum jam selesai (`earlyLeaveReason`, 5 kode dropdown, kolom `attendance.early_leave_reason`, migrasi 004). Lolos typecheck dan tes. Terbukti lewat layar + TiDB asli: check-out SIM0014 dengan alasan URUSAN_KELUARGA, `early_leave_minutes` 428, alasan tersimpan (dibaca dengan `scripts/check-early-reason.ts`, 20 Okt 2026). Belum terbukti lewat HTTP asli: alasan lain, dan penolakan EARLY_LEAVE_REASON_REQUIRED (tercakup tes unit)
- [x] Client: halaman QR Lokasi (B, HRD/ADMIN): pemilih lokasi, QR SVG (`qrcode.react`), hitung mundur, refresh otomatis. Terbukti di browser: QR tampil dan berganti sendiri, dipakai untuk uji scan. Belum terbukti: skeleton dan error halaman ini
- [x] Client: komponen `AttendanceButton` (tombol Absen 3D; state ready, locating, outside, weak, sending, done, idle) + chip jarak/akurasi. Terbukti di browser: Mencari lokasi, Di luar area, GPS lemah, siap, Pilih alasan dulu, Sudah pulang, mode gelap dan terang
- [x] Client: scan QR (kamera, paket `jsqr`) + Geolocation API + kirim check-in/check-out (C2). Terbukti di browser dan TiDB asli: scan layar QR Lokasi dari HP lewat kamera laptop, check-in SIM0014 (telat 40 menit), check-out dengan alasan. Belum terbukti: jalur gagal di layar (QR kedaluwarsa, QR lokasi lain, GPS lemah saat kirim), pemindai dari kamera HP lewat HTTPS
- [x] Beranda Karyawan (C1 + C2) dan komponen `ui/Select` (bottom sheet di HP, popover di desktop; dropdown alasan pulang awal). Belum terbukti dengan data asli: UPCOMING, AUTO_CLOSED, NO_SCHEDULE

### Sisa koreksi Fase 2 (belum dikerjakan)
- [x] `auth.tsx`: token hanya dihapus bila `GET /auth/me` membalas 401 (sekarang 500 atau jaringan putus ikut melempar ke login). Terbukti di browser: API mati (502) dengan token ada memunculkan layar "Sesimu belum bisa dimuat", token tidak terhapus; setelah API menyala, login lalu Beranda normal. Belum terbukti: klik "Coba lagi" dengan token asli sampai Beranda; token palsu lalu "Coba lagi" mengarah ke login
- [x] Schedule: kartu "Libur rotasi" menyesatkan untuk bulan tanpa roster; ganti nilai px dengan token; judul bulan patah di lebar HP. Commit cf6df65: statistik "–" bila roster kosong, ukuran ke token, judul bulan tidak patah. Lolos typecheck, belum terbukti di browser. Sisa kecil: panel "Detail hari" di bulan tanpa roster masih menulis "Libur sesuai rotasi, tidak ada shift."
- [x] `ui/Button.tsx`: variant danger/success memakai hex dan `text-[13px]` (lama). Diganti saat tombol dirombak datar: commit 9390144 (tanpa hex, gradien, dan sisi tebal) dan 3c97db3 (hover primary `hover:bg-primary-700`). Lolos typecheck, belum terbukti di browser
- [x] Audit `npm audit` client (20 Okt 2026): 7 peringatan (2 moderate, 5 high), semuanya dari rantai `tailwindcss` v3 (`braces`, `chokidar`, `micromatch`, `fast-glob`, `postcss-nested`, `postcss-selector-parser`), bukan dari `jsqr` atau `qrcode.react`. Alat build, bukan kode di browser. Satu-satunya perbaikan npm adalah lompat ke Tailwind 4 (breaking, melanggar aturan proyek Tailwind v3), jadi sengaja dibiarkan. Jangan `npm audit fix --force`
- [x] docs: komponen Alert (termasuk tone sukses) sudah ada di `design.md` 9.12 (selisih tinggi input 44 vs 48 sudah beres: design.md 9.4 kini 44, sesuai `inputCls`). `jobs/daily-close.ts` kini hanya kerangka yang mencetak "dilewati: penutupan harian belum dibuat (Fase 4)", bukan "TODO"; isi job-nya tetap Fase 4 (lihat item `jobs/daily-close.ts`). Tampilan di log server nyata belum diperiksa
- [x] Dropdown alasan pulang dan labelnya disalin dari server (`earlyLeave.ts`); kalau server menambah alasan, client harus ikut. Dijaga `server/src/tests/early-leave-sync.test.ts` (membandingkan kode, urutan, dan label dengan file client). Terbukti: `npm test` 22 Okt 2026 = 377 lulus + 4 todo, termasuk tes itu
- [x] Hapus `client/src/pages/Home.tsx` (tidak dipakai) lewat `git rm`
- [x] `RequireRole`: peran yang tidak berhak diarahkan ke `/beranda` (sebelumnya `/jadwal`)
- [x] Keputusan bisnis (diputuskan 22 Okt 2026): status hari itu tetap `TELAT` saat telat lalu pulang awal (prioritas TELAT > PULANG_CEPAT > HADIR di `daily-status.ts`), dan "Pulang cepat" tampil sebagai lencana tambahan di Beranda (sudah ada di kode). Belum terbukti di layar: kedua lencana tampil bersamaan. Sisa: rekap Excel (Fase 4) dan dashboard (Fase 5) harus memuat kolom menit pulang cepat
- [x] Dua `<select>` bawaan diganti ke `ui/Select`: `LocationQr.tsx` (commit 974a382) dan `Schedule.tsx` (commit cf6df65). Lolos typecheck, belum terbukti di browser (daftar berupa bottom sheet di HP belum dicek; pilihan lokasi hanya tampil bila ada lebih dari satu lokasi)
- [x] Pesan "Terjadi kesalahan" untuk galat 502 kurang ramah (fallback di `api.ts`). Commit 56b0e88: galat 502/503/504 memakai kode `SERVER_UNAVAILABLE` dan pesan "Server sedang tidak bisa dijangkau...". Lolos typecheck, belum terbukti di browser

### Fase 2b: Absen tanpa QR (selfie) (tingkat Standar, untuk demo; rancangan di `docs/alur.md` 7.1b)
- [x] Perbarui `docs/alur.md` lebih dulu (commit ec3451b, dokumen saja): jalur tanpa QR selalu tersedia sejajar dengan scan QR, selfie langsung dari kamera, jam server, absen langsung sah, flag `NO_QR`, tinjauan HRD berbasis pengecualian (berflag risiko + sampel acak 10%, hasil tidak mengubah jam absen), bagian 2, 5.2, 7.1, 7.1b, aturan 11-14, bagian 9 dan 10
- [x] Server: `qr` opsional di `attendance.schema.ts` dan `presence.ts` (`assertPresence`); migrasi 005-011 (kolom `check_in_method`, `check_out_method`, `review_status`, `risk_flags`, `reviewed_by`, `reviewed_at` di `attendance` dan tabel `attendance_selfies`); selfie base64 JPEG divalidasi (maksimal 300.000 byte) dan disimpan di disk (`uploads/selfies`, antarmuka `SelfieStorage`); selfie dihapus setelah 30 hari (`scripts/purge-selfies.ts`); flag `NO_QR` di `risk_flags`; endpoint tinjauan HRD (`GET /attendance/reviews`, `GET /attendance/selfies/:id`, `POST /attendance/:id/review`, audit log `ATTENDANCE_REVIEW`). Commit c7ac47a, 3b31b96, 5f83e31. Lolos typecheck dan `npm test` (430 lulus + 4 todo). Terbukti lewat HTTP + TiDB asli (22 Okt 2026, `scripts/try-schema.ts` dan `scripts/try-noqr.ts`): struktur migrasi dan constraint; absen masuk tanpa QR SIM0012 (HTTP 201, `method` NO_QR, `review_status` tidak ikut respons, selfie IN tersimpan di `server/uploads/selfies`); penolakan SELFIE_REQUIRED, SELFIE_INVALID (PNG dan 300.001 byte), INVALID_QR (QR salah + selfie valid), GPS_ACCURACY_LOW, OUT_OF_RADIUS tanpa menulis apa pun; antrean tinjauan, lihat selfie (image/jpeg, no-store, isi sama dengan file di disk), 403 untuk karyawan biasa, 404, 400, tandai MENCURIGAKAN dan SESUAI, 409 saat diulang, `reviewed_by` dan `reviewed_at`, audit log; selfie kedaluwarsa 410 SELFIE_EXPIRED; `purge-selfies.ts` menghapus file dan baris. Belum terbukti: absen PULANG tanpa QR (selfie OUT dan SQL CASE/FIND_IN_SET di check-out; pulang SIM0012 tadi lewat QR); undian sampel 10% di database asli (uji memaksa PENDING lewat UPDATE); HRD ditolak meninjau absennya sendiri lewat HTTP; selfie JPEG sungguhan (uji memakai byte JPEG minimal); mode penuh `try-noqr.ts` belum pernah selesai sekali jalan (pernah salah mengharapkan HTTP 200, padahal 201), jadi langkahnya diuji lewat `--review-only`, `--backdate`, dan `--verify-purge`; apa pun di browser
- [ ] Client: kamera selfie langsung (tanpa pilih file galeri), alur "absen tanpa QR" di Beranda
- [ ] Client + server: layar tinjauan HRD. Sisi server selesai dan terbukti (lihat item Server di atas); sisi client belum dikerjakan (daftar antrean, selfie lewat fetch lalu blob, tombol Sesuai/Mencurigakan). Rancangan awal: (antrean berisi absen berflag risiko + sampel acak 10%; hasil Sesuai/Mencurigakan tidak mengubah jam absen); periode tidak bisa dikunci selama masih ada tinjauan `PENDING` (usulan, belum final)
- Catatan: tingkat Standar dipilih untuk demo. Ide pengetatan (kode sekali pakai sebelum selfie, sinyal IP sebagai flag lemah, tinjauan 100% sebagai pengaturan) belum diputuskan dan tidak dikerjakan. Pencocokan wajah otomatis bukan bagian ini (data biometrik, UU PDP). Fake GPS tetap keterbatasan jujur web (dilapisi QR dinamis bila ada, device binding, flag risiko). Fingerprint mesin = sistem terpisah

## Fase desain: tampilan putih, hitam, oranye (lintas fase)
Arah datar-modern (gaya "sisi tebal 3D" lama dihapus): putih untuk latar dan kartu, hitam untuk aksi utama dan menu aktif, oranye hemat. Ringkasan lengkap ada di `docs/design.md`.
- [x] Langkah 1, palet: `tokens.css` (commit 41da568)
- [x] Langkah 2, tombol dan menu: `tailwind.config.ts` (a1f2096), `ui/Button.tsx` (9390144, 3c97db3), `AttendanceButton.tsx` lingkaran oranye datar (3ff61e9), `AppShell.tsx` pil menu aktif, hitam di sidebar desktop dan oranye di nav bawah HP (a852a31). Lolos typecheck, belum terbukti di browser
- [x] Langkah 4, dokumen: `docs/design.md` disesuaikan dengan kode sampai a852a31 (84da477). Dokumen saja, tampilan belum terbukti di browser
- [ ] Langkah 3, gerak (framer-motion): kartu masuk bergantian, angka berhitung, pil menu bergeser, transisi halaman, hormati `prefers-reduced-motion`. SENGAJA DITUNDA sampai fungsional selesai
- [ ] Kontras: teks putih di atas `primary-500` (sekitar 2,8:1), `success` (sekitar 2,5:1), dan `danger` (sekitar 3,8:1) belum lolos; perlu token yang lebih tua
- [ ] Belum terbukti di browser (terang dan gelap): Login, Beranda, hover tombol (Masuk, Tolak/Setujui), nav bawah HP pil oranye, sidebar pil hitam, Tombol Absen datar

## Fase 3: Workflow dan Pengajuan
- [ ] Tabel + modul `workflow` (templates, steps) dan state machine request
- [ ] Cuti: validasi saldo, bentrok roster, kuota divisi; potong saldo saat APPROVED
- [ ] Izin, sakit, tukar shift, koreksi absen (pakai engine yang sama; antrean koreksi untuk absen `needs_correction`)
- [ ] Lembur: pengajuan + hitung irisan jam + pengali dari tabel aturan
- [ ] Batas check-out saat lembur disetujui harus ikut jam lembur (sekarang selesai shift + 2 jam), kalau tidak orang ditutup otomatis di tengah lembur. Lembur tidak dihitung otomatis dari belum check-out
- [ ] `SAKIT_KECELAKAAN` (alasan pulang awal) memicu flag/notifikasi (Fase 3/5). Bukan sistem tanggap darurat
- [ ] Client: form pengajuan, timeline approval, halaman approval untuk Foreman/SPV/HRD

## Fase 4: Cron dan Payroll
- [ ] `jobs/daily-close.ts` (alpa otomatis, idempotent; auto-close absen terbuka sudah di Fase 2)
- [ ] Periode: cek request menggantung, LOCK, adjustment berlog
- [ ] Export Excel rekap (exceljs): hadir, telat, alpa, lembur, rapi dan berformat
- [ ] Test aturan bisnis 5-7 dan 10

## Fase 5: Dashboard, Risiko, Integrasi
- [ ] Dashboard HRD: kehadiran, heatmap telat, tren per divisi (bulanan + tahunan, data dari seed 12 bulan), peringkat paling rajin, lembur vs anggaran
- [ ] Rule risiko sederhana (koordinat identik berulang, lokasi melompat jauh dalam waktu singkat, dll) + `risk_flags`
- [ ] Prediksi absensi (WMA, sambungkan dengan pengalaman skripsi)
- [ ] Integrasi maintenance-system (satu login, mekanik cuti tidak bisa ditugaskan)
- [ ] Deploy + README (screenshot, penjelasan keterbatasan, label data simulasi)