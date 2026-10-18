import { describe, expect, it } from 'vitest';
import { assertNoExistingCheckIn } from '../utils/daily-status';
import { findRestViolations } from '../utils/roster-rules';
import { buildShiftWindow } from '../utils/shift-time';

/**
 * Aturan bisnis dari docs/alur.md bagian 8. Ubah `it.todo` jadi `it(...)` sambil implementasi (TDD).
 * Yang sudah punya test nyata (detail lengkap ada di file masing-masing):
 *  - 1, 2, 8 -> src/tests/shift-time.test.ts (dan daily-status.test.ts untuk shift malam)
 *  - 3       -> src/tests/daily-status.test.ts
 *  - 4       -> src/tests/roster-rules.test.ts dan roster.service.test.ts
 *  - 9       -> src/tests/hmac-qr.test.ts
 * Di bawah ini ringkasan 3 dan 4 sebagai penanda daftar aturan; sisanya masih todo.
 */
describe('aturan bisnis absensi', () => {
  it('3. satu roster hanya boleh satu check-in (409)', () => {
    expect(() => assertNoExistingCheckIn({ checkInAt: new Date() })).toThrow();
  });

  it('4. jeda minimal antar shift >= 11 jam saat roster dibuat', () => {
    const siang = buildShiftWindow('2026-03-01', { startTime: '14:00', endTime: '22:00', lateToleranceMinutes: 5 });
    const pagi = buildShiftWindow('2026-03-02', { startTime: '06:00', endTime: '14:00', lateToleranceMinutes: 5 });
    const v = findRestViolations([
      { employeeId: 1, shiftDate: '2026-03-01', window: siang, isNew: true },
      { employeeId: 1, shiftDate: '2026-03-02', window: pagi, isNew: true },
    ]);
    expect(v).toHaveLength(1);
  });

  it.todo('5. lembur dibayar hanya pada irisan jam disetujui dan jam terbukti');
  it.todo('6. cuti ditolak otomatis jika saldo tidak cukup');
  it.todo('7. periode LOCKED tidak bisa diubah langsung');
  it.todo('10. koreksi absen lewat pengajuan dan tercatat di audit log');
});
