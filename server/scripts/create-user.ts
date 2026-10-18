/**
 * Helper DEV sementara (sampai seed.ts dibuat): bikin 1 karyawan + akun login.
 * Pakai dari folder server:
 *   npx tsx scripts/create-user.ts <NIK> "<Nama>" <password> [ROLE]
 * Contoh:
 *   npx tsx scripts/create-user.ts 1001 "Budi Simulasi" rahasia123 HRD
 * Semua data adalah simulasi. Password yang diketik di terminal tersimpan di history, jangan pakai password asli.
 */
import { pool, withTransaction } from '../src/core/db';
import { hashPassword } from '../src/core/password';
import { ROLES, type Role } from '../src/core/roles';

async function main() {
  const [nik, nama, password, roleArg = 'EMPLOYEE'] = process.argv.slice(2);
  if (!nik || !nama || !password) {
    console.error('Pemakaian: npx tsx scripts/create-user.ts <NIK> "<Nama>" <password> [ROLE]');
    console.error(`ROLE: ${ROLES.join(' | ')} (default EMPLOYEE)`);
    process.exit(1);
  }
  if (!(ROLES as readonly string[]).includes(roleArg)) {
    console.error(`ROLE tidak dikenal: ${roleArg}. Pilih salah satu: ${ROLES.join(', ')}`);
    process.exit(1);
  }
  if (password.length < 8) {
    console.error('Password minimal 8 karakter.');
    process.exit(1);
  }
  const role = roleArg as Role;

  const [existing] = await pool.execute('SELECT id FROM employees WHERE nik = ? LIMIT 1', [nik]);
  if ((existing as unknown[]).length > 0) {
    console.error(`NIK ${nik} sudah terdaftar. Pakai NIK lain.`);
    process.exit(1);
  }

  const passwordHash = await hashPassword(password);
  await withTransaction(async (conn) => {
    await conn.execute('INSERT IGNORE INTO departments (nama) VALUES (?)', ['Produksi']);
    const [dept] = await conn.execute('SELECT id FROM departments WHERE nama = ? LIMIT 1', ['Produksi']);
    const departmentId = (dept as { id: number }[])[0].id;
    const [emp] = await conn.execute(
      'INSERT INTO employees (nik, nama, department_id, tanggal_masuk) VALUES (?, ?, ?, CURDATE())',
      [nik, nama, departmentId],
    );
    const employeeId = (emp as { insertId: number }).insertId;
    await conn.execute('INSERT INTO users (employee_id, password_hash, role) VALUES (?, ?, ?)', [
      employeeId,
      passwordHash,
      role,
    ]);
  });
  console.log(`Selesai: NIK ${nik} (${nama}) dibuat dengan role ${role}.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
