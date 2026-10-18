/**
 * Logika bisnis device binding (docs/alur.md 5.2 dan 7.1). Dependensi disuntik agar bisa di-unit-test tanpa DB;
 * penyambungan ada di devices.controller.ts. Aturan murni ada di utils/device-binding.ts.
 *
 * Batas yang diketahui: dua perangkat BERBEDA yang mendaftar serentak untuk akun yang belum punya perangkat
 * bisa sama-sama active (tidak ada kunci di DB untuk itu). Kejadiannya sangat jarang dan belum ada kontrol hapus.
 */
import { isDuplicateEntry } from '../../core/db-errors';
import { AppError } from '../../core/errors';
import type { AuthUser } from '../../core/middleware/auth';
import type { AuditFn, TxRunner } from '../../core/service-deps';
import {
  checkDevice,
  decideRegistration,
  isValidDeviceId,
  planApproval,
  type DeviceRecord,
  type DeviceStatus,
} from '../../utils/device-binding';

/** Satu baris antrean persetujuan untuk HRD/ADMIN. */
export interface PendingDevice {
  id: number;
  userId: number;
  nik: string;
  nama: string;
  departmentNama: string;
  requestedAt: string; // ISO UTC
}

export interface DevicesRepository {
  findByUser(userId: number, tx?: unknown): Promise<DeviceRecord[]>;
  findById(id: number, tx?: unknown): Promise<DeviceRecord | null>;
  insert(userId: number, deviceId: string, status: DeviceStatus, tx?: unknown): Promise<number>;
  remove(ids: number[], tx?: unknown): Promise<void>;
  activate(id: number, tx?: unknown): Promise<void>;
  listPending(): Promise<PendingDevice[]>;
}

export interface DevicesDeps {
  repo: DevicesRepository;
  audit: AuditFn;
  runInTransaction: TxRunner;
}

export interface RegisterResult {
  status: DeviceStatus;
  /** true jika baris baru dibuat pada panggilan ini; false jika perangkat sudah terdaftar sebelumnya. */
  created: boolean;
  message: string;
}

export interface MyDevices {
  /** Status perangkat yang sedang dipakai (dari header), atau 'unregistered'. */
  current: DeviceStatus | 'unregistered';
  devices: { id: number; status: DeviceStatus; current: boolean }[];
}

const messageFor = (status: DeviceStatus, created: boolean): string => {
  if (status === 'active') return created ? 'Perangkat ini sudah terdaftar. Siap dipakai absen.' : 'Perangkat ini sudah terdaftar.';
  return 'Perangkat baru terdeteksi. Menunggu persetujuan HRD sebelum bisa dipakai absen.';
};

export function createDevicesService({ repo, audit, runInTransaction }: DevicesDeps) {
  async function mustFindPending(id: number): Promise<DeviceRecord> {
    const target = await repo.findById(id);
    if (!target) throw AppError.notFound('Permintaan perangkat tidak ditemukan');
    if (target.status !== 'pending') throw AppError.conflict('Perangkat ini sudah aktif, tidak ada yang perlu diputuskan.');
    return target;
  }

  return {
    /** Dipanggil klien setelah login. Aman diulang: perangkat yang sudah terdaftar tidak diubah. */
    async register(deviceId: unknown, actor: AuthUser): Promise<RegisterResult> {
      if (!isValidDeviceId(deviceId)) {
        throw AppError.badRequest('ID perangkat tidak valid. Muat ulang aplikasi, lalu coba lagi.');
      }
      const existing = await repo.findByUser(actor.userId);
      const decision = decideRegistration(existing, deviceId);
      if (decision.action === 'keep') {
        return { status: decision.status, created: false, message: messageFor(decision.status, false) };
      }

      try {
        await runInTransaction(async (tx) => {
          if (decision.replaceId !== null) await repo.remove([decision.replaceId], tx);
          const id = await repo.insert(actor.userId, deviceId, decision.status, tx);
          await audit(
            {
              userId: actor.userId,
              action: decision.status === 'active' ? 'DEVICE_REGISTER' : 'DEVICE_REQUEST',
              entity: 'devices',
              entityId: id,
              after: { status: decision.status, replacedPendingId: decision.replaceId },
            },
            tx,
          );
        });
      } catch (err) {
        if (!isDuplicateEntry(err)) throw err;
        // Dua permintaan untuk perangkat yang sama datang bersamaan: yang kalah cukup membaca hasil pemenang.
        const found = (await repo.findByUser(actor.userId)).find((d) => d.deviceId === deviceId);
        if (!found) throw err;
        return { status: found.status, created: false, message: messageFor(found.status, false) };
      }
      return { status: decision.status, created: true, message: messageFor(decision.status, true) };
    },

    /** Status perangkat milik akun ini. ID perangkat orang lain tidak pernah dikembalikan. */
    async me(deviceId: unknown, actor: AuthUser): Promise<MyDevices> {
      const devices = await repo.findByUser(actor.userId);
      const current = isValidDeviceId(deviceId) ? devices.find((d) => d.deviceId === deviceId) : undefined;
      return {
        current: current ? current.status : 'unregistered',
        devices: devices.map((d) => ({ id: d.id, status: d.status, current: d === current })),
      };
    },

    listPending: () => repo.listPending(),

    /** Setujui permintaan: perangkat jadi active, perangkat lama akun itu dihapus. HRD tidak boleh menyetujui perangkatnya sendiri. */
    async approve(id: number, actor: AuthUser): Promise<{ id: number; userId: number; replacedDevices: number }> {
      const target = await mustFindPending(id);
      if (target.userId === actor.userId && actor.role !== 'ADMIN') {
        throw AppError.forbidden('Kamu tidak bisa menyetujui perangkatmu sendiri. Minta HRD atau ADMIN lain.');
      }
      const { removeIds } = planApproval(target, await repo.findByUser(target.userId));
      await runInTransaction(async (tx) => {
        if (removeIds.length > 0) await repo.remove(removeIds, tx);
        await repo.activate(id, tx);
        await audit(
          {
            userId: actor.userId,
            action: 'DEVICE_CHANGE',
            entity: 'devices',
            entityId: id,
            before: { removedDeviceIds: removeIds },
            after: { userId: target.userId, status: 'active' },
          },
          tx,
        );
      });
      return { id, userId: target.userId, replacedDevices: removeIds.length };
    },

    /** Tolak permintaan: baris pending dihapus. Perangkat active akun itu tidak tersentuh. */
    async reject(id: number, actor: AuthUser): Promise<void> {
      const target = await mustFindPending(id);
      await runInTransaction(async (tx) => {
        await repo.remove([id], tx);
        await audit(
          {
            userId: actor.userId,
            action: 'DEVICE_REJECT',
            entity: 'devices',
            entityId: id,
            before: { userId: target.userId, status: 'pending' },
          },
          tx,
        );
      });
    },

    /** Guard check-in/check-out: lempar 403 (DEVICE_REQUIRED / DEVICE_NOT_REGISTERED / DEVICE_PENDING) jika perangkat belum boleh. */
    async assertUsable(userId: number, deviceId: unknown): Promise<void> {
      const check = checkDevice(deviceId, await repo.findByUser(userId));
      if (!check.ok) throw new AppError(403, check.code, check.message);
    },
  };
}

export type DevicesService = ReturnType<typeof createDevicesService>;
