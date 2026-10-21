# Design System: Sistem Absensi

> Satu sumber kebenaran untuk tampilan. Semua komponen **wajib** memakai token di dokumen ini.
> Dilarang memakai angka warna, ukuran, atau bayangan "asal" di komponen. Kalau butuh nilai baru, tambahkan dulu ke token.

**Stack:** React + TypeScript, Tailwind CSS, `lucide-react` untuk ikon.

---

## 1. Prinsip Desain

| Prinsip | Artinya |
|---|---|
| **Modern & premium** | Banyak ruang kosong, sudut membulat, warna terkontrol, tipografi tegas |
| **Datar-modern** | Kedalaman ringan lewat border tipis, sudut besar, dan bayangan lembut. Tanpa sisi tebal, tanpa gradien pada tombol, tanpa efek miring |
| **Mobile-first** | Karyawan absen dari HP. Layar utama harus bisa dipakai satu tangan |
| **Cepat dibaca** | Status harian terbaca dalam sekejap lewat warna + ikon + teks (tidak hanya warna) |
| **Konsisten** | Satu font, satu skala spasi, satu skala radius, satu set bayangan |
| **Ramah** | Bahasa santai tapi sopan, pakai "kamu" |

**Aturan emas:**
- **Oranye hemat** (kira-kira 10-15% layar): kartu hero, Tombol Absen, pil menu aktif di nav bawah HP, lencana kecil, dan ring fokus.
- **Hitam untuk aksi utama dan menu aktif**: tombol `primary` dan pil menu aktif di sidebar desktop memakai token `contrast-bg` / `contrast-text`. Di mode gelap keduanya berbalik (latar terang, teks gelap).
- Selain itu putih dan abu-putih: latar `bg`, kartu `surface`, border tipis, sudut besar.

---

## 2. Warna

### 2.1 Brand (oranye) dan kontras

| Token | Hex | Pemakaian |
|---|---|---|
| `primary-50` | `#FFF7ED` (gelap: `rgba(249,115,22,.12)`) | Latar tipis, hover ghost |
| `primary-100` | `#FFEDD5` | Badge, highlight |
| `primary-200` | `#FED7AA` | Ring fokus |
| `primary-400` | `#FB923C` | Border fokus input, ikon aktif |
| `primary-500` | `#F97316` | **Warna utama**, dipakai hemat: Tombol Absen, pil nav HP, kartu hero |
| `primary-600` | `#EA580C` | Teks tombol ghost |
| `primary-700` | `#C2410C` | Hover tombol `primary` |
| `primary-900` | `#7C2D12` | Teks di atas latar primary muda |

Token kontras (berbalik antar mode), untuk tombol utama dan menu aktif sidebar:

| Token | Light | Dark | Pemakaian |
|---|---|---|---|
| `contrast-bg` | `#0C0A09` | `#FAFAFA` | Latar tombol `primary`, pil menu aktif sidebar |
| `contrast-text` | `#FFFFFF` | `#0C0A09` | Teks di atas `contrast-bg` |

Token `accent-*` (cyan) sudah dihapus. Jangan dipakai lagi.

### 2.2 Netral

| Token | Light | Dark |
|---|---|---|
| `bg` (latar halaman) | `#FAFAF9` | `#0A0A0A` |
| `surface` (kartu) | `#FFFFFF` | `#141414` |
| `surface-2` (kartu tingkat 2) | `#F5F5F4` | `#1C1C1C` |
| `border` | `#E7E5E4` | `#2A2A2A` |
| `text` | `#0C0A09` | `#FAFAFA` |
| `text-muted` | `#57534E` | `#A3A3A3` |
| `text-faint` | `#A8A29E` | `#737373` |

### 2.3 Semantik

| Token | Hex | Latar tipis (light) | Dipakai untuk |
|---|---|---|---|
| `success` | `#10B981` | `#D1FAE5` | Hadir, approved |
| `warning` | `#EAB308` | `#FEF9C3` | Telat, pending |
| `danger` | `#EF4444` | `#FEE2E2` | Alpa, rejected, error |
| `info` | `#0EA5E9` | `#E0F2FE` | Izin, informasi |
| `violet` | `#8B5CF6` | `#EDE9FE` | Cuti |
| `teal` | `#14B8A6` | `#CCFBF1` | Lembur |
| `slate` | `#64748B` | `#E2E8F0` | Libur, draft, cancelled |

