/** Alat bantu tes selfie: JPEG palsu (hanya tanda awal FF D8 FF yang dicek server) dan penyimpanan di memori. */
import type { SelfieStorage } from '../modules/attendance/selfie-storage';

export const fakeJpegBytes = (size = 1200): Buffer => {
  const b = Buffer.alloc(size, 7);
  b[0] = 0xff;
  b[1] = 0xd8;
  b[2] = 0xff;
  b[3] = 0xe0;
  return b;
};

export const fakeJpegBase64 = (size?: number): string => fakeJpegBytes(size).toString('base64');

export function createMemoryStorage(): SelfieStorage & { files: Map<string, Buffer> } {
  const files = new Map<string, Buffer>();
  let n = 0;
  return {
    files,
    async save(bytes) {
      n += 1;
      const ref = `mem-${n}.jpg`;
      files.set(ref, bytes);
      return ref;
    },
    async read(ref) {
      return files.get(ref) ?? null;
    },
    async remove(ref) {
      files.delete(ref);
    },
  };
}
