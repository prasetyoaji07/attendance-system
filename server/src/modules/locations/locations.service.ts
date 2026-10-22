/** Logika bisnis lokasi absen (titik + radius geofence). Dependensi disuntik agar bisa di-unit-test tanpa DB. */
import type { AuthUser } from '../../core/middleware/auth';
import { isDuplicateEntry } from '../../core/db-errors';
import { AppError } from '../../core/errors';
import { RULES } from '../../core/rules';
import type { AuditFn, TxRunner } from '../../core/service-deps';
import type { CreateLocationInput, UpdateLocationInput } from './locations.schema';

export interface LocationRecord {
  id: number;
  nama: string;
  lat: number;
  lng: number;
  radiusM: number;
  /** Alamat lokasi kerja (satu teks). Opsional: NULL/kosong = belum diisi. */
  alamat?: string | null;
}

export type LocationWrite = Omit<LocationRecord, 'id'>;

export interface LocationsRepository {
  findAll(): Promise<LocationRecord[]>;
  findById(id: number, tx?: unknown): Promise<LocationRecord | null>;
  insert(data: LocationWrite, tx?: unknown): Promise<number>;
  update(id: number, data: LocationWrite, tx?: unknown): Promise<void>;
  remove(id: number, tx?: unknown): Promise<void>;
  countRosters(id: number): Promise<number>;
}

export interface LocationsDeps {
  repo: LocationsRepository;
  audit: AuditFn;
  runInTransaction: TxRunner;
}

const dupName = (nama: string) => AppError.conflict(`Nama lokasi "${nama}" sudah dipakai. Pakai nama lain ya.`);

/** Alamat kosong (atau hanya spasi) disimpan sebagai null. */
const cleanAlamat = (v: string | null | undefined): string | null => v?.trim() || null;

export function createLocationsService({ repo, audit, runInTransaction }: LocationsDeps) {
  async function mustFind(id: number): Promise<LocationRecord> {
    const l = await repo.findById(id);
    if (!l) throw AppError.notFound('Lokasi tidak ditemukan');
    return l;
  }

  return {
    list: () => repo.findAll(),

    get: (id: number) => mustFind(id),

    async create(input: CreateLocationInput, actor: AuthUser): Promise<LocationRecord> {
      const data: LocationWrite = {
        nama: input.nama,
        lat: input.lat,
        lng: input.lng,
        radiusM: input.radiusM ?? RULES.defaultRadiusM,
        ...(input.alamat !== undefined ? { alamat: cleanAlamat(input.alamat) } : {}),
      };
      try {
        const id = await runInTransaction(async (tx) => {
          const newId = await repo.insert(data, tx);
          await audit({ userId: actor.userId, action: 'LOCATION_CREATE', entity: 'locations', entityId: newId, after: data }, tx);
          return newId;
        });
        return { id, ...data };
      } catch (err) {
        if (isDuplicateEntry(err)) throw dupName(input.nama);
        throw err;
      }
    },

    async update(id: number, patch: UpdateLocationInput, actor: AuthUser): Promise<LocationRecord> {
      const existing = await mustFind(id);
      const next: LocationWrite = {
        nama: patch.nama ?? existing.nama,
        lat: patch.lat ?? existing.lat,
        lng: patch.lng ?? existing.lng,
        radiusM: patch.radiusM ?? existing.radiusM,
        // Hanya berubah bila alamat memang dikirim; kalau tidak, alamat lama dipertahankan.
        alamat: patch.alamat !== undefined ? cleanAlamat(patch.alamat) : existing.alamat,
      };
      const { id: _id, ...before } = existing;
      try {
        await runInTransaction(async (tx) => {
          await repo.update(id, next, tx);
          await audit({ userId: actor.userId, action: 'LOCATION_UPDATE', entity: 'locations', entityId: id, before, after: next }, tx);
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
        throw AppError.conflict(`Lokasi "${existing.nama}" sudah dipakai di ${used} roster, jadi tidak bisa dihapus.`);
      }
      const { id: _id, ...before } = existing;
      await runInTransaction(async (tx) => {
        await repo.remove(id, tx);
        await audit({ userId: actor.userId, action: 'LOCATION_DELETE', entity: 'locations', entityId: id, before }, tx);
      });
    },
  };
}

export type LocationsService = ReturnType<typeof createLocationsService>;
