/** Logika bisnis shift. Dependensi disuntik agar bisa di-unit-test tanpa DB. Penyambungan ada di shifts.controller.ts. */
import type { AuthUser } from '../../core/middleware/auth';
import { isDuplicateEntry } from '../../core/db-errors';
import { AppError } from '../../core/errors';
import { RULES } from '../../core/rules';
import type { AuditFn, TxRunner } from '../../core/service-deps';
import { isOvernight } from '../../utils/shift-time';
import type { CreateShiftInput, UpdateShiftInput } from './shifts.schema';

export interface ShiftRecord {
  id: number;
  nama: string;
  jamMulai: string; // 'HH:mm'
  jamSelesai: string; // 'HH:mm'
  lintasHari: boolean;
  toleransiMenit: number;
}

export type ShiftWrite = Omit<ShiftRecord, 'id'>;

export interface ShiftsRepository {
  findAll(): Promise<ShiftRecord[]>;
  findById(id: number, tx?: unknown): Promise<ShiftRecord | null>;
  insert(data: ShiftWrite, tx?: unknown): Promise<number>;
  update(id: number, data: ShiftWrite, tx?: unknown): Promise<void>;
  remove(id: number, tx?: unknown): Promise<void>;
  countRosters(id: number): Promise<number>;
}

export interface ShiftsDeps {
  repo: ShiftsRepository;
  audit: AuditFn;
  runInTransaction: TxRunner;
}

const dupName = (nama: string) => AppError.conflict(`Nama shift "${nama}" sudah dipakai. Pakai nama lain ya.`);

export function createShiftsService({ repo, audit, runInTransaction }: ShiftsDeps) {
  async function mustFind(id: number): Promise<ShiftRecord> {
    const s = await repo.findById(id);
    if (!s) throw AppError.notFound('Shift tidak ditemukan');
    return s;
  }

  return {
    list: () => repo.findAll(),

    get: (id: number) => mustFind(id),

    async create(input: CreateShiftInput, actor: AuthUser): Promise<ShiftRecord> {
      const data: ShiftWrite = {
        nama: input.nama,
        jamMulai: input.jamMulai,
        jamSelesai: input.jamSelesai,
        lintasHari: isOvernight(input.jamMulai, input.jamSelesai),
        toleransiMenit: input.toleransiMenit ?? RULES.lateToleranceMinutes,
      };
      try {
        const id = await runInTransaction(async (tx) => {
          const newId = await repo.insert(data, tx);
          await audit({ userId: actor.userId, action: 'SHIFT_CREATE', entity: 'shifts', entityId: newId, after: data }, tx);
          return newId;
        });
        return { id, ...data };
      } catch (err) {
        if (isDuplicateEntry(err)) throw dupName(input.nama);
        throw err;
      }
    },

    async update(id: number, patch: UpdateShiftInput, actor: AuthUser): Promise<ShiftRecord> {
      const existing = await mustFind(id);
      const jamMulai = patch.jamMulai ?? existing.jamMulai;
      const jamSelesai = patch.jamSelesai ?? existing.jamSelesai;
      if (jamMulai === jamSelesai) {
        throw AppError.badRequest('Jam mulai dan jam selesai tidak boleh sama.');
      }

      if (jamMulai !== existing.jamMulai || jamSelesai !== existing.jamSelesai) {
        const used = await repo.countRosters(id);
        if (used > 0) {
          throw AppError.conflict(
            `Jam shift ini sudah dipakai di ${used} roster, jadi tidak bisa diubah. Buat shift baru dengan jam yang diinginkan.`,
          );
        }
      }

      const next: ShiftWrite = {
        nama: patch.nama ?? existing.nama,
        jamMulai,
        jamSelesai,
        lintasHari: isOvernight(jamMulai, jamSelesai),
        toleransiMenit: patch.toleransiMenit ?? existing.toleransiMenit,
      };
      const { id: _id, ...before } = existing;
      try {
        await runInTransaction(async (tx) => {
          await repo.update(id, next, tx);
          await audit({ userId: actor.userId, action: 'SHIFT_UPDATE', entity: 'shifts', entityId: id, before, after: next }, tx);
        });
      } catch (err) {
        if (isDuplicateEntry(err)) throw dupName(next.nama);
        throw err;
      }
      return { id, ...next };
    },

    async remove(id: number, actor: AuthUser): Promise<void> {
      const existing = await mustFind(id);
      const used = await repo.countRosters(id);
      if (used > 0) {
        throw AppError.conflict(`Shift "${existing.nama}" sudah dipakai di ${used} roster, jadi tidak bisa dihapus.`);
      }
      const { id: _id, ...before } = existing;
      await runInTransaction(async (tx) => {
        await repo.remove(id, tx);
        await audit({ userId: actor.userId, action: 'SHIFT_DELETE', entity: 'shifts', entityId: id, before }, tx);
      });
    },
  };
}

export type ShiftsService = ReturnType<typeof createShiftsService>;
