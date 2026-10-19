import { describe, expect, it, vi } from 'vitest';
import type { AuthUser } from '../core/middleware/auth';
import { createTodayService, type TodayRepository } from '../modules/attendance/today.service';
import type { TodayCandidate } from '../utils/today-state';

const user: AuthUser = { userId: 1, employeeId: 7, role: 'EMPLOYEE' };
const loc = { id: 1, nama: 'Pabrik A', lat: -6.3, lng: 107.1, radiusM: 100 };

function setup(candidates: TodayCandidate[] = []) {
  const findTodayCandidates = vi.fn(async (_employeeId: number, _dates: string[]) => candidates);
  const repo: TodayRepository = { findTodayCandidates };
  return { repo, findTodayCandidates };
}

describe('today service', () => {
  it('meneruskan employeeId dari token dan tiga tanggal (kemarin, hari ini, besok) menurut WIB', async () => {
    const { repo, findTodayCandidates } = setup();
    // 2026-10-19 17:30 UTC = 2026-10-20 00:30 WIB -> "hari ini" adalah tanggal 20, bukan 19.
    const now = new Date('2026-10-19T17:30:00Z');
    await createTodayService({ repo, now: () => now }).getToday(user);
    expect(findTodayCandidates).toHaveBeenCalledTimes(1);
    expect(findTodayCandidates).toHaveBeenCalledWith(7, ['2026-10-19', '2026-10-20', '2026-10-21']);
  });

  it('tanggal benar di pergantian bulan', async () => {
    const { repo, findTodayCandidates } = setup();
    await createTodayService({ repo, now: () => new Date('2026-10-31T17:30:00Z') }).getToday(user);
    expect(findTodayCandidates).toHaveBeenCalledWith(7, ['2026-10-31', '2026-11-01', '2026-11-02']);
  });

  it('jam diambil dari now() yang disuntik, dan dikembalikan sebagai serverTime', async () => {
    const { repo } = setup();
    const now = new Date('2026-10-20T03:00:00Z');
    const r = await createTodayService({ repo, now: () => now }).getToday(user);
    expect(r.serverTime).toBe(now.toISOString());
    expect(r.status).toBe('NO_SCHEDULE');
  });

  it('menyerahkan data repo ke penentu status', async () => {
    const { repo } = setup([
      {
        rosterId: 12,
        shiftDate: '2026-10-20',
        shiftNama: 'Pagi',
        shift: { startTime: '08:00', endTime: '16:00', lateToleranceMinutes: 5 },
        location: loc,
        attendance: {
          attendanceId: 5,
          checkInAt: new Date('2026-10-20T01:03:00Z'), // 08:03 WIB
          checkOutAt: null,
          status: 'HADIR',
          lateMinutes: 0,
          earlyLeaveMinutes: 0,
          autoClosed: false,
          needsCorrection: false,
        },
      },
    ]);
    const now = new Date('2026-10-20T05:00:00Z'); // 12:00 WIB
    const r = await createTodayService({ repo, now: () => now }).getToday(user);
    expect(r.status).toBe('CHECKED_IN');
    expect(r.roster?.rosterId).toBe(12);
    expect(r.checkOut?.early).toBe(true);
  });

  it('repo hanya punya method baca (tidak ada jalur tulis)', () => {
    const { repo } = setup();
    expect(Object.keys(repo)).toEqual(['findTodayCandidates']);
  });
});
