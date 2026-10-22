/**
 * Tempat menyimpan gambar selfie. Dibungkus antarmuka supaya penyimpanan bisa diganti (mis. object storage)
 * tanpa mengubah logika absen. Versi sekarang: folder di disk server.
 * Nama file = UUID acak + ".jpg" (tidak memuat NIK atau tanggal). file_ref yang tidak berbentuk itu ditolak
 * supaya tidak bisa dipakai menembus keluar folder.
 */
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

export interface SelfieStorage {
  /** Simpan byte JPEG, kembalikan file_ref. */
  save(bytes: Buffer): Promise<string>;
  /** Baca byte; null jika file tidak ada. */
  read(fileRef: string): Promise<Buffer | null>;
  /** Hapus file; tidak error jika file memang sudah tidak ada. */
  remove(fileRef: string): Promise<void>;
}

const FILE_REF = /^[0-9a-f-]{36}\.jpg$/;
const isNotFound = (err: unknown) => (err as NodeJS.ErrnoException | undefined)?.code === 'ENOENT';

export function createDiskSelfieStorage(dir: string): SelfieStorage {
  const pathOf = (fileRef: string) => {
    if (!FILE_REF.test(fileRef)) throw new Error('file_ref selfie tidak valid');
    return join(dir, fileRef);
  };
  return {
    async save(bytes) {
      await mkdir(dir, { recursive: true });
      const fileRef = `${randomUUID()}.jpg`;
      await writeFile(join(dir, fileRef), bytes, { flag: 'wx' });
      return fileRef;
    },
    async read(fileRef) {
      try {
        return await readFile(pathOf(fileRef));
      } catch (err) {
        if (isNotFound(err)) return null;
        throw err;
      }
    },
    async remove(fileRef) {
      try {
        await unlink(pathOf(fileRef));
      } catch (err) {
        if (!isNotFound(err)) throw err;
      }
    },
  };
}
