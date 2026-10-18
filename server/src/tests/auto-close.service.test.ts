import { describe, expect, it } from 'vitest';
import type { AuditEntry } from '../core/audit';
import { createAutoCloseService, type AutoCloseRepository } from '../modules/attendance/auto-close.service';
import type { OpenAttendanceRow } from '../utils/auto-close';
import type { ShiftDef } from '../utils/shift-time';

const wib = (s: string) => new Date(`${s}+07:00`);
const PAGI: ShiftDef = { startTime: '06:00', endTime: '14:00', lateToleranceMinutes: 5 };
const MALAM: ShiftDef = { startTime: '22:00', endTime: '06:00', lateToleranceMinutes: 5 };

function setup(seed: OpenAttendanceRow[], opts: { raceLoser?: number; failOn?: number } = {}) {
  const open = seed.map((r) => ({ ...r }));
  const audits: AuditEntry[] = [];
  let transactions = 0;
  const repo: AutoCloseRepository = {
    findOpen: async () => open.map((r) => ({ ...r })),
    markAutoClosed: async (id) => {
      if (opts.failOn === id) throw new Error('DB putus');
      if (opts.raceLoser === id) return false; // pegawai keburu check-out di antara SELECT dan UPDATE
      const i = open.findIndex((r) => r.attendanceId === id);
      if (i < 0) return false;
      open.splice(i, 1);
      return true;
    },
  };
  const service = createAutoCloseService({
    repo,
    audit: async (e) => void audits.push(e),
    runInTransaction: (fn) => {
      transactions++;
      return fn('tx');
    },
  });
  return { service, open, audits, tx: () => transactions };
}

const rows: OpenAttendanceRow[] = [
  { attendanceId: 1, shiftDate: '2026-10-17', shift: PAGI },
  { attendanceId: 2, shiftDate: '2026-10-18', shift: PAGI },
  { attendanceId: 3, shiftDate: '2026-10-17', shift: MALAM },
];

describe('auto-close.run', () => {
  it('menutup hanya yang lewat batas, mencatat audit sistem (userId null) per absen', async () => {
    const { service, open, audits } = setup(rows);
    const r = await service.run(wib('2026-10-18T15:00:00'));
    expect(r).toEqual({ checked: 3, due: 2, closed: [1, 3], failed: [] });
    expect(open.map((x) => x.attendanceId)).toEqual([2]);
    expect(audits).toHaveLength(2);
    expect(audits[0]).toMatchObject({
      userId: null,
      action: 'ATTENDANCE_AUTO_CLOSE',
      entity: 'attendance',
      entityId: 1,
      after: { autoClosed: true, needsCorrection: true },
    });
  });

  it('idempoten: dijalankan dua kali, kedua kali tidak menutup apa-apa dan tidak menulis audit baru', async () => {
    const { service, audits } = setup(rows);
    const at = wib('2026-10-18T15:00:00');
    await service.run(at);
    const again = await service.run(at);
    expect(again).toEqual({ checked: 1, due: 0, closed: [], failed: [] });
    expect(audits).toHaveLength(2);
  });

  it('tidak ada yang terbuka: hasil kosong, tanpa transaksi', async () => {
    const { service, tx } = setup([]);
    expect(await service.run(wib('2026-10-18T15:00:00'))).toEqual({ checked: 0, due: 0, closed: [], failed: [] });
    expect(tx()).toBe(0);
  });

  it('kalah balapan dengan check-out: tidak dihitung ditutup dan tidak diaudit', async () => {
    const { service, audits } = setup(rows, { raceLoser: 1 });
    const r = await service.run(wib('2026-10-18T15:00:00'));
    expect(r.closed).toEqual([3]);
    expect(r.due).toBe(2);
    expect(audits).toHaveLength(1);
  });

  it('satu baris gagal tidak menghentikan yang lain, dan dilaporkan di failed', async () => {
    const { service } = setup(rows, { failOn: 1 });
    const r = await service.run(wib('2026-10-18T15:00:00'));
    expect(r.closed).toEqual([3]);
    expect(r.failed).toEqual([1]);
  });

  it('setiap absen ditutup dalam transaksinya sendiri (update + audit atomik)', async () => {
    const { service, tx } = setup(rows);
    await service.run(wib('2026-10-18T15:00:00'));
    expect(tx()).toBe(2);
  });
});

describe('auto-close.preview', () => {
  it('menampilkan yang akan ditutup tanpa menulis apa pun', async () => {
    const { service, open, audits } = setup(rows);
    const p = await service.preview(wib('2026-10-18T15:00:00'));
    expect(p).toEqual({ checked: 3, due: [1, 3] });
    expect(open).toHaveLength(3);
    expect(audits).toHaveLength(0);
  });
});
