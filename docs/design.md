# Design System: Sistem Absensi

> Satu sumber kebenaran untuk tampilan. Semua komponen **wajib** memakai token di dokumen ini.
> Dilarang memakai angka warna, ukuran, atau bayangan "asal" di komponen. Kalau butuh nilai baru, tambahkan dulu ke token.

**Stack:** React + TypeScript, Tailwind CSS, `lucide-react` untuk ikon.

---

## 1. Prinsip Desain

| Prinsip | Artinya |
|---|---|
| **Modern & premium** | Banyak ruang kosong, sudut membulat, warna terkontrol, tipografi tegas |
| **3D yang halus** | Kedalaman lewat lapisan bayangan, gradien tipis, dan efek tekan pada tombol. Bukan skeuomorphic berlebihan |
| **Mobile-first** | Karyawan absen dari HP. Layar utama harus bisa dipakai satu tangan |
| **Cepat dibaca** | Status harian terbaca dalam sekejap lewat warna + ikon + teks (tidak hanya warna) |
| **Konsisten** | Satu font, satu skala spasi, satu skala radius, satu set bayangan |
| **Ramah** | Bahasa santai tapi sopan, pakai "kamu" |

**Aturan emas:** efek 3D hanya untuk **elemen aksi utama** (tombol, kartu penting, tombol Absen). Elemen lain tetap flat supaya tidak ramai.

---

## 2. Warna

### 2.1 Brand

| Token | Hex | Pemakaian |
|---|---|---|
| `primary-50` | `#EEF2FF` | Latar tipis, hover ringan |
| `primary-100` | `#E0E7FF` | Badge, highlight |
| `primary-200` | `#C7D2FE` | Border aktif lembut |
| `primary-400` | `#818CF8` | Ikon aktif, gradien atas |
| `primary-500` | `#6366F1` | **Warna utama** |
| `primary-600` | `#4F46E5` | Hover, gradien bawah |
| `primary-700` | `#4338CA` | Pressed, sisi tebal tombol 3D |
| `primary-900` | `#312E81` | Teks di atas latar primary muda |
| `accent-400` | `#22D3EE` | Aksen sekunder (highlight, grafik) |
| `accent-500` | `#06B6D4` | Aksen sekunder pekat |

### 2.2 Netral (slate)

| Token | Light | Dark |
|---|---|---|
| `bg` (latar halaman) | `#F6F7FB` | `#0B0D14` |
| `surface` (kartu) | `#FFFFFF` | `#141826` |
| `surface-2` (kartu tingkat 2) | `#F1F3F9` | `#1B2133` |
| `border` | `#E3E6EF` | `#262C42` |
| `text` | `#0F172A` | `#F1F5F9` |
| `text-muted` | `#64748B` | `#94A3B8` |
| `text-faint` | `#94A3B8` | `#64748B` |

### 2.3 Semantik

| Token | Hex | Latar tipis | Dipakai untuk |
|---|---|---|---|
| `success` | `#10B981` | `#D1FAE5` | Hadir, approved |
| `warning` | `#F59E0B` | `#FEF3C7` | Telat, pending |
| `danger` | `#F43F5E` | `#FFE4E6` | Alpa, rejected, error |
| `info` | `#0EA5E9` | `#E0F2FE` | Izin, informasi |
| `violet` | `#8B5CF6` | `#EDE9FE` | Cuti |
| `teal` | `#14B8A6` | `#CCFBF1` | Lembur |
| `slate` | `#64748B` | `#E2E8F0` | Libur, draft, cancelled |

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
| `grad-primary` | `linear-gradient(180deg, #818CF8 0%, #6366F1 45%, #4F46E5 100%)` | Tombol primary, tombol Absen |
| `grad-hero` | `linear-gradient(135deg, #4F46E5 0%, #7C3AED 55%, #06B6D4 120%)` | Kartu hero (jadwal hari ini) |
| `grad-surface` | `linear-gradient(180deg, rgba(255,255,255,.9), rgba(255,255,255,.6))` | Kartu kaca (light) |
| `grad-glow` | `radial-gradient(60% 60% at 50% 0%, rgba(99,102,241,.25), transparent)` | Cahaya latar di atas halaman |

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
| `body-lg` | 16 / 24 | 500 | Teks utama di mobile |
| `body` | 14 / 22 | 400 | Teks standar |
| `caption` | 12 / 18 | 500 | Label, keterangan, badge |
| `mono` | 14 / 20 | 600 | Angka, jam, koordinat |

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
| `space-16` | 64 | `16` |

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

