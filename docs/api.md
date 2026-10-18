# Referensi API (Fase 1)

Semua endpoint di bawah `/api`. Kecuali `POST /auth/login`, semuanya butuh header `Authorization: Bearer <token>`.
Respons sukses berbentuk `{ "data": ... }` (daftar karyawan: `{ data, total, page, limit }`).
Respons error berbentuk `{ "error": { "code", "message", "details?" } }`.

## Auth
| Method | Path | Akses | Keterangan |
|---|---|---|---|
| POST | `/auth/login` | publik | body `{ nik, password }` -> `{ token, user }` |
| GET | `/auth/me` | login | profil terbaru dari DB |

## Shifts
| Method | Path | Akses | Keterangan |
|---|---|---|---|
| GET | `/shifts`, `/shifts/:id` | login | |
| POST | `/shifts` | HRD, ADMIN | `{ nama, jamMulai, jamSelesai, toleransiMenit? }`. `lintasHari` dihitung otomatis. Default toleransi 5 menit |
| PATCH | `/shifts/:id` | HRD, ADMIN | parsial. Jam tidak bisa diubah jika shift sudah dipakai roster (409) |
| DELETE | `/shifts/:id` | HRD, ADMIN | ditolak (409) jika dipakai roster |

## Locations
| Method | Path | Akses | Keterangan |
|---|---|---|---|
| GET | `/locations`, `/locations/:id` | login | |
| POST | `/locations` | HRD, ADMIN | `{ nama, lat, lng, radiusM? }`. Radius 10-2000 m, default 100 |
| PATCH | `/locations/:id` | HRD, ADMIN | parsial |
| DELETE | `/locations/:id` | HRD, ADMIN | ditolak (409) jika dipakai roster |

## Divisi
| Method | Path | Akses | Keterangan |
|---|---|---|---|
| GET | `/employees/departments` | login | |
| POST | `/employees/departments` | HRD, ADMIN | `{ nama, kepalaId? }` |
| PATCH | `/employees/departments/:id` | HRD, ADMIN | parsial; `kepalaId: null` mengosongkan |

## Karyawan
| Method | Path | Akses | Keterangan |
|---|---|---|---|
| GET | `/employees` | FOREMAN, SPV, HRD, ADMIN | query: `q`, `departmentId`, `aktif=true\|false\|all` (default true), `page`, `limit` (maks 100). Cakupan: HRD/ADMIN semua, SPV divisinya, FOREMAN timnya |
| GET | `/employees/:id` | FOREMAN, SPV, HRD, ADMIN | dalam cakupan, atau diri sendiri |
| POST | `/employees` | HRD, ADMIN | membuat karyawan + akun login sekaligus: `{ nik, nama, departmentId, atasanId?, tanggalMasuk, role?, password }`. Role default EMPLOYEE |
| PATCH | `/employees/:id` | HRD, ADMIN | `{ nama?, departmentId?, atasanId?, tanggalMasuk?, role? }` |
| POST | `/employees/:id/deactivate` | HRD, ADMIN | nonaktifkan (tidak ada DELETE) |
| POST | `/employees/:id/activate` | HRD, ADMIN | |
| POST | `/employees/:id/reset-password` | HRD, ADMIN | `{ password }` -> 204 |

Aturan: hanya ADMIN yang boleh membuat/mengubah/menonaktifkan akun ADMIN. Role sendiri tidak bisa diubah, dan tidak bisa menonaktifkan diri sendiri.
Rantai atasan tidak boleh melingkar. Semua perubahan master tercatat di `audit_logs`.
