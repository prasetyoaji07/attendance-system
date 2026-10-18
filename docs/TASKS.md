# Daftar Tugas

Centang saat selesai. Urutan penting: fase berikutnya bergantung pada fase sebelumnya.

## Fase 0: Setup (selesai oleh scaffold)
- [x] Struktur folder, config TS, env, middleware dasar
- [x] Token desain + Button 3D + halaman uji (Home)
- [x] `haversine.ts` dan `hmac-qr.ts` + unit test
- [x] Migration runner (`npm run migrate`)
- [ ] Isi `server/.env` dan pastikan `/api/health` menunjukkan `db: ok`
- [ ] Commit pertama (docs + scaffold)

## Fase 1: Fondasi (master data, shift, roster, engine status)
- [ ] `database/migrations/001_init.sql`: semua tabel master + `rosters`, `attendance`, `audit_logs` (lihat alur.md bagian 5)
- [ ] `utils/shift-time.ts`: `buildShiftWindow`, `pickActiveRoster`, `calcLateMinutes` (TDD, termasuk shift malam)
- [ ] Modul `auth`: login JWT, hash password, `GET /auth/me`
- [ ] Modul `employees`, `locations`, `shifts` (CRUD + validasi zod + RBAC)
- [ ] Modul `roster`: generate dari `shift_patterns`, validasi jeda >= 11 jam
- [ ] Fungsi status harian (pure) + test aturan bisnis 1-4
- [ ] `scripts/seed.ts`: ~50 karyawan, 3 bulan roster (label "data simulasi")
- [ ] Client: login, AppShell (sidebar desktop + bottom nav mobile), halaman Jadwal

## Fase 2: Check-in
- [ ] Endpoint `POST /attendance/check-in` sesuai flow alur.md 7.1
- [ ] Check-out + auto-close
- [ ] Endpoint QR dinamis per lokasi (layar yang ditampilkan di lokasi)
- [ ] Device binding (daftar, pending, approval ganti device)
- [ ] Client: komponen `AttendanceButton` (tombol Absen 3D, 4 state) + chip jarak/akurasi
- [ ] Client: scan QR (kamera) + Geolocation API
- [ ] Beranda Karyawan (referensi visual halaman lain)

## Fase 3: Workflow dan Pengajuan
- [ ] Tabel + modul `workflow` (templates, steps) dan state machine request
- [ ] Cuti: validasi saldo, bentrok roster, kuota divisi; potong saldo saat APPROVED
- [ ] Izin, sakit, tukar shift, koreksi absen (pakai engine yang sama)
- [ ] Lembur: pengajuan + hitung irisan jam + pengali dari tabel aturan
- [ ] Client: form pengajuan, timeline approval, halaman approval untuk Foreman/SPV/HRD

## Fase 4: Cron dan Payroll
- [ ] `jobs/daily-close.ts` (alpa otomatis, auto-close, idempotent)
- [ ] Periode: cek request menggantung, LOCK, adjustment berlog
- [ ] Export Excel rekap (exceljs): hadir, telat, alpa, lembur, rapi dan berformat
- [ ] Test aturan bisnis 5-7 dan 10

## Fase 5: Dashboard, Risiko, Integrasi
- [ ] Dashboard HRD: kehadiran, heatmap telat, tren per divisi, lembur vs anggaran
- [ ] Rule risiko sederhana (koordinat identik berulang, dll) + `risk_flags`
- [ ] Prediksi absensi (WMA, sambungkan dengan pengalaman skripsi)
- [ ] Integrasi maintenance-system (satu login, mekanik cuti tidak bisa ditugaskan)
- [ ] Deploy + README (screenshot, penjelasan keterbatasan, label data simulasi)