## 6. Bayangan dan Kedalaman (inti efek 3D)

Bayangan dibuat **berlapis** (dekat, sedang, jauh) supaya terasa nyata, bukan satu blur besar.

### Light mode

| Token | Nilai |
|---|---|
| `shadow-1` | `0 1px 2px rgba(15,23,42,.06), 0 1px 1px rgba(15,23,42,.04)` |
| `shadow-2` | `0 2px 4px rgba(15,23,42,.05), 0 8px 16px rgba(15,23,42,.06)` |
| `shadow-3` | `0 4px 8px rgba(15,23,42,.06), 0 16px 32px rgba(15,23,42,.10)` |
| `shadow-4` | `0 8px 16px rgba(15,23,42,.08), 0 32px 64px rgba(15,23,42,.14)` |
| `shadow-glow` | `0 8px 24px rgba(99,102,241,.35)` |

### Dark mode
Kurangi opasitas bayangan hitam dan tambahkan garis tipis terang di tepi atas:
`inset 0 1px 0 rgba(255,255,255,.06)`

### Efek 3D standar

| Efek | Resep |
|---|---|
| **Highlight atas** | `inset 0 1px 0 rgba(255,255,255,.35)` pada elemen gradien |
| **Sisi tebal (extrude)** | `0 4px 0 <warna-700>` di bawah tombol, memberi kesan tebal |
| **Efek tekan** | Saat `:active`: `translateY(3px)` dan sisi tebal menyusut jadi `0 1px 0` |
| **Kaca (glass)** | `background: rgba(255,255,255,.65)` + `backdrop-filter: blur(16px) saturate(160%)` + border `1px solid rgba(255,255,255,.5)` |
| **Angkat saat hover** | `translateY(-2px)` + naik satu level bayangan |
| **Kemiringan halus (opsional)** | Kartu hero: `perspective(900px) rotateX(2deg)` pada hover desktop saja |

---

## 7. Layout

### Breakpoint

| Nama | Lebar | Pola |
|---|---|---|
| `sm` | < 640 | Mobile: 1 kolom, **bottom navigation** |
| `md` | 640-1023 | Tablet: 2 kolom |
| `lg` | ≥ 1024 | Desktop: **sidebar** kiri + konten |

- Lebar konten maksimal: `1200px`, di tengah.
- Grid: 4 kolom (mobile), 8 (tablet), 12 (desktop). Gap 16 (mobile), 24 (desktop).
- Sidebar: lebar 264 (kaca, sticky). Bottom nav: tinggi 64 + safe-area.
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

| Varian | Tampilan | Dipakai |
|---|---|---|
| `primary` | Gradien `grad-primary`, teks putih, highlight atas, sisi tebal `primary-700`, efek tekan | Aksi utama (1 per layar) |
| `secondary` | Latar `surface`, border `border`, teks `text`, `shadow-1` | Aksi pendamping |
| `ghost` | Tanpa latar, teks `primary-600`, hover `primary-50` | Aksi tersier |
| `danger` | Gradien merah (sama resep primary), sisi tebal `#BE123C` | Hapus, tolak |
| `success` | Gradien hijau (resep sama), sisi tebal `#047857` | Setujui |

| Ukuran | Tinggi | Padding X | Font | Ikon |
|---|---|---|---|---|
| `sm` | 36 | 12 | 13 / 600 | 16 |
| `md` | 44 | 16 | 14 / 600 | 20 |
| `lg` | 52 | 24 | 16 / 700 | 20 |