Mode gelap: semua latar tipis berubah jadi warna semantiknya dengan opasitas 16% (slate 20%). Nilai lengkap ada di 14.1.

### 2.4 Peta status absensi (tetap, jangan diubah per halaman)

| Status | Warna | Ikon (lucide) | Label |
|---|---|---|---|
| HADIR | success | `CircleCheck` | Hadir |
| TELAT | warning | `Clock` | Telat |
| PULANG_CEPAT | warning | `LogOut` | Pulang cepat |
| ALPA | danger | `CircleX` | Alpa |
| IZIN | info | `FileText` | Izin |
| SAKIT | info | `Stethoscope` | Sakit |
| CUTI | violet | `Palmtree` | Cuti |
| LEMBUR | teal | `Zap` | Lembur |
| LIBUR | slate | `Moon` | Libur |

Status request: `DRAFT` slate, `PENDING` warning, `APPROVED` success, `REJECTED` danger, `CANCELLED` slate.

### 2.5 Gradien

| Token | Nilai | Dipakai |
|---|---|---|
| `grad-primary` | `linear-gradient(180deg, #F97316 0%, #EA580C 50%, #C2410C 100%)` | Tersedia di `tokens.css`. **Tidak dipakai** Button maupun Tombol Absen (keduanya datar) |
| `grad-hero` | `linear-gradient(135deg, #F97316 0%, #EA580C 55%, #C2410C 100%)` | Kartu hero (jadwal hari ini) |

`grad-surface` dan `grad-glow` dari versi lama dihapus karena tidak ada di `tokens.css`.

---

## 3. Tipografi

