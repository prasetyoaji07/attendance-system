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
- [x] Endpoint QR dinamis per lokasi: `GET /locations/:id/qr` (HRD/ADMIN). Halaman layar yang menampilkannya menyusul bersama item client
- [x] Device binding (daftar, pending, approval ganti device): `/devices/*` + guard header `X-Device-Id` di check-in/check-out (migrasi 003). Terbukti lewat HTTP + TiDB asli (`scripts/try-devices.ts`, 30 pemeriksaan). Belum dicoba: check-in sungguhan dengan header perangkat pada shift aktif, dan pengecekan baris `audit_logs` aksi `DEVICE_*`
- [x] Client: daftar perangkat setelah login (UUID acak di localStorage, kirim header `X-Device-Id`) + halaman antrean persetujuan perangkat untuk HRD/ADMIN. Terbukti di browser + TiDB asli: antrean, setujui, tolak, dialog di HP dan desktop, state kosong, tombol Setujui nonaktif untuk perangkat HRD sendiri, menu Perangkat tersembunyi untuk karyawan. Belum terbukti: ID perangkat tetap sama setelah ganti akun, banner "Perangkat belum terdaftar", skeleton dan error halaman Perangkat, dialog mode terang, route /perangkat diblokir untuk karyawan, pesan 403/404/409
- [x] Endpoint `GET /attendance/today` (C0): status Beranda (NO_SCHEDULE, UPCOMING, NOT_CHECKED_IN, CHECKED_IN, CHECKED_OUT, AUTO_CLOSED) dari jendela roster yang sama dengan check-in. Lolos tes dan typecheck. Terbukti lewat HTTP + TiDB asli (`scripts/try-today.ts`, 9 pemeriksaan) untuk 401 dan status UPCOMING. Belum terbukti dengan data asli: NOT_CHECKED_IN, CHECKED_IN, CHECKED_OUT, AUTO_CLOSED (tercakup tes unit)
- [ ] Client: komponen `AttendanceButton` (tombol Absen 3D, 4 state) + chip jarak/akurasi
- [ ] Client: scan QR (kamera) + Geolocation API
- [ ] Beranda Karyawan (referensi visual halaman lain)

## Fase 3: Workflow dan Pengajuan
- [ ] Tabel + modul `workflow` (templates, steps) dan state machine request
- [ ] Cuti: validasi saldo, bentrok roster, kuota divisi; potong saldo saat APPROVED
- [ ] Izin, sakit, tukar shift, koreksi absen (pakai engine yang sama; antrean koreksi untuk absen `needs_correction`)
- [ ] Lembur: pengajuan + hitung irisan jam + pengali dari tabel aturan
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
