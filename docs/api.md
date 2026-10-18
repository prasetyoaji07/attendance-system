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

## Roster
| Method | Path | Akses | Keterangan |
|---|---|---|---|
| GET | `/roster/patterns` | login | daftar pola rotasi `{ id, nama, urutan: string[] }` |
| POST | `/roster/patterns` | HRD, ADMIN | `{ nama, urutan }`. Isi `urutan` = nama shift (tidak peka huruf besar/kecil) atau `"libur"`. Nama shift harus sudah ada (400), pola tidak boleh libur semua (400), nama kembar 409 |
| GET | `/roster` | login | query wajib `from`, `to` (`YYYY-MM-DD`, maks 62 hari), opsional `employeeId`. EMPLOYEE selalu hanya melihat jadwalnya sendiri |
| POST | `/roster/generate` | SPV, HRD, ADMIN | lihat di bawah |

`POST /roster/generate` body: `{ patternId, locationId, from, to, employees: [{ employeeId, offset? }], anchorDate?, dryRun? }`
- `anchorDate` = tanggal yang dianggap awal pola (default `from`). `offset` menggeser posisi pola per karyawan supaya tim tidak semuanya di shift yang sama.
- Hari `"libur"` di pola tidak membuat baris roster (tidak ada roster = tidak wajib hadir).
- Tanggal yang sudah punya roster **dilewati** dan dilaporkan di `skipped`, tidak ditimpa.
- Jeda antar shift berurutan harus >= 11 jam (`RULES.minRestHoursBetweenShifts`), termasuk terhadap roster yang sudah ada sehari sebelum dan sesudah rentang. Jika ada yang kurang, **seluruh proses dibatalkan** (tidak ada yang tersimpan): `409` kode `REST_VIOLATION`, `details` berisi `[{ employeeId, previousDate, nextDate, restHours, minRestHours }]`. Pelanggaran yang sudah ada di DB sebelumnya tidak ikut diblokir.
- `dryRun: true`: hanya menghitung dan memvalidasi, tidak menyimpan (200). Tanpa dryRun: 201.
- Respons: `{ data: { dryRun, from, to, created, skipped: [{ employeeId, shiftDate }] } }`. Tercatat di `audit_logs` (`ROSTER_GENERATE`).
- Batas: rentang maks 62 hari, maks 200 karyawan per proses. Karyawan harus aktif.
- Catatan: SPV saat ini bisa membuat jadwal untuk karyawan mana pun (pembatasan per divisi menyusul).

## Attendance (Fase 2)


| Method | Path | Akses | Keterangan |
|---|---|---|---|
| POST | `/attendance/check-in` | login | check-in untuk roster yang jendelanya sedang terbuka |

`POST /attendance/check-in` body: `{ lat, lng, accuracyM, qr }`
- `lat`, `lng`: koordinat dari Geolocation API (lat -90..90, lng -180..180). `accuracyM`: akurasi GPS dalam meter. `qr`: token hasil scan layar lokasi.
- **Roster aktif**: dicari dari roster dengan tanggal mulai shift kemarin, hari ini, dan besok. Dipilih yang jendelanya `[mulai - 2 jam, selesai + 2 jam]` memuat waktu sekarang. Jika dua jendela tumpang tindih, dipilih yang jam mulainya paling dekat. Dengan begini shift malam yang melewati tengah malam tetap benar. "Besok" ditambahkan agar shift yang mulai sehabis tengah malam bisa check-in malam sebelumnya.
- Urutan pemeriksaan: roster aktif, sudah check-in, akurasi GPS, jarak (Haversine), QR, lalu hitung telat dan simpan. Check-in pertama yang gagal menghentikan proses.
- `late_minutes = max(0, sekarang - (jam_mulai + toleransi))`. Status `TELAT` jika lebih dari 0, selain itu `HADIR` (fungsi yang sama dengan `computeDailyStatus`).
- Sukses: `201` `{ data: { attendanceId, rosterId, shiftDate, shiftNama, locationNama, checkInAt (ISO UTC), status, lateMinutes, distanceM, message } }`. Contoh `message`: `Check-in 07:12, terlambat 7 menit`.

| Status | Kode | Arti |
|---|---|---|
| 400 | `VALIDATION_ERROR` | body tidak sesuai skema |
| 400 | `INVALID_QR` | QR rusak, tanda tangan salah, kedaluwarsa, atau untuk lokasi lain |
| 401 | `UNAUTHORIZED` | belum login atau token tidak valid |
| 409 | `CONFLICT` | roster ini sudah punya check-in (aturan bisnis 3). Penjaga kedua: `UNIQUE(roster_id)` |
| 422 | `NO_ACTIVE_ROSTER` | tidak ada roster yang jendelanya terbuka sekarang |
| 422 | `GPS_ACCURACY_LOW` | akurasi lebih besar dari `RULES.maxGpsAccuracyM` (50 m). `details`: `{ accuracyM, maxAccuracyM }` |
| 422 | `OUT_OF_RADIUS` | lebih jauh dari radius lokasi. `details`: `{ distanceM, radiusM }` |

Belum termasuk: device binding (cek perangkat terdaftar) dan rule risiko. Keduanya item terpisah.
