/** Logika bisnis roster. Dependensi disuntik agar bisa di-unit-test tanpa DB. Penyambungan ada di roster.controller.ts. */
import type { AuthUser } from '../../core/middleware/auth';
import { isDuplicateEntry } from '../../core/db-errors';
import { AppError } from '../../core/errors';
import { RULES } from '../../core/rules';
import type { AuditFn, TxRunner } from '../../core/service-deps';
import {
  addDays,
  findRestViolations,
  findUnknownShifts,
  generateRosterEntries,
  type PatternShift,
  type PlannedRoster,
  type RestCheckItem,
  type RestViolation,
} from '../../utils/roster-rules';
import { buildShiftWindow } from '../../utils/shift-time';
import type { LocationRecord } from '../locations/locations.service';
import type { ShiftRecord } from '../shifts/shifts.service';
import type { CreatePatternInput, GenerateRosterInput, ListRosterQuery } from './roster.schema';

export interface PatternRecord {
  id: number;
  nama: string;
  urutan: string[];
}

export interface RosterRow {
  id: number;
  employeeId: number;
  shiftDate: string; // 'YYYY-MM-DD'
  shiftId: number;
  locationId: number;
}

export interface RosterListItem extends RosterRow {
  employeeNama: string;
  shiftNama: string;
  jamMulai: string;
  jamSelesai: string;
  lintasHari: boolean;
  locationNama: string;
}

export interface RosterInsert {
  employeeId: number;
  shiftDate: string;
  shiftId: number;
  locationId: number;
}

export interface RosterRepository {
  findPatterns(): Promise<PatternRecord[]>;
  findPatternById(id: number): Promise<PatternRecord | null>;
  insertPattern(data: { nama: string; urutan: string[] }, tx?: unknown): Promise<number>;
  findActiveEmployeeIds(ids: number[]): Promise<number[]>;
  findRosters(employeeIds: number[], from: string, to: string): Promise<RosterRow[]>;
  insertRosters(rows: RosterInsert[], tx?: unknown): Promise<void>;
  list(filter: { from: string; to: string; employeeId?: number }): Promise<RosterListItem[]>;
}

export interface RosterDeps {
  repo: RosterRepository;
  shifts: { findAll(): Promise<ShiftRecord[]> };
  locations: { findById(id: number): Promise<LocationRecord | null> };
  audit: AuditFn;
  runInTransaction: TxRunner;
}

export interface GenerateResult {
  dryRun: boolean;
  from: string;
  to: string;
  created: number;
  skipped: { employeeId: number; shiftDate: string }[];
}

const toPatternShift = (s: ShiftRecord): PatternShift => ({
  id: s.id,
  nama: s.nama,
  def: { startTime: s.jamMulai, endTime: s.jamSelesai, lateToleranceMinutes: s.toleransiMenit },
});

function restMessage(v: RestViolation, total: number): string {
  const more = total > 1 ? ` (dan ${total - 1} pelanggaran lain)` : '';
  return (
    `Jadwal ditolak: jeda antar shift kurang dari ${v.minRestHours} jam. ` +
    `Karyawan #${v.employeeId}: shift ${v.previousDate} ke ${v.nextDate} hanya berjarak ${v.restHours} jam${more}. ` +
    'Ubah pola atau offset-nya lalu coba lagi.'
  );
}

