import type { PoolConnection } from 'mysql2/promise';
import { pool } from './db';

export interface AuditEntry {
  userId: number | null;
  action: string; // contoh: 'PERIOD_LOCK', 'ATTENDANCE_CORRECT', 'DEVICE_CHANGE'
  entity: string; // contoh: 'periods'
  entityId: number | string;
  before?: unknown;
  after?: unknown;
}

/**
 * Catat aksi sensitif. Butuh tabel `audit_logs` (dibuat di migration fase 1):
 * (id, user_id, action, entity, entity_id, before_json, after_json, created_at)
 * Kirim `conn` agar ikut transaksi yang sedang berjalan.
 */
export async function writeAudit(entry: AuditEntry, conn?: PoolConnection) {
  const runner = conn ?? pool;
  await runner.execute(
    'INSERT INTO audit_logs (user_id, action, entity, entity_id, before_json, after_json) VALUES (?,?,?,?,?,?)',
    [
      entry.userId,
      entry.action,
      entry.entity,
      String(entry.entityId),
      entry.before === undefined ? null : JSON.stringify(entry.before),
      entry.after === undefined ? null : JSON.stringify(entry.after),
    ],
  );
}
