/**
 * Migration runner sederhana: jalankan file database/migrations/*.sql berurutan (001_, 002_, ...).
 * Yang sudah dijalankan dicatat di tabel _migrations, jadi aman dijalankan berulang.
 */
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import mysql from 'mysql2/promise';

async function main() {
  const dir = path.resolve(__dirname, '../../database/migrations');
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();

  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT ?? 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ssl: process.env.DB_SSL === 'true' ? { minVersion: 'TLSv1.2', rejectUnauthorized: true } : undefined,
    multipleStatements: true,
  });

  await conn.query(
    'CREATE TABLE IF NOT EXISTS _migrations (name VARCHAR(255) PRIMARY KEY, run_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)',
  );
  const [rows] = await conn.query('SELECT name FROM _migrations');
  const done = new Set((rows as { name: string }[]).map((r) => r.name));

  let count = 0;
  for (const file of files) {
    if (done.has(file)) continue;
    console.log(`> ${file}`);
    await conn.query(fs.readFileSync(path.join(dir, file), 'utf8'));
    await conn.query('INSERT INTO _migrations (name) VALUES (?)', [file]);
    count++;
  }
  console.log(count ? `Selesai: ${count} migration dijalankan.` : 'Tidak ada migration baru.');
  await conn.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
