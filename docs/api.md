# Referensi API

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
| GET | `/locations/:id/qr` | HRD, ADMIN | token QR dinamis untuk layar di lokasi, lihat di bawah |

`GET /locations/:id/qr` -> `{ data: { locationId, locationNama, token, refreshAt (ISO UTC), ttlSeconds } }`
- `token` berformat `locationId.window.signature` dan berganti tiap `ttlSeconds` (`RULES.qrTtlSeconds`, 45 detik). Layar mengambil token baru pada `refreshAt` (akhir window sekarang).
- Diverifikasi oleh check-in dan check-out dengan fungsi yang sama (`verifyQr`). Token masih diterima sampai akhir window berikutnya (toleransi 1 window), jadi layar yang telat refresh beberapa detik tidak membuat scan gagal.
- Hanya HRD dan ADMIN: layar di lokasi memakai akun mereka. Karyawan biasa 403, tanpa token 401, lokasi tidak ada 404, id bukan angka 400.
- Respons memakai `Cache-Control: no-store`. Tidak dicatat di `audit_logs` (hanya membaca, dipanggil terus-menerus).
- Skrip uji: `npx tsx scripts/try-qr.ts` (dari folder `server`).

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

## Devices (Fase 2)

Device binding: akun dipakai dari perangkat yang sudah disetujui. `deviceId` adalah ID acak yang dibuat dan disimpan klien (UUID dari `crypto.randomUUID()` lolos). Aplikasi web tidak bisa membaca ID perangkat keras, jadi ganti browser atau hapus data situs dianggap perangkat baru. Ini pencegah pinjam-akun, **bukan pengaman penuh**.

| Method | Path | Akses | Keterangan |
|---|---|---|---|
| POST | `/devices/register` | login | body `{ deviceId }`. Klien memanggilnya setelah login. Aman diulang |
| GET | `/devices/me` | login | status perangkat yang sedang dipakai (dari header `X-Device-Id`) |
| GET | `/devices/pending` | HRD, ADMIN | antrean permintaan perangkat baru |
| POST | `/devices/:id/approve` | HRD, ADMIN | setujui permintaan |
| POST | `/devices/:id/reject` | HRD, ADMIN | tolak permintaan |

`POST /devices/register` -> `{ data: { status: 'active' | 'pending', created, message } }`
- `201` jika baris baru dibuat, `200` jika perangkat itu sudah terdaftar (status tidak berubah).
- `deviceId`: 16-64 karakter huruf, angka, `_`, atau `-`. Selain itu `400 VALIDATION_ERROR`.
- Perangkat pertama sebuah akun langsung `active`. Perangkat berikutnya `pending` (menunggu HRD/ADMIN). Paling banyak satu `pending` per akun: permintaan baru menggantikan yang lama.

`GET /devices/me` -> `{ data: { current: 'active' | 'pending' | 'unregistered', devices: [{ id, status, current }] } }`. Hanya perangkat milik akun sendiri, dan `deviceId` sungguhan tidak dikembalikan.

`GET /devices/pending` -> `{ data: [{ id, userId, nik, nama, departmentNama, requestedAt (ISO UTC) }] }`, terlama di atas.

`POST /devices/:id/approve` -> `{ data: { id, userId, replacedDevices } }`
- Perangkat jadi `active` dan semua perangkat lain milik akun itu dihapus (satu `active` per akun). `replacedDevices` = jumlah yang dihapus.
- `404` jika id tidak ada. `409` jika perangkat itu sudah `active`.
- HRD tidak boleh menyetujui perangkatnya sendiri (`403`). ADMIN boleh, supaya satu-satunya HRD yang ganti HP tidak terkunci.

`POST /devices/:id/reject` -> `{ data: { id } }`. Baris `pending` dihapus; perangkat `active` akun itu tidak tersentuh. `404` / `409` seperti approve.

Semua perubahan tercatat di `audit_logs` (aksi `DEVICE_REGISTER`, `DEVICE_REQUEST`, `DEVICE_CHANGE`, `DEVICE_REJECT`).

