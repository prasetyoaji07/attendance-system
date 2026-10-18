# Sistem Absensi

Sistem absensi pabrik dengan shift lintas hari, geofencing GPS, QR dinamis, device binding, approval berjenjang, lembur, dan rekap payroll-ready.

> Seluruh data dan aturan (toleransi, lembur, cuti) adalah **simulasi** untuk portofolio, bukan regulasi resmi.

**Stack:** React + TypeScript + Tailwind, Node.js + Express + TypeScript, MySQL (TiDB Cloud), JWT.

## Mulai cepat

Prasyarat: Node.js LTS (20+) dan database MySQL/TiDB.

```bash
# Windows: klik dua kali setup.bat   |   Mac/Linux: ./setup.sh
# lalu isi koneksi DB di server/.env
npm run migrate
npm run dev
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
| `npm run build` | Build produksi |

## Dokumentasi

- [`docs/alur.md`](docs/alur.md): arsitektur, database, flow, aturan bisnis
- [`docs/design.md`](docs/design.md): design system
- [`docs/TASKS.md`](docs/TASKS.md): roadmap dan progres
- [`CLAUDE.md`](CLAUDE.md): panduan untuk melanjutkan pengembangan dengan Claude

## Keterbatasan

Aplikasi web tidak bisa mendeteksi fake GPS. Karena itu verifikasi dilapisi QR dinamis, device binding, dan flag risiko. Lokasi hanya diambil saat absen, tidak dilacak terus-menerus.
