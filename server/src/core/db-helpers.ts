import type { PoolConnection } from 'mysql2/promise';
import { pool } from './db';
import { writeAudit, type AuditEntry } from './audit';
import { withTransaction } from './db';
import type { AuditFn, TxRunner } from './service-deps';

/** Dalam transaksi pakai koneksinya, di luar transaksi pakai pool. */
export const dbOf = (tx?: unknown): PoolConnection =>
  (tx as PoolConnection | undefined) ?? (pool as unknown as PoolConnection);

export const runInTransaction: TxRunner = (fn) => withTransaction((conn) => fn(conn));

export const auditFn: AuditFn = (entry: AuditEntry, tx?: unknown) => writeAudit(entry, tx as PoolConnection | undefined);
