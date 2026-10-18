/**
 * Token QR dinamis untuk layar yang ditampilkan di lokasi kerja (docs/alur.md 7.1).
 * Token dibuat dengan fungsi yang sama dengan yang diverifikasi check-in/check-out (utils/hmac-qr.ts).
 * Dependensi disuntik supaya bisa di-unit-test tanpa DB; penyambungan ada di locations.controller.ts.
 */
import { AppError } from '../../core/errors';
import { qrWindowEndMs, signQr } from '../../utils/hmac-qr';

export interface LocationQrDeps {
  locations: { findById(id: number): Promise<{ id: number; nama: string } | null> };
  secret: string;
  ttlSeconds: number;
  /** Jam saat ini. Diganti di tes. */
  now?: () => Date;
}

export interface LocationQr {
  locationId: number;
  locationNama: string;
  token: string;
  /** Akhir window token ini (ISO UTC). Layar mengambil token baru pada waktu ini. */
  refreshAt: string;
  ttlSeconds: number;
}

export function createLocationQrService({ locations, secret, ttlSeconds, now }: LocationQrDeps) {
  const clock = now ?? (() => new Date());
  return {
    async get(locationId: number): Promise<LocationQr> {
      const location = await locations.findById(locationId);
      if (!location) throw AppError.notFound('Lokasi tidak ditemukan');
      const nowMs = clock().getTime();
      return {
        locationId: location.id,
        locationNama: location.nama,
        token: signQr(location.id, secret, ttlSeconds, nowMs),
        refreshAt: new Date(qrWindowEndMs(nowMs, ttlSeconds)).toISOString(),
        ttlSeconds,
      };
    },
  };
}

export type LocationQrService = ReturnType<typeof createLocationQrService>;
