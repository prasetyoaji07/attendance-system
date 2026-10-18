import { describe, it } from 'vitest';

/**
 * Aturan bisnis dari docs/alur.md bagian 8. Ubah `it.todo` jadi `it(...)` sambil implementasi (TDD).
 * Yang sudah punya test nyata:
 *  - 1, 2, 8 -> src/tests/shift-time.test.ts
 *  - 9       -> src/tests/hmac-qr.test.ts
 */
describe('aturan bisnis absensi', () => {
  it.todo('3. satu roster hanya boleh satu check-in (unique constraint / 409)');
  it.todo('4. jeda minimal antar shift >= 11 jam saat roster dibuat');
  it.todo('5. lembur dibayar hanya pada irisan jam disetujui dan jam terbukti');
  it.todo('6. cuti ditolak otomatis jika saldo tidak cukup');
  it.todo('7. periode LOCKED tidak bisa diubah langsung');
  it.todo('10. koreksi absen lewat pengajuan dan tercatat di audit log');
});
