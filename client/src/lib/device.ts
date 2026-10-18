/**
 * ID perangkat untuk device binding (docs/api.md, bagian Devices).
 * Dibuat sekali, disimpan di localStorage, dan TIDAK dihapus saat logout (ini identitas browser, bukan sesi).
 * Ganti browser atau hapus data situs = perangkat baru. Ini pencegah pinjam-akun, bukan pengaman penuh.
 *
 * Memakai crypto.getRandomValues (bukan randomUUID) karena randomUUID hanya ada di HTTPS/localhost,
 * sedangkan getRandomValues juga jalan saat dibuka lewat http://192.168.x.x.
 * Hasil: 32 karakter heksa, lolos aturan server (16-64 karakter [A-Za-z0-9_-]).
 */
export const DEVICE_HEADER = 'X-Device-Id';

const KEY = 'absensi_device_id';
const VALID = /^[A-Za-z0-9_-]{16,64}$/;

export const isValidDeviceId = (v: string | null): v is string => v !== null && VALID.test(v);

function generate(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

// Cadangan bila localStorage diblokir (mode privat tertentu): ID bertahan selama halaman terbuka.
let memoryId: string | null = null;

export function getDeviceId(): string {
  try {
    const saved = localStorage.getItem(KEY);
    if (isValidDeviceId(saved)) return saved;
    const fresh = generate();
    localStorage.setItem(KEY, fresh);
    return fresh;
  } catch {
    memoryId ??= generate();
    return memoryId;
  }
}