export function createRosterService({ repo, shifts, locations, audit, runInTransaction }: RosterDeps) {
  async function loadShiftsForPattern(urutan: string[]): Promise<ShiftRecord[]> {
    const all = await shifts.findAll();
    const unknown = findUnknownShifts(urutan, all.map((s) => s.nama));
    if (unknown.length > 0) {
      throw AppError.badRequest(
        `Pola memakai shift yang belum ada: ${unknown.map((n) => `"${n}"`).join(', ')}. Buat shiftnya dulu atau perbaiki polanya.`,
      );
    }
    return all;
  }

  return {
    listPatterns: () => repo.findPatterns(),

    async createPattern(input: CreatePatternInput, actor: AuthUser): Promise<PatternRecord> {
      await loadShiftsForPattern(input.urutan);
      if (input.urutan.every((n) => n.trim().toLowerCase() === 'libur')) {
        throw AppError.badRequest('Pola tidak boleh libur semua.');
      }
      const data = { nama: input.nama, urutan: input.urutan };
      try {
        const id = await runInTransaction(async (tx) => {
          const newId = await repo.insertPattern(data, tx);
          await audit({ userId: actor.userId, action: 'PATTERN_CREATE', entity: 'shift_patterns', entityId: newId, after: data }, tx);
          return newId;
        });
        return { id, ...data };
      } catch (err) {
        if (isDuplicateEntry(err)) throw AppError.conflict(`Nama pola "${input.nama}" sudah dipakai. Pakai nama lain ya.`);
        throw err;
      }
    },

    async list(query: ListRosterQuery, actor: AuthUser): Promise<RosterListItem[]> {
      // Karyawan biasa hanya boleh melihat jadwalnya sendiri.
      const employeeId = actor.role === 'EMPLOYEE' ? actor.employeeId : query.employeeId;
      return repo.list({ from: query.from, to: query.to, employeeId });
    },

    async generate(input: GenerateRosterInput, actor: AuthUser): Promise<GenerateResult> {
      const pattern = await repo.findPatternById(input.patternId);
      if (!pattern) throw AppError.notFound('Pola shift tidak ditemukan');
      const location = await locations.findById(input.locationId);
      if (!location) throw AppError.notFound('Lokasi tidak ditemukan');

      const ids = input.employees.map((e) => e.employeeId);
      if (new Set(ids).size !== ids.length) throw AppError.badRequest('Ada karyawan yang dipilih dua kali.');
      const active = new Set(await repo.findActiveEmployeeIds(ids));
      const missing = ids.filter((i) => !active.has(i));
      if (missing.length > 0) {
        throw AppError.badRequest(`Karyawan tidak ditemukan atau nonaktif: ${missing.map((i) => `#${i}`).join(', ')}.`);
      }

      const allShifts = await loadShiftsForPattern(pattern.urutan);
      const patternShifts = allShifts.map(toPatternShift);
      const anchorDate = input.anchorDate ?? input.from;

      // Roster yang sudah ada, termasuk sehari di luar rentang di kedua sisi untuk cek jeda di batas.
      const existing = await repo.findRosters(ids, addDays(input.from, -1), addDays(input.to, 1));
      const shiftById = new Map(allShifts.map((s) => [s.id, toPatternShift(s)]));
      const existingKeys = new Set(existing.map((r) => `${r.employeeId}|${r.shiftDate}`));

      const toCreate: PlannedRoster[] = [];
      const skipped: GenerateResult['skipped'] = [];
      for (const e of input.employees) {
        const entries = generateRosterEntries({
          employeeId: e.employeeId,
          urutan: pattern.urutan,
          shifts: patternShifts,
          anchorDate,
          offset: e.offset ?? 0,
          from: input.from,
          to: input.to,
        });
        for (const entry of entries) {
          if (existingKeys.has(`${entry.employeeId}|${entry.shiftDate}`)) {
            skipped.push({ employeeId: entry.employeeId, shiftDate: entry.shiftDate });
          } else {
            toCreate.push(entry);
          }
        }
      }

      const items: RestCheckItem[] = [
        ...existing.flatMap((r) => {
          const s = shiftById.get(r.shiftId);
          return s ? [{ employeeId: r.employeeId, shiftDate: r.shiftDate, window: buildShiftWindow(r.shiftDate, s.def), isNew: false }] : [];
        }),
        ...toCreate.map((c) => ({ employeeId: c.employeeId, shiftDate: c.shiftDate, window: c.window, isNew: true })),
      ];
      const violations = findRestViolations(items, RULES.minRestHoursBetweenShifts);
      if (violations.length > 0) {
        throw new AppError(409, 'REST_VIOLATION', restMessage(violations[0], violations.length), violations);
      }

      const result: GenerateResult = {
        dryRun: input.dryRun === true,
        from: input.from,
        to: input.to,
        created: toCreate.length,
        skipped,
      };
      if (result.dryRun || toCreate.length === 0) return result;

      const rows: RosterInsert[] = toCreate.map((c) => ({
        employeeId: c.employeeId,
        shiftDate: c.shiftDate,
        shiftId: c.shiftId,
        locationId: input.locationId,
      }));
      try {
        await runInTransaction(async (tx) => {
          await repo.insertRosters(rows, tx);
          await audit(
            {
              userId: actor.userId,
              action: 'ROSTER_GENERATE',
              entity: 'rosters',
              entityId: `${input.from}..${input.to}`,
              after: {
                patternId: input.patternId,
                locationId: input.locationId,
                from: input.from,
                to: input.to,
                employeeIds: ids,
                created: rows.length,
                skipped: skipped.length,
              },
            },
            tx,
          );
        });
      } catch (err) {
        if (isDuplicateEntry(err)) {
          throw AppError.conflict('Jadwal baru saja diubah orang lain. Coba proses ulang supaya data terbaru terbaca.');
        }
        throw err;
      }
      return result;
    },
  };
}

export type RosterService = ReturnType<typeof createRosterService>;