Aturan: radius `radius-md`, jarak ikon-teks 8. Status: `hover` angkat 2px, `active` tekan 3px, `focus-visible` ring 3px `primary-200`, `disabled` opasitas 50% tanpa efek 3D, `loading` ganti ikon dengan spinner dan kunci klik.

### 9.2 Tombol Absen (hero action)

Satu-satunya elemen yang paling "3D" di seluruh aplikasi.

- Bentuk: lingkaran `radius-full`, diameter **168** (mobile) / 192 (desktop).
- Latar: `grad-primary` + highlight atas + sisi tebal `0 8px 0 primary-700` + `shadow-glow`.
- Cincin berdenyut (pulse) lembut di sekelilingnya saat siap absen.
- Isi: ikon `Fingerprint` 40 + teks "Absen Masuk" / "Absen Pulang" (`h3`, putih).
- Status:
  - **Siap**: gradien primary, pulse aktif.
  - **Mencari lokasi**: gradien netral, spinner, teks "Mencari lokasi...".
  - **Di luar area**: gradien `danger`, teks "Di luar area", tampilkan jarak (mono).
  - **Sudah absen**: gradien `success`, ikon centang, tanpa pulse.
- Di bawahnya: chip jarak ("42 m dari Pabrik 1") dan akurasi GPS.

### 9.3 Card

| Varian | Resep |
|---|---|
| `card` | `surface`, border `border`, `radius-lg`, `shadow-2`, padding 20 |
| `card-glass` | Resep kaca (bagian 6), `radius-xl`, untuk di atas latar gradien |
| `card-hero` | `grad-hero`, teks putih, `radius-xl`, `shadow-4`, hiasan lingkaran blur di pojok |
| `card-stat` | `card` + ikon di kotak `radius-sm` berwarna tipis + angka `h1` mono + tren kecil |

Kartu yang bisa diklik: hover angkat 2px + `shadow-3`.

### 9.4 Input dan Form

- Tinggi 48, `radius-md`, border `border`, latar `surface`, padding X 16.
- Label di atas (`caption` 600, `text-muted`), jarak 8.
- Focus: border `primary-500` + ring 3px `primary-200`.
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

- **Mobile:** bottom nav 4-5 item (Beranda, Jadwal, Absen di tengah menonjol, Pengajuan, Profil). Item tengah berupa lingkaran 3D yang terangkat.
- **Desktop:** sidebar kaca; item aktif memakai latar `primary-50`, teks `primary-600`, indikator batang 3px di kiri.
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
- Chip filter: pill tinggi 36, aktif = latar `primary-500` teks putih.
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
| `ease-in-out` | `cubic-bezier(.65,0,.35,1)` | Perpindahan |
| `spring` | `cubic-bezier(.34,1.56,.64,1)` | Tombol 3D kembali setelah ditekan |

Aturan:
- Animasikan hanya `transform` dan `opacity`.
- Daftar muncul bertahap (stagger 40 ms, maksimal 8 item).
- **Wajib** hormati `prefers-reduced-motion`: matikan pulse, tilt, dan stagger.

---

## 12. Aksesibilitas

- Kontras teks minimal **4.5:1** (WCAG AA). Teks putih di atas gradien primary lolos; cek ulang tiap warna baru.
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

