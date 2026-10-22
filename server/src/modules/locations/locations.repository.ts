import type { ResultSetHeader, RowDataPacket } from 'mysql2';
import { dbOf } from '../../core/db-helpers';
import type { LocationRecord, LocationsRepository } from './locations.service';

// DECIMAL dikembalikan mysql2 sebagai string, jadi diubah ke number di sini.
interface LocationRow extends RowDataPacket {
  id: number;
  nama: string;
  lat: string;
  lng: string;
  radiusM: number;
  alamat: string | null;
}

const SELECT = 'SELECT id, nama, lat, lng, radius_m AS radiusM, alamat FROM locations';

const toRecord = (r: LocationRow): LocationRecord => ({
  id: r.id,
  nama: r.nama,
  lat: Number(r.lat),
  lng: Number(r.lng),
  radiusM: r.radiusM,
  alamat: r.alamat ?? null,
});

export const locationsRepository: LocationsRepository = {
  async findAll() {
    const [rows] = await dbOf().execute<LocationRow[]>(`${SELECT} ORDER BY nama`);
    return rows.map(toRecord);
  },
  async findById(id, tx) {
    const [rows] = await dbOf(tx).execute<LocationRow[]>(`${SELECT} WHERE id = ? LIMIT 1`, [id]);
    return rows[0] ? toRecord(rows[0]) : null;
  },
  async insert(d, tx) {
    const [res] = await dbOf(tx).execute<ResultSetHeader>(
      'INSERT INTO locations (nama, lat, lng, radius_m, alamat) VALUES (?, ?, ?, ?, ?)',
      [d.nama, d.lat, d.lng, d.radiusM, d.alamat ?? null],
    );
    return res.insertId;
  },
  async update(id, d, tx) {
    await dbOf(tx).execute('UPDATE locations SET nama = ?, lat = ?, lng = ?, radius_m = ?, alamat = ? WHERE id = ?', [
      d.nama,
      d.lat,
      d.lng,
      d.radiusM,
      d.alamat ?? null,
      id,
    ]);
  },
  async remove(id, tx) {
    await dbOf(tx).execute('DELETE FROM locations WHERE id = ?', [id]);
  },
  async countRosters(id) {
    const [rows] = await dbOf().execute<(RowDataPacket & { n: number })[]>(
      'SELECT COUNT(*) AS n FROM rosters WHERE location_id = ?',
      [id],
    );
    return Number(rows[0].n);
  },
};