**Font utama:** `Plus Jakarta Sans` (heading dan body).
**Font angka/kode:** `JetBrains Mono` (jam, koordinat, NIK, jarak).
Hanya dua font ini. Jangan tambah font lain.

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@500;600&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
```

Fallback: `'Plus Jakarta Sans', system-ui, -apple-system, 'Segoe UI', sans-serif`

### Skala

| Token | Ukuran / Line-height | Weight | Dipakai |
|---|---|---|---|
| `display` | 40 / 48 | 800 | Jam besar di layar absen |
| `h1` | 28 / 36 | 700 | Judul halaman |
| `h2` | 22 / 30 | 700 | Judul seksi |
| `h3` | 18 / 26 | 600 | Judul kartu |
| `body-lg` | 16 / 24 | 400 | Teks utama di mobile |
| `body` | 14 / 22 | 400 | Teks standar |
| `body-sm` | 13 / 20 | 400 | Tombol `sm`, teks pendamping |
| `caption` | 12 / 18 | 500 | Label, keterangan, badge |
| `mono` | 14 / 20 | 600 | Angka, jam, koordinat. Belum jadi token ukuran: pakai kelas `font-mono` |

Aturan:
- Maksimal **3 ukuran berbeda** dalam satu kartu.
- Letter-spacing heading: `-0.02em`. Caption huruf kapital: `+0.04em`.
- Angka di tabel dan jam selalu `font-variant-numeric: tabular-nums`.

---

## 4. Spasi

Basis **4 px**. Hanya pakai nilai di skala ini.

| Token | px | Tailwind |
|---|---|---|
| `space-1` | 4 | `1` |
| `space-2` | 8 | `2` |
| `space-3` | 12 | `3` |
| `space-4` | 16 | `4` |
| `space-5` | 20 | `5` |
| `space-6` | 24 | `6` |
| `space-8` | 32 | `8` |
| `space-10` | 40 | `10` |
| `space-12` | 48 | `12` |
| `space-14` | 56 | `14` |
| `space-16` | 64 | `16` |
| `space-24` | 96 | `24` |

Pemakaian baku:

| Konteks | Nilai |
|---|---|
| Padding halaman (mobile) | 16 |
| Padding halaman (desktop) | 32 |
| Padding dalam kartu | 20 (mobile 16) |
| Jarak antar kartu | 16 |
| Jarak antar elemen dalam kartu | 12 |
| Jarak label ke input | 8 |
| Jarak antar field form | 20 |
| Jarak antar seksi halaman | 32 |

---

## 5. Radius

| Token | px | Dipakai |
|---|---|---|
| `radius-sm` | 8 | Badge, chip, input kecil |
| `radius-md` | 12 | Tombol, input |
| `radius-lg` | 16 | Kartu |
| `radius-xl` | 24 | Kartu hero, modal, bottom sheet |
| `radius-full` | 9999 | Avatar, pill, tombol Absen |

---

## 6. Bayangan dan Kedalaman

Arah **datar-modern**: kedalaman datang dari border tipis, sudut besar, dan bayangan lembut berlapis. Tombol tidak punya sisi tebal, highlight atas, atau gradien.

### Light mode

| Token | Nilai |
|---|---|
| `shadow-1` | `0 1px 2px rgba(15,23,42,.06), 0 1px 1px rgba(15,23,42,.04)` |
| `shadow-2` | `0 2px 4px rgba(15,23,42,.05), 0 8px 16px rgba(15,23,42,.06)` |
| `shadow-3` | `0 4px 8px rgba(15,23,42,.06), 0 16px 32px rgba(15,23,42,.10)` |
| `shadow-4` | `0 8px 16px rgba(15,23,42,.08), 0 32px 64px rgba(15,23,42,.14)` |
| `shadow-glow` | `0 8px 24px rgba(249,115,22,.35)` (oranye) |

### Dark mode
Bayangan hitam lebih pekat, ditambah garis terang tipis di tepi atas: `inset 0 1px 0 rgba(255,255,255,.06)`. Nilai lengkap di 14.1.

### Efek standar

| Efek | Resep |
|---|---|
| **Efek tekan** | Tombol: `enabled:active:scale-[0.98]`. Tombol Absen: `scale-[0.97]`. Tidak berlaku saat disabled |
| **Hover tombol** | Ganti warna latar (lihat 9.1), tanpa gerak |
| **Hover kartu yang bisa diklik** | Naik satu level bayangan, tanpa gerak |
| **Glow** | `shadow-glow` hanya untuk Tombol Absen yang siap |
| **Kaca (opsional)** | `background: rgba(255,255,255,.65)` + `backdrop-filter: blur(16px) saturate(160%)` + border `1px solid rgba(255,255,255,.5)`. Sidebar dan header HP sekarang memakai `surface` biasa, bukan kaca |

Resep lama yang sudah dihapus: sisi tebal (`0 4px 0 <warna-700>`), highlight atas, angkat `translateY`, dan kemiringan kartu hero.

---

## 7. Layout

### Breakpoint

| Nama | Lebar | Pola |
|---|---|---|
| di bawah `md` | < 768 | HP: 1 kolom, **bottom navigation** |
| `md` | ≥ 768 | Tablet dan desktop: **sidebar** kiri + konten |
| `lg` | ≥ 1024 | Desktop lebar: grid 12 kolom |

- Lebar konten maksimal: `max-w-5xl` (1024px), di tengah.
- Grid: 4 kolom (mobile), 8 (tablet), 12 (desktop). Gap 16 (mobile), 24 (desktop).
- Sidebar: lebar 240 (`w-60`), latar `surface`, border kanan, tetap di tempat (fixed). Bottom nav: tinggi 64 + safe-area, latar `surface`, border atas. Header HP: sticky, latar `surface`, border bawah.
- Area sentuh minimal **44 x 44 px**.

### Z-index

| Lapisan | Nilai |
|---|---|
| Konten | 0 |
| Sticky header | 10 |
| Sidebar / bottom nav | 20 |
| Dropdown | 30 |
| Modal / bottom sheet | 40 |
| Toast | 50 |

---

## 8. Ikon

- Library: `lucide-react` saja.
- Stroke `1.75`, ukuran `16` (inline), `20` (tombol, nav), `24` (judul), `32+` (empty state).
- Warna ikon mengikuti teks (`currentColor`) kecuali status.
- Ikon tombol aksi selalu disertai label teks (kecuali tombol ikon dengan `aria-label`).

---

## 9. Komponen

### 9.1 Button

Sumber: `client/src/components/ui/Button.tsx`.

| Varian | Tampilan | Dipakai |
|---|---|---|
| `primary` | Latar `contrast-bg`, teks `contrast-text`. Hover: latar `primary-700`, teks putih | Aksi utama (1 per layar) |
| `secondary` | Latar `surface-2`, teks `text`. Hover: latar `border` | Aksi pendamping |
| `ghost` | Tanpa latar, teks `primary-600`. Hover: latar `primary-50` | Aksi tersier |
| `danger` | Latar `danger`, teks putih. Hover: `brightness-90` | Hapus, tolak |
| `success` | Latar `success`, teks putih. Hover: `brightness-90` | Setujui |

| Ukuran | Tinggi | Padding X | Font |
|---|---|---|---|
| `sm` | 36 (`h-9`) | 12 | `body-sm` |
| `md` | 44 (`h-11`) | 16 | `body` |
| `lg` | 52 | 24 | `body-lg`, tebal |

Aturan: semua tombol `font-semibold`, radius `radius-md`, jarak ikon-teks 8. Semua datar: tanpa gradien, tanpa bayangan, tanpa sisi tebal. Status: `hover` ganti warna (tabel di atas), `active` mengecil `scale-[0.98]` hanya bila aktif, `focus-visible` ring 3px `primary-200`, `disabled` opasitas 50% dan tidak bisa diklik. Status `loading` (spinner dan kunci klik) **belum diterapkan** di komponen.

### 9.2 Tombol Absen (hero action)

Sumber: `client/src/components/AttendanceButton.tsx`. Elemen paling menonjol di aplikasi, tetap datar.

- Bentuk: lingkaran `radius-full`, diameter **168** (HP) / 192 (`md` ke atas). Ukuran ini pengecualian token karena belum ada token ukuran.
- Isi: ikon 40 (stroke 1.75) + label (`h3`) + detail opsional (mono, `caption`).
- Tekan: `scale-[0.97]` hanya saat aktif. Fokus: ring 3px `primary-200`.
- Tujuh keadaan:

| Keadaan | Tampilan |
|---|---|
| `ready` | Latar `primary-500`, teks putih, `shadow-glow`, ikon `Fingerprint`, cincin berdenyut (`animate-ping`, hanya saat `motion-safe`) |
| `locating` | Latar `surface-2`, teks `text-muted`, spinner, teks "Mencari lokasi..." |
| `outside` | Latar `danger`, teks putih, ikon `CircleAlert`, detail jarak (mono) |
| `weak` | Latar `surface-2`, ikon `CircleAlert` warna `warning` |
| `sending` | Latar `surface-2`, spinner |
| `done` | Latar `success`, teks putih, ikon `CircleCheck`, tanpa pulse |
| `idle` | Latar `surface-2`, teks `text-muted`, ikon `Fingerprint` |

- Saat `ready` tetapi `disabled`: opasitas 50% dan tanpa pulse. Keadaan selain `ready` tidak bisa diklik.
- Di bawahnya: chip jarak ("42 m dari Pabrik 1") dan akurasi GPS.
- Catatan kontras: teks putih di atas `primary-500` dan `danger` belum lolos 4.5:1 (lihat bagian 12).

### 9.3 Card

| Varian | Resep |
|---|---|
| `card` | `surface`, border `border`, `radius-lg`, `shadow-2`, padding 20 |
| `card-glass` | Resep kaca (bagian 6, opsional), `radius-xl`, untuk di atas latar berwarna |
| `card-hero` | `grad-hero` (oranye), teks putih, `radius-xl`, `shadow-4`, hiasan lingkaran blur di pojok |
| `card-stat` | `card` + ikon di kotak `radius-sm` berwarna tipis + angka `h1` mono + tren kecil |

Kartu yang bisa diklik: hover naik satu level bayangan (tanpa gerak).

### 9.4 Input dan Form

- Tinggi 44 (`h-11`), `radius-md`, border `border`, latar `surface`, padding X 12. Sumber: `inputCls` di `client/src/components/ui/inputClass.ts`, dipakai input dan select supaya seragam.
- Label di atas (`caption` 600, `text-muted`), jarak 8.
- Focus: border `primary-400` + ring 3px `primary-200`. Disabled: opasitas 50%.
- Error: border `danger`, pesan `caption` merah di bawah dengan ikon `CircleAlert`.
- Placeholder: `text-faint`. Helper text: `caption` `text-muted`.
- Satu kolom di mobile. Tombol submit selalu full-width di mobile.

### 9.5 Badge Status

- Bentuk pill, tinggi 24, padding X 10, `caption` 600.
- Latar = warna tipis semantik, teks = warna semantik gelap, ikon 14 di kiri.
- Pemetaan warna mengikuti **bagian 2.4**. Tidak boleh ada warna status di luar tabel itu.

### 9.6 Tabel

- Header: `caption` huruf kapital, `text-muted`, latar `surface-2`.
- Baris tinggi 56, pemisah garis tipis `border`, hover `primary-50`.
- Angka rata kanan, mono. Kolom aksi di kanan.
- Mobile: tabel berubah jadi **daftar kartu** (jangan scroll horizontal untuk data utama).
- Kosong: tampilkan empty state (9.10).

### 9.7 Navigasi

- **Mobile:** bottom nav setinggi 64 + safe-area, latar `surface`, border atas. Tiap item berisi ikon 22 dan label (`caption`, semibold). Item aktif berupa **pil oranye** (`primary-500`, teks putih, `radius-full`); item lain `text-muted`. Jumlah item mengikuti role: Beranda dan Jadwal untuk semua, Perangkat dan QR Lokasi untuk HRD/ADMIN. *Belum diterapkan:* item Pengajuan dan Profil, serta item Absen yang menonjol di tengah (rencana).
- **Desktop:** sidebar lebar 240, latar `surface`, border kanan. Item setinggi 44, `radius-full`, padding X 16. Item aktif berupa **pil hitam** (`contrast-bg`, teks `contrast-text`); item lain `text-muted`, hover `surface-2`. Header HP: sticky, latar `surface`, berisi nama, NIK, role, tombol tema dan keluar.
- Header halaman: judul `h1`, subjudul `text-muted`, aksi di kanan.

### 9.8 Modal dan Bottom Sheet

- Desktop: modal tengah, lebar 480, `radius-xl`, `shadow-4`, overlay `rgba(11,13,20,.5)` + blur 4.
- Mobile: **bottom sheet** dengan handle di atas, `radius-xl` di sudut atas.
- Tombol aksi di bawah: utama di kanan (desktop) / penuh (mobile).
- Esc dan klik overlay menutup, kecuali form berisi data belum disimpan.

### 9.9 Toast dan Feedback

- Muncul dari atas (mobile) / kanan atas (desktop), `radius-lg`, `shadow-3`, durasi 4 detik.
- Pita warna semantik di kiri + ikon. Pesan singkat satu kalimat.
- Aksi berhasil: haptic/animasi centang singkat.

### 9.10 Empty, Loading, Error

| Keadaan | Tampilan |
|---|---|
| Empty | Ikon 48 di lingkaran `primary-50`, judul `h3`, deskripsi 1 kalimat, tombol aksi |
| Loading | **Skeleton** berbentuk konten asli (shimmer 1.4 detik), bukan spinner layar penuh |
| Error | Ikon `CircleAlert`, pesan manusiawi, tombol "Coba lagi" |

### 9.11 Avatar, Chip, Tabs

- Avatar: lingkaran 40 (kecil 32, besar 64), inisial bila tanpa foto, ring putih 2px + `shadow-1`.
- Chip filter: pill tinggi 36, aktif = latar `primary-500` teks putih (catatan kontras di bagian 12), tidak aktif = latar `surface-2`.
- Tabs: garis bawah 2px `primary-500` pada tab aktif; di mobile boleh digeser horizontal.

---

## 10. Halaman Kunci (panduan komposisi)

### 10.1 Beranda Karyawan (mobile)
1. Salam ("Selamat pagi, Aji") + tanggal.
2. **card-hero**: shift hari ini, jam mulai-selesai (mono), lokasi.
3. **Tombol Absen** di tengah + chip jarak dan akurasi.
4. Dua `card-stat` berdampingan: Jam kerja bulan ini, Telat bulan ini.
5. Daftar 5 absen terakhir (badge status).

### 10.2 Jadwal
Kalender bulanan, tiap tanggal diberi titik warna sesuai status/shift. Tap tanggal membuka bottom sheet detail.

### 10.3 Pengajuan
Chip jenis (Cuti, Izin, Sakit, Lembur, Tukar shift) → form satu kolom → timeline approval vertikal (Foreman → SPV → HRD) dengan titik berwarna per status.

### 10.4 Dashboard HRD (desktop)
Baris `card-stat` (hadir, telat, alpa, lembur) → grafik tren + heatmap telat → tabel perlu tindakan (request pending, koreksi menggantung). Tombol tutup periode berada di pojok kanan atas dengan konfirmasi.

---

## 11. Motion

| Token | Nilai | Dipakai |
|---|---|---|
| `dur-fast` | 120 ms | Hover, tekan |
| `dur-base` | 200 ms | Transisi umum |
| `dur-slow` | 320 ms | Modal, bottom sheet, halaman |
| `ease-out` | `cubic-bezier(.22,1,.36,1)` | Masuk |
| `spring` | `cubic-bezier(.34,1.56,.64,1)` | Cadangan untuk elemen yang kembali setelah ditekan. Belum dipakai komponen sekarang |

`ease-in-out` (`cubic-bezier(.65,0,.35,1)`) ada di rencana lama tetapi belum menjadi token di `tokens.css`.

**Yang berjalan sekarang:** transisi CSS 120 ms pada tombol dan menu, efek tekan `scale`, pulse Tombol Absen dan spinner (keduanya `motion-safe`).

**Rencana, ditunda:** gerak dengan `framer-motion` (kartu masuk bergantian, angka berhitung, pil menu bergeser mulus lewat `layoutId`, transisi antarhalaman). Dikerjakan setelah fitur fungsional selesai. Token di atas tetap jadi acuan durasi dan kurva.

Aturan:
- Animasikan hanya `transform` dan `opacity`.
- Daftar muncul bertahap (stagger 40 ms, maksimal 8 item) saat gerak sudah diterapkan.
- **Wajib** hormati `prefers-reduced-motion`: matikan pulse, spinner, dan stagger. `tokens.css` sudah mematikan animasi dan memendekkan transisi secara global.

---

## 12. Aksesibilitas

- Kontras teks minimal **4.5:1** (WCAG AA). Tombol `primary` (`contrast-bg` + `contrast-text`) lolos di kedua mode. **Belum lolos** untuk teks putih di atas warna terang: perkiraan `primary-500` ~2,8:1, `success` ~2,5:1, `danger` ~3,8:1. Ini berlaku untuk Tombol Absen, pil nav HP, tombol `danger` dan `success`, dan kartu hero. Perbaikannya (token yang lebih tua) belum diputuskan dan tercatat di `TASKS.md`. Cek ulang tiap warna baru.
- Status tidak boleh hanya warna: selalu ikon + teks.
- Fokus keyboard terlihat jelas (ring 3px).
- Semua tombol ikon punya `aria-label`. Gambar dekoratif `aria-hidden`.
- Form: label terhubung ke input, pesan error terhubung lewat `aria-describedby`.
- Tombol Absen tidak bergantung pada gestur (tidak ada "tahan lama" sebagai satu-satunya cara).

---

## 13. Tone dan Teks (UX writing)

- Sapaan "kamu", kalimat pendek, aktif, tanpa jargon.
- Tombol berupa kata kerja: "Absen Masuk", "Ajukan Cuti", "Setujui".
- Error menjelaskan solusi, bukan menyalahkan.

| Situasi | Contoh |
|---|---|
| Berhasil | "Absen masuk berhasil, 07:03. Semangat kerjanya!" |
| Telat | "Kamu telat 3 menit. Tetap tercatat hadir." |
| Di luar area | "Kamu 340 m dari lokasi. Dekati area kerja lalu coba lagi." |
| GPS lemah | "Sinyal GPS masih lemah. Pindah ke tempat terbuka lalu coba lagi." |
| Kosong | "Belum ada pengajuan. Butuh cuti? Ajukan di sini." |

Format: tanggal `Sen, 18 Okt 2026`, jam 24 jam `07:03`, durasi `7j 45m`, zona waktu WIB.

---

## 14. Implementasi

### 14.1 `tokens.css`

Salinan `client/src/styles/tokens.css`. Bila berbeda dengan file aslinya, file asli yang benar.

```css
:root {
  /* brand (oranye) */
  --primary-50:#FFF7ED; --primary-100:#FFEDD5; --primary-200:#FED7AA;
  --primary-400:#FB923C; --primary-500:#F97316; --primary-600:#EA580C;
  --primary-700:#C2410C; --primary-900:#7C2D12;

  /* kontras (berbalik antar mode): tombol utama, menu aktif */
  --contrast-bg:#0C0A09; --contrast-text:#FFFFFF;

  /* semantik */
  --success:#10B981; --success-bg:#D1FAE5;
  --warning:#EAB308; --warning-bg:#FEF9C3;
  --danger:#EF4444;  --danger-bg:#FEE2E2;
  --info:#0EA5E9;    --info-bg:#E0F2FE;
  --violet:#8B5CF6;  --violet-bg:#EDE9FE;
  --teal:#14B8A6;    --teal-bg:#CCFBF1;
  --slate:#64748B;   --slate-bg:#E2E8F0;

  /* surface (light) */
  --bg:#FAFAF9; --surface:#FFFFFF; --surface-2:#F5F5F4;
  --border:#E7E5E4; --text:#0C0A09; --text-muted:#57534E; --text-faint:#A8A29E;

  /* radius */
  --radius-sm:8px; --radius-md:12px; --radius-lg:16px; --radius-xl:24px;

  /* shadow */
  --shadow-1:0 1px 2px rgba(15,23,42,.06),0 1px 1px rgba(15,23,42,.04);
  --shadow-2:0 2px 4px rgba(15,23,42,.05),0 8px 16px rgba(15,23,42,.06);
  --shadow-3:0 4px 8px rgba(15,23,42,.06),0 16px 32px rgba(15,23,42,.10);
  --shadow-4:0 8px 16px rgba(15,23,42,.08),0 32px 64px rgba(15,23,42,.14);
  --shadow-glow:0 8px 24px rgba(249,115,22,.35);

  /* gradient */
  --grad-primary:linear-gradient(180deg,#F97316 0%,#EA580C 50%,#C2410C 100%);
  --grad-hero:linear-gradient(135deg,#F97316 0%,#EA580C 55%,#C2410C 100%);

  /* motion */
  --dur-fast:120ms; --dur-base:200ms; --dur-slow:320ms;
  --ease-out:cubic-bezier(.22,1,.36,1);
  --spring:cubic-bezier(.34,1.56,.64,1);
}

[data-theme="dark"] {
  --bg:#0A0A0A; --surface:#141414; --surface-2:#1C1C1C;
  --border:#2A2A2A; --text:#FAFAFA; --text-muted:#A3A3A3; --text-faint:#737373;
  --primary-50:rgba(249,115,22,.12);
  --contrast-bg:#FAFAFA; --contrast-text:#0C0A09;
  --success-bg:rgba(16,185,129,.16); --warning-bg:rgba(234,179,8,.16);
  --danger-bg:rgba(239,68,68,.16);   --info-bg:rgba(14,165,233,.16);
  --violet-bg:rgba(139,92,246,.16);  --teal-bg:rgba(20,184,166,.16);
  --slate-bg:rgba(100,116,139,.2);
  --shadow-1:0 1px 2px rgba(0,0,0,.4), inset 0 1px 0 rgba(255,255,255,.05);
  --shadow-2:0 4px 12px rgba(0,0,0,.35), inset 0 1px 0 rgba(255,255,255,.06);
  --shadow-3:0 8px 24px rgba(0,0,0,.45), inset 0 1px 0 rgba(255,255,255,.06);
  --shadow-4:0 16px 48px rgba(0,0,0,.55), inset 0 1px 0 rgba(255,255,255,.06);
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation: none !important; transition-duration: 0.01ms !important; }
}
```

### 14.2 `tailwind.config.ts`

Salinan `client/tailwind.config.ts`.

```ts
import type { Config } from 'tailwindcss';

export default {
  darkMode: ['class', '[data-theme="dark"]'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'system-ui', '-apple-system', '"Segoe UI"', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      colors: {
        primary: {
          50: 'var(--primary-50)', 100: 'var(--primary-100)', 200: 'var(--primary-200)',
          400: 'var(--primary-400)', 500: 'var(--primary-500)', 600: 'var(--primary-600)',
          700: 'var(--primary-700)', 900: 'var(--primary-900)',
        },
        contrast: { bg: 'var(--contrast-bg)', text: 'var(--contrast-text)' },
        success: 'var(--success)', warning: 'var(--warning)', danger: 'var(--danger)',
        info: 'var(--info)', violet: 'var(--violet)', teal: 'var(--teal)',
        bg: 'var(--bg)', surface: 'var(--surface)', 'surface-2': 'var(--surface-2)',
        border: 'var(--border)', text: 'var(--text)',
        muted: 'var(--text-muted)', faint: 'var(--text-faint)',
      },
      borderRadius: {
        sm: 'var(--radius-sm)', md: 'var(--radius-md)',
        lg: 'var(--radius-lg)', xl: 'var(--radius-xl)',
      },
      boxShadow: {
        1: 'var(--shadow-1)', 2: 'var(--shadow-2)', 3: 'var(--shadow-3)',
        4: 'var(--shadow-4)', glow: 'var(--shadow-glow)',
      },
      backgroundImage: {
        'grad-primary': 'var(--grad-primary)',
        'grad-hero': 'var(--grad-hero)',
      },
      transitionTimingFunction: {
        out: 'var(--ease-out)', spring: 'var(--spring)',
      },
      fontSize: {
        display: ['40px', { lineHeight: '48px', fontWeight: '800' }],
        h1: ['28px', { lineHeight: '36px', fontWeight: '700' }],
        h2: ['22px', { lineHeight: '30px', fontWeight: '700' }],
        h3: ['18px', { lineHeight: '26px', fontWeight: '600' }],
        'body-lg': ['16px', { lineHeight: '24px' }],
        body: ['14px', { lineHeight: '22px' }],
        'body-sm': ['13px', { lineHeight: '20px' }],
        caption: ['12px', { lineHeight: '18px', fontWeight: '500' }],
      },
    },
  },
} satisfies Config;
```

### 14.3 Contoh Button (datar-modern, React + Tailwind)

Salinan `client/src/components/ui/Button.tsx`.

```tsx
import { forwardRef, type ButtonHTMLAttributes } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';
type Size = 'sm' | 'md' | 'lg';