```css
:root {
  /* brand */
  --primary-50:#EEF2FF; --primary-100:#E0E7FF; --primary-200:#C7D2FE;
  --primary-400:#818CF8; --primary-500:#6366F1; --primary-600:#4F46E5;
  --primary-700:#4338CA; --primary-900:#312E81;
  --accent-400:#22D3EE; --accent-500:#06B6D4;

  /* semantik */
  --success:#10B981; --success-bg:#D1FAE5;
  --warning:#F59E0B; --warning-bg:#FEF3C7;
  --danger:#F43F5E;  --danger-bg:#FFE4E6;
  --info:#0EA5E9;    --info-bg:#E0F2FE;
  --violet:#8B5CF6;  --violet-bg:#EDE9FE;
  --teal:#14B8A6;    --teal-bg:#CCFBF1;
  --slate:#64748B;   --slate-bg:#E2E8F0;

  /* surface (light) */
  --bg:#F6F7FB; --surface:#FFFFFF; --surface-2:#F1F3F9;
  --border:#E3E6EF; --text:#0F172A; --text-muted:#64748B; --text-faint:#94A3B8;

  /* radius */
  --radius-sm:8px; --radius-md:12px; --radius-lg:16px; --radius-xl:24px;

  /* shadow */
  --shadow-1:0 1px 2px rgba(15,23,42,.06),0 1px 1px rgba(15,23,42,.04);
  --shadow-2:0 2px 4px rgba(15,23,42,.05),0 8px 16px rgba(15,23,42,.06);
  --shadow-3:0 4px 8px rgba(15,23,42,.06),0 16px 32px rgba(15,23,42,.10);
  --shadow-4:0 8px 16px rgba(15,23,42,.08),0 32px 64px rgba(15,23,42,.14);
  --shadow-glow:0 8px 24px rgba(99,102,241,.35);

  /* gradient */
  --grad-primary:linear-gradient(180deg,#818CF8 0%,#6366F1 45%,#4F46E5 100%);
  --grad-hero:linear-gradient(135deg,#4F46E5 0%,#7C3AED 55%,#06B6D4 120%);

  /* motion */
  --dur-fast:120ms; --dur-base:200ms; --dur-slow:320ms;
  --ease-out:cubic-bezier(.22,1,.36,1);
  --spring:cubic-bezier(.34,1.56,.64,1);
}

[data-theme="dark"] {
  --bg:#0B0D14; --surface:#141826; --surface-2:#1B2133;
  --border:#262C42; --text:#F1F5F9; --text-muted:#94A3B8; --text-faint:#64748B;
  --primary-50:rgba(99,102,241,.12);
  --success-bg:rgba(16,185,129,.16); --warning-bg:rgba(245,158,11,.16);
  --danger-bg:rgba(244,63,94,.16);   --info-bg:rgba(14,165,233,.16);
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
        accent: { 400: 'var(--accent-400)', 500: 'var(--accent-500)' },
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
        caption: ['12px', { lineHeight: '18px', fontWeight: '500' }],
      },
    },
  },
} satisfies Config;
```

### 14.3 Contoh Button 3D (React + Tailwind)

```tsx
import { forwardRef, type ButtonHTMLAttributes } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';
type Size = 'sm' | 'md' | 'lg';

const base =
  'inline-flex items-center justify-center gap-2 font-semibold rounded-md select-none ' +
  'transition-all duration-[120ms] ease-out focus-visible:outline-none ' +
  'focus-visible:ring-[3px] focus-visible:ring-primary-200 ' +
  'disabled:opacity-50 disabled:pointer-events-none';

const variants: Record<Variant, string> = {
  primary:
    'bg-grad-primary text-white shadow-[inset_0_1px_0_rgba(255,255,255,.35),0_4px_0_var(--primary-700),0_10px_20px_rgba(99,102,241,.3)] ' +
    'hover:-translate-y-0.5 active:translate-y-[3px] ' +
    'active:shadow-[inset_0_1px_0_rgba(255,255,255,.25),0_1px_0_var(--primary-700)]',
  secondary: 'bg-surface text-text border border-border shadow-1 hover:shadow-2 hover:-translate-y-0.5',
  ghost: 'text-primary-600 hover:bg-primary-50',
  danger:
    'bg-gradient-to-b from-rose-400 to-rose-600 text-white ' +
    'shadow-[inset_0_1px_0_rgba(255,255,255,.35),0_4px_0_#BE123C] active:translate-y-[3px] active:shadow-[0_1px_0_#BE123C]',
  success:
    'bg-gradient-to-b from-emerald-400 to-emerald-600 text-white ' +
    'shadow-[inset_0_1px_0_rgba(255,255,255,.35),0_4px_0_#047857] active:translate-y-[3px] active:shadow-[0_1px_0_#047857]',
};

const sizes: Record<Size, string> = {
  sm: 'h-9 px-3 text-[13px]',
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
- [ ] Efek 3D hanya di tombol aksi, tombol Absen, dan `card-hero`
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
