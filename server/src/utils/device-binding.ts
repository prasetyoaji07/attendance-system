/**
 * FASE 2: aturan device binding (PURE, tanpa DB). Dipakai devices.service.ts dan guard check-in/check-out.
 *
 * Yang dibuktikan fitur ini: akun dipakai dari perangkat yang sudah disetujui. Yang TIDAK dibuktikan:
 * `deviceId` hanyalah UUID acak yang disimpan browser (aplikasi web tidak bisa membaca ID perangkat keras),
 * jadi ganti browser atau hapus data situs dianggap perangkat baru. Ini pencegah pinjam-akun, bukan pengaman penuh.
 */

export type DeviceStatus = 'active' | 'pending';

export interface DeviceRecord {
  id: number;
  userId: number;
  deviceId: string;
  status: DeviceStatus;
}

/** Nama header yang dikirim klien pada check-in dan check-out (Node membaca header dalam huruf kecil). */
export const DEVICE_HEADER = 'x-device-id';

/** UUID dari crypto.randomUUID() (36 karakter) lolos; pola dibuat longgar agar tidak rapuh. */
export const DEVICE_ID_PATTERN = /^[A-Za-z0-9_-]{16,64}$/;

export const isValidDeviceId = (v: unknown): v is string => typeof v === 'string' && DEVICE_ID_PATTERN.test(v);

export type RegistrationDecision =
  | { action: 'keep'; status: DeviceStatus }
  | {
      action: 'create';
      status: DeviceStatus;
      /** Permintaan pending lama milik akun yang sama, diganti oleh yang baru (paling banyak satu pending per akun). */
      replaceId: number | null;
    };

/**
 * Aturan pendaftaran:
 * - perangkat yang sudah terdaftar (active atau pending): tidak ada perubahan (aman dipanggil berulang);
 * - akun belum punya perangkat sama sekali: perangkat pertama langsung active;
 * - selain itu: pending menunggu persetujuan, menggantikan pending lama bila ada.
 */
export function decideRegistration(existing: DeviceRecord[], deviceId: string): RegistrationDecision {
  const same = existing.find((d) => d.deviceId === deviceId);
  if (same) return { action: 'keep', status: same.status };
  if (existing.length === 0) return { action: 'create', status: 'active', replaceId: null };
  const pending = existing.find((d) => d.status === 'pending');
  return { action: 'create', status: 'pending', replaceId: pending?.id ?? null };
}

export type DeviceDenyCode = 'DEVICE_REQUIRED' | 'DEVICE_NOT_REGISTERED' | 'DEVICE_PENDING';
export type DeviceCheck = { ok: true } | { ok: false; code: DeviceDenyCode; message: string };

/** Keputusan guard: apakah `deviceId` dari header boleh dipakai absen oleh akun pemilik `devices`. */
export function checkDevice(deviceId: unknown, devices: DeviceRecord[]): DeviceCheck {
  if (!isValidDeviceId(deviceId)) {
    return {
      ok: false,
      code: 'DEVICE_REQUIRED',
      message: 'Perangkat belum teridentifikasi. Muat ulang aplikasi, lalu coba lagi.',
    };
  }
  const match = devices.find((d) => d.deviceId === deviceId);
  if (!match) {
    return {
      ok: false,
      code: 'DEVICE_NOT_REGISTERED',
      message: 'Perangkat ini belum terdaftar. Login ulang untuk mendaftarkannya.',
    };
  }
  if (match.status === 'pending') {
    return {
      ok: false,
      code: 'DEVICE_PENDING',
      message: 'Perangkat ini masih menunggu persetujuan HRD. Kamu bisa absen setelah disetujui.',
    };
  }
  return { ok: true };
}

/** Saat sebuah permintaan disetujui, semua perangkat lain milik akun yang sama dihapus (satu perangkat active per akun). */
export function planApproval(target: DeviceRecord, userDevices: DeviceRecord[]): { removeIds: number[] } {
  return {
    removeIds: userDevices.filter((d) => d.userId === target.userId && d.id !== target.id).map((d) => d.id),
  };
}
