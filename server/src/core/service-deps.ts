import type { AuditEntry } from './audit';

/** Pencatat audit. `tx` = koneksi transaksi yang sedang berjalan (opaque agar service bebas dari mysql2). */
export type AuditFn = (entry: AuditEntry, tx?: unknown) => Promise<void>;

/** Jalankan `fn` dalam satu transaksi (rollback otomatis jika error). */
export type TxRunner = <T>(fn: (tx: unknown) => Promise<T>) => Promise<T>;