const base =
  'inline-flex items-center justify-center gap-2 font-semibold rounded-md select-none ' +
  'transition duration-[120ms] ease-out focus-visible:outline-none ' +
  'focus-visible:ring-[3px] focus-visible:ring-primary-200 ' +
  'enabled:active:scale-[0.98] ' +
  'disabled:opacity-50 disabled:pointer-events-none';

const variants: Record<Variant, string> = {
  primary: 'bg-contrast-bg text-contrast-text hover:bg-primary-700 hover:text-white',
  secondary: 'bg-surface-2 text-text hover:bg-border',
  ghost: 'text-primary-600 hover:bg-primary-50',
  danger: 'bg-danger text-white hover:brightness-90',
  success: 'bg-success text-white hover:brightness-90',
};

const sizes: Record<Size, string> = {
  sm: 'h-9 px-3 text-body-sm',
  md: 'h-11 px-4 text-body',
  lg: 'h-[52px] px-6 text-body-lg font-bold',
};

type Props = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size };

export const Button = forwardRef<HTMLButtonElement, Props>(
  ({ variant = 'primary', size = 'md', className = '', ...rest }, ref) => (
    <button ref={ref} className={`${base} ${variants[variant]} ${sizes[size]} ${className}`} {...rest} />
  ),
);
Button.displayName = 'Button';
```

---

## 15. Aturan Konsistensi (wajib dicek tiap PR)

- [ ] Tidak ada hex, px, atau bayangan di luar token
- [ ] Hanya satu tombol `primary` per layar
- [ ] Gaya datar-modern: tanpa sisi tebal, tanpa gradien pada tombol. Oranye hemat; hitam (`contrast-*`) hanya untuk aksi utama dan menu aktif sidebar
- [ ] Status memakai peta di bagian 2.4 (warna + ikon + teks)
- [ ] Semua spasi kelipatan 4
- [ ] Area sentuh ≥ 44 px
- [ ] Mode gelap dicek untuk halaman baru
- [ ] `prefers-reduced-motion` dihormati
- [ ] Teks UI memakai gaya bahasa bagian 13
- [ ] Komponen baru ditambahkan ke dokumen ini sebelum dipakai di banyak tempat

---

## 16. Urutan Pembuatan Komponen

1. `tokens.css` + `tailwind.config.ts` + font
2. `Button`, `Input`, `Badge`, `Card`
3. Layout: `AppShell` (sidebar desktop, bottom nav mobile)
4. `AttendanceButton` (tombol Absen) + chip jarak
5. `Table` / daftar kartu, `Modal` / `BottomSheet`, `Toast`
6. `Skeleton`, `EmptyState`, `ErrorState`
7. Halaman Beranda Karyawan sebagai uji pertama seluruh token

> Halaman pertama yang dibangun (Beranda Karyawan) berfungsi sebagai **referensi visual**. Halaman lain mengikuti tampilannya.