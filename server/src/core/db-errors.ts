/** Kode error MySQL/TiDB yang perlu diterjemahkan jadi pesan ramah. Tanpa impor DB, aman untuk unit test. */
export const isDuplicateEntry = (err: unknown): boolean =>
  typeof err === 'object' && err !== null && (err as { code?: unknown }).code === 'ER_DUP_ENTRY';