**Guard.** `POST /attendance/check-in` dan `POST /attendance/check-out` wajib mengirim header `X-Device-Id` berisi perangkat `active` milik akun. Pemeriksaan ini berjalan setelah JWT dan sebelum validasi body:

| Status | Kode | Arti |
|---|---|---|
| 403 | `DEVICE_REQUIRED` | header tidak ada atau formatnya tidak valid |
| 403 | `DEVICE_NOT_REGISTERED` | perangkat belum terdaftar untuk akun ini (login ulang lalu `register`) |
| 403 | `DEVICE_PENDING` | perangkat masih menunggu persetujuan HRD |

Skrip uji: `npx tsx scripts/try-devices.ts` (dari folder `server`; tidak membuat absen).

## Attendance (Fase 2)

| Method | Path | Akses | Keterangan |
|---|---|---|---|
| POST | `/attendance/check-in` | login + perangkat `active` | check-in untuk roster yang jendelanya sedang terbuka |
| POST | `/attendance/check-out` | login + perangkat `active` | check-out untuk absen terakhir yang masih terbuka |

Keduanya wajib header `X-Device-Id` (lihat bagian Devices untuk kode 403).

### Check-in

`POST /attendance/check-in` body: `{ lat, lng, accuracyM, qr }`
- `lat`, `lng`: koordinat dari Geolocation API (lat -90..90, lng -180..180). `accuracyM`: akurasi GPS dalam meter. `qr`: token hasil scan layar lokasi.
- **Roster aktif**: dicari dari roster dengan tanggal mulai shift kemarin, hari ini, dan besok. Dipilih yang jendelanya `[mulai - 2 jam, selesai + 2 jam]` memuat waktu sekarang. Jika dua jendela tumpang tindih, dipilih yang jam mulainya paling dekat. Dengan begini shift malam yang melewati tengah malam tetap benar. "Besok" ditambahkan agar shift yang mulai sehabis tengah malam bisa check-in malam sebelumnya.
- Urutan pemeriksaan: JWT, perangkat, roster aktif, sudah check-in, akurasi GPS, jarak (Haversine), QR, lalu hitung telat dan simpan. Pemeriksaan pertama yang gagal menghentikan proses.
- `late_minutes = max(0, sekarang - (jam_mulai + toleransi))`. Status `TELAT` jika lebih dari 0, selain itu `HADIR` (fungsi yang sama dengan `computeDailyStatus`).
- Sukses: `201` `{ data: { attendanceId, rosterId, shiftDate, shiftNama, locationNama, checkInAt (ISO UTC), status, lateMinutes, distanceM, message } }`. Contoh `message`: `Check-in 07:12, terlambat 7 menit`.

| Status | Kode | Arti |
|---|---|---|
| 400 | `VALIDATION_ERROR` | body tidak sesuai skema |
| 400 | `INVALID_QR` | QR rusak, tanda tangan salah, kedaluwarsa, atau untuk lokasi lain |
| 401 | `UNAUTHORIZED` | belum login atau token tidak valid |
| 403 | `DEVICE_REQUIRED`, `DEVICE_NOT_REGISTERED`, `DEVICE_PENDING` | guard perangkat (lihat bagian Devices) |
| 409 | `CONFLICT` | roster ini sudah punya check-in (aturan bisnis 3). Penjaga kedua: `UNIQUE(roster_id)` |
| 422 | `NO_ACTIVE_ROSTER` | tidak ada roster yang jendelanya terbuka sekarang |
| 422 | `GPS_ACCURACY_LOW` | akurasi lebih besar dari `RULES.maxGpsAccuracyM` (50 m). `details`: `{ accuracyM, maxAccuracyM }` |
| 422 | `OUT_OF_RADIUS` | lebih jauh dari radius lokasi. `details`: `{ distanceM, radiusM }` |

### Check-out

