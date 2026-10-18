import mysql, { type PoolConnection } from 'mysql2/promise';
import { config } from './config';

export const pool = mysql.createPool({
  host: config.DB_HOST,
  port: config.DB_PORT,
  user: config.DB_USER,
  password: config.DB_PASSWORD,
  database: config.DB_NAME,
  ssl: config.DB_SSL ? { minVersion: 'TLSv1.2', rejectUnauthorized: true } : undefined,
  waitForConnections: true,
  connectionLimit: 10,
  timezone: 'Z', // simpan UTC, tampilkan WIB di lapisan presentasi
  // Koneksi ke TiDB Cloud kadang diputus saat menganggur (error "read ECONNRESET" di log).
  // Keep-alive menjaga koneksi tetap hidup; connectTimeout mencegah koneksi baru yang macet menggantung.
  enableKeepAlive: true,
  keepAliveInitialDelay: 10_000,
  connectTimeout: 10_000,
});

/** Jalankan beberapa query dalam satu transaksi. Rollback otomatis jika error. */
export async function withTransaction<T>(fn: (conn: PoolConnection) => Promise<T>): Promise<T> {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const result = await fn(conn);
    await conn.commit();
    return result;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}
