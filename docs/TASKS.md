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
- [x] `auth.tsx`: token hanya dihapus bila `GET /auth/me` membalas 401 (sekarang 500 atau jaringan putus ikut melempar ke login)
- [ ] Schedule: kartu "Libur rotasi" menyesatkan untuk bulan tanpa roster; ganti nilai px dengan token; judul bulan patah di lebar HP
- [ ] `ui/Button.tsx`: variant danger/success memakai hex dan `text-[13px]` (lama)
- [x] Audit `npm audit` client (20 Okt 2026): 7 peringatan (2 moderate, 5 high), semuanya dari rantai `tailwindcss` v3 (`braces`, `chokidar`, `micromatch`, `fast-glob`, `postcss-nested`, `postcss-selector-parser`), bukan dari `jsqr` atau `qrcode.react`. Alat build, bukan kode di browser. Satu-satunya perbaikan npm adalah lompat ke Tailwind 4 (breaking, melanggar aturan proyek Tailwind v3), jadi sengaja dibiarkan. Jangan `npm audit fix --force`
- [ ] docs: bagian A (komponen Alert, termasuk tone sukses) di `design.md`; selisih tinggi input (`inputCls` 44 vs design.md 9.4 = 48); log server masih mencetak "[daily-close] TODO" (Fase 4)
- [ ] Dropdown alasan pulang dan labelnya disalin dari server (`earlyLeave.ts`); kalau server menambah alasan, client harus ikut
- [x] Hapus `client/src/pages/Home.tsx` (tidak dipakai) lewat `git rm`
- [x] `RequireRole`: peran yang tidak berhak diarahkan ke `/beranda` (sebelumnya `/jadwal`)
- [ ] Keputusan bisnis (belum diputuskan): status absen tetap `TELAT` saat telat lalu pulang awal; apakah status "pulang cepat" perlu tampil juga

### Fase 2b: Absen tanpa QR (selfie) (disetujui secara konsep, SETELAH C2; rincian belum final)
- [ ] Perbarui `docs/alur.md` bagian 7 dan 8 lebih dulu (jalur tanpa QR: GPS + selfie langsung dari kamera, jam server, status "menunggu tinjauan", flag risiko; tinjauan HRD Sesuai/Mencurigakan tanpa mengubah jam absen; koreksi lewat pengajuan + audit log)
- [ ] Server: `qr` menjadi opsional di `attendance.schema.ts` dan `presence.ts` (`assertPresence`), tabel/kolom selfie + status tinjauan (migrasi baru), unggah selfie aman
- [ ] Client: kamera selfie langsung (tanpa pilih file galeri), alur "absen tanpa QR" di Beranda
- [ ] Client + server: layar tinjauan HRD; absen yang belum ditinjau diselesaikan/diberi tanda sebelum periode dikunci (usulan, belum final)
- Catatan: pencocokan wajah otomatis bukan bagian ini (data biometrik, UU PDP). Fake GPS tetap keterbatasan jujur web (dilapisi QR dinamis bila ada, device binding, flag risiko). Fingerprint mesin = sistem terpisah

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
- [ ] Rule risiko sederhana (koordinat identik berulang, dll) + `risk_flags`
- [ ] Prediksi absensi (WMA, sambungkan dengan pengalaman skripsi)
- [ ] Integrasi maintenance-system (satu login, mekanik cuti tidak bisa ditugaskan)
- [ ] Deploy + README (screenshot, penjelasan keterbatasan, label data simulasi)
