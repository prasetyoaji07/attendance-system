import type { NextFunction, Request, Response } from 'express';
import { describe, expect, it } from 'vitest';
import { AppError } from '../core/errors';
import { createRequireDevice, type DeviceGuard } from '../modules/devices/require-device';

const DEVICE = 'device-abcdef-0123456789';

function run(guard: DeviceGuard, req: Partial<Request>) {
  const calls: unknown[][] = [];
  const next = ((...args: unknown[]) => void calls.push(args)) as NextFunction;
  const done = createRequireDevice(guard)(req as Request, {} as Response, next);
  return { done, calls };
}

const user = { userId: 7, employeeId: 11, role: 'EMPLOYEE' as const };

describe('requireDevice (guard check-in/check-out)', () => {
  it('perangkat boleh: next() dipanggil tanpa argumen', async () => {
    const { done, calls } = run({ assertUsable: async () => {} }, { user, headers: { 'x-device-id': DEVICE } });
    await done;
    expect(calls).toEqual([[]]);
  });

  it('meneruskan userId dari token dan isi header x-device-id ke guard', async () => {
    const seen: unknown[][] = [];
    const { done } = run({ assertUsable: async (u, d) => void seen.push([u, d]) }, { user, headers: { 'x-device-id': DEVICE } });
    await done;
    expect(seen).toEqual([[7, DEVICE]]);
  });

  it('header tidak ada: guard tetap dipanggil dengan undefined (keputusan DEVICE_REQUIRED ada di guard)', async () => {
    const seen: unknown[][] = [];
    const { done } = run({ assertUsable: async (u, d) => void seen.push([u, d]) }, { user, headers: {} });
    await done;
    expect(seen).toEqual([[7, undefined]]);
  });

  it('guard menolak (403): error diteruskan ke next persis apa adanya, request tidak lanjut', async () => {
    const denied = new AppError(403, 'DEVICE_PENDING', 'Perangkat ini masih menunggu persetujuan HRD.');
    const { done, calls } = run(
      {
        assertUsable: async () => {
          throw denied;
        },
      },
      { user, headers: { 'x-device-id': DEVICE } },
    );
    await done;
    expect(calls).toHaveLength(1);
    expect(calls[0][0]).toBe(denied);
  });

  it('galat tak terduga (mis. DB mati) juga diteruskan ke next, bukan ditelan', async () => {
    const boom = new Error('koneksi putus');
    const { done, calls } = run(
      {
        assertUsable: async () => {
          throw boom;
        },
      },
      { user, headers: { 'x-device-id': DEVICE } },
    );
    await done;
    expect(calls[0][0]).toBe(boom);
  });

  it('tanpa req.user (requireAuth terlewat): 401 dan guard tidak dipanggil', async () => {
    let called = false;
    const { done, calls } = run({ assertUsable: async () => void (called = true) }, { headers: { 'x-device-id': DEVICE } });
    await done;
    expect(called).toBe(false);
    expect((calls[0][0] as AppError).status).toBe(401);
  });
});
