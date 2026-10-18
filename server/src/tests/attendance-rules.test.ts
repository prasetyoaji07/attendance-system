import { describe, it } from 'vitest';

/**
 * Aturan bisnis dari docs/alur.md bagian 8. Ubah `it.todo` jadi `it(...)` sambil implementasi (TDD).
 */
describe('aturan bisnis absensi', () => {
  it.todo('1. shift malam 22:00-06:00 dihitung ke shift_date hari mulainya');
  it.todo('2. telat dihitung dari jam mulai + toleransi, bukan jam mulai');
  it.todo('3. satu roster hanya boleh satu check-in (unique constraint / 409)');
  it.todo('4. jeda minimal antar shift >= 11 jam saat roster dibuat');
  it.todo('5. lembur dibayar hanya pada irisan jam disetujui dan jam terbukti');
  it.todo('6. cuti ditolak otomatis jika saldo tidak cukup');
  it.todo('7. periode LOCKED tidak bisa diubah langsung');
  it.todo('8. check-in di luar jendela waktu ditolak');
  it.todo('9. QR expired atau tanda tangan salah ditolak (sudah ada di hmac-qr.test.ts)');
  it.todo('10. koreksi absen lewat pengajuan dan tercatat di audit log');
});
