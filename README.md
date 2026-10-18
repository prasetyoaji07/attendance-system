# Sistem Absensi

Sistem absensi pabrik dengan shift lintas hari, geofencing GPS, QR dinamis, device binding, approval berjenjang, lembur, dan rekap payroll-ready.

> Seluruh data dan aturan (toleransi, lembur, cuti) adalah **simulasi** untuk portofolio, bukan regulasi resmi.

**Stack:** React + TypeScript + Tailwind, Node.js + Express + TypeScript, MySQL (TiDB Cloud), JWT.

## Mulai cepat

Prasyarat: Node.js LTS (20+) dan database MySQL/TiDB.

```bash
npm run setup
(Windows: copy server\.env.example server\.env | Mac/Linux: cp server/.env.example server/.env)
```

- Web: http://localhost:5173
- API: http://localhost:3001/api/health

## Perintah

| Perintah | Fungsi |
|---|---|
| `npm run dev` | Jalankan API dan web bersamaan |
| `npm test` | Unit test server |
| `npm run typecheck` | Cek tipe server dan client |
| `npm run migrate` | Jalankan migration SQL |
| `npm run seed` | Isi data simulasi (50 karyawan, roster 12 bulan, absen historis). Aman diulang |
| `npm run seed:dry` | Lihat rencana dan ringkasan seed tanpa menyentuh database |
| `npm run build` | Build produksi |

## Data simulasi

`npm run seed` mengisi 50 karyawan fiktif (NIK berawalan `SIM`, password bawaan `simulasi123`, ubah lewat `SEED_PASSWORD`), 5 divisi, roster 12 bulan, dan absen historis dengan pola telat berbeda per divisi supaya grafik dashboard punya isi. Koordinat check-in dibuat acak di dalam radius lokasi fiktif, bukan lokasi orang sungguhan. Jangan jalankan di lingkungan sungguhan (seed menolak jalan di `NODE_ENV=production` kecuali `SEED_FORCE=true`).

## Dokumentasi

- [`docs/alur.md`](docs/alur.md): arsitektur, database, flow, aturan bisnis
- [`docs/design.md`](docs/design.md): design system
- [`docs/TASKS.md`](docs/TASKS.md): roadmap dan progres

## Keterbatasan

Aplikasi web tidak bisa mendeteksi fake GPS. Karena itu verifikasi dilapisi QR dinamis, device binding, dan flag risiko. Lokasi hanya diambil saat absen, tidak dilacak terus-menerus.