`POST /attendance/check-out` body: `{ lat, lng, accuracyM, qr }` (sama dengan check-in)
- **Absen yang dicari** adalah ABSEN TERAKHIR karyawan (`check_in_at` terbaru), bukan lewat jendela roster. Dengan begini shift malam yang lewat tengah malam tetap menempel ke roster tanggal mulainya.
- **Batas akhir check-out** = jam selesai shift + `RULES.checkinWindowHoursAfter` (2 jam). Tepat di batas masih boleh (inklusif).
- Urutan pemeriksaan: JWT, perangkat, absen terakhir, sudah check-out, batas waktu, akurasi GPS, jarak, QR, hitung, lalu simpan. Pemeriksaan GPS, jarak, dan QR sama dengan check-in.
- Status dari `computeDailyStatus`: `TELAT` > `PULANG_CEPAT` > `HADIR`. Pulang cepat = check-out sebelum jam selesai - toleransi shift. `lateMinutes` dan `earlyLeaveMinutes` dilaporkan terpisah. Jarak dan akurasi saat check-out tidak disimpan.
- Sukses: `200` `{ data: { attendanceId, rosterId, shiftDate, shiftNama, locationNama, checkInAt (ISO UTC), checkOutAt (ISO UTC), status, lateMinutes, earlyLeaveMinutes, workedMinutes, distanceM, message } }`. Contoh `message`: `Check-out 13:40, pulang 15 menit lebih awal`, atau `Check-out 14:02` jika tidak pulang cepat.
- UPDATE hanya mengenai baris yang masih terbuka (`check_out_at` kosong dan belum auto-close). Dua request bersamaan, atau auto-close yang menyalip, berakhir `409`.

| Status | Kode | Arti |
|---|---|---|
| 400 | `VALIDATION_ERROR` | body tidak sesuai skema |
| 400 | `INVALID_QR` | sama dengan check-in |
| 401 | `UNAUTHORIZED` | belum login atau token tidak valid |
| 403 | `DEVICE_REQUIRED`, `DEVICE_NOT_REGISTERED`, `DEVICE_PENDING` | guard perangkat (lihat bagian Devices) |
| 409 | `CONFLICT` | absen ini sudah check-out (selama masih dalam batas waktu), atau keburu ditutup di antara dua request |
| 422 | `NO_OPEN_ATTENDANCE` | belum pernah check-in, atau absen terakhir sudah check-out dan batas waktunya lewat |
| 422 | `CHECKOUT_WINDOW_CLOSED` | batas waktu check-out lewat, atau absen sudah ditutup otomatis. Pesan: ajukan koreksi absen ke HRD |
| 422 | `GPS_ACCURACY_LOW` | sama dengan check-in |
| 422 | `OUT_OF_RADIUS` | sama dengan check-in |

### Penutupan otomatis (tanpa endpoint)

Absen yang punya check-in tetapi `check_out_at` kosong dan sudah lewat batas akhir check-out ditutup otomatis oleh job `runAutoClose`:
- `auto_closed = 1` dan `needs_correction = 1`. `check_out_at` **dibiarkan kosong**: jam pulang tidak boleh dikarang. Koreksinya lewat pengajuan ke HRD (Fase 3).
- Idempoten. UPDATE hanya mengenai baris dengan `check_out_at IS NULL AND auto_closed = 0`, jadi aman dijalankan berulang.
- Tiap absen ditutup dalam transaksinya sendiri dan dicatat di `audit_logs` (`ATTENDANCE_AUTO_CLOSE`, `userId` kosong).
- Dijadwalkan setiap 15 menit lewat node-cron, hanya jika `RUN_JOBS=true` di `server/.env` (default `false`).
- Alat uji lokal: `npx tsx scripts/try-autoclose.ts` (dari folder `server`) hanya melihat absen yang akan ditutup. Tambahkan `--at=<waktu ISO>` untuk waktu acuan lain dan `--apply` untuk benar-benar menulis. `scripts/try-checkout.ts <NIK>` menguji check-out lewat HTTP.

Belum termasuk: rule risiko dan koreksi absen oleh HRD. Keduanya item terpisah.
