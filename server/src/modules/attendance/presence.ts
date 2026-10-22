/**
 * Pemeriksaan "benar-benar ada di lokasi" yang dipakai check-in dan check-out:
 * akurasi GPS -> jarak (Haversine) -> QR dinamis (hanya jika QR dikirim). Urutan dan pesan sengaja satu tempat.
 *
 * Jalur tanpa QR (docs/alur.md 7.1b): `qr` tidak dikirim, cek QR dilewati. Tetapi QR yang DIKIRIM dan salah/kedaluwarsa
 * tetap ditolak (aturan bisnis 9 dan 12); sistem tidak diam-diam memindahkan ke jalur tanpa QR.
 * Pemanggil membedakan jalur lewat `input.qr === undefined`.
 */
import { AppError } from '../../core/errors';
import { RULES } from '../../core/rules';
import { isWithinRadius } from '../../utils/haversine';
import { verifyQr } from '../../utils/hmac-qr';

export interface PresenceInput {
  lat: number;
  lng: number;
  accuracyM: number;
  /** Kosong = jalur tanpa QR. */
  qr?: string | undefined;
}

export interface PresenceLocation {
  id: number;
  nama: string;
  lat: number;
  lng: number;
  radiusM: number;
}

export interface QrConfig {
  secret: string;
  ttlSeconds: number;
}

/** Melempar AppError jika gagal. Mengembalikan jarak (meter) jika lolos. */
export function assertPresence(
  input: PresenceInput,
  location: PresenceLocation,
  now: Date,
  qr: QrConfig,
): { distanceM: number } {
  // Akurasi GPS.
  if (input.accuracyM > RULES.maxGpsAccuracyM) {
    throw new AppError(
      422,
      'GPS_ACCURACY_LOW',
      `Sinyal GPS lemah (akurasi sekitar ${Math.round(input.accuracyM)} m, maksimal ${RULES.maxGpsAccuracyM} m). Pindah ke tempat terbuka lalu coba lagi.`,
      { accuracyM: input.accuracyM, maxAccuracyM: RULES.maxGpsAccuracyM },
    );
  }

  // Jarak ke lokasi kerja (geofence).
  const { ok, distanceM } = isWithinRadius(
    { lat: input.lat, lng: input.lng },
    { lat: location.lat, lng: location.lng },
    location.radiusM,
  );
  if (!ok) {
    throw new AppError(
      422,
      'OUT_OF_RADIUS',
      `Kamu ${Math.round(distanceM)} m dari ${location.nama} (batas ${location.radiusM} m).`,
      { distanceM: Math.round(distanceM), radiusM: location.radiusM },
    );
  }

  // Jalur tanpa QR: tidak ada QR yang diperiksa (selfie diperiksa oleh service).
  if (input.qr === undefined) return { distanceM };

  // QR dinamis: tanda tangan, masa berlaku, dan harus untuk lokasi jadwal ini.
  const parsed = verifyQr(input.qr, qr.secret, qr.ttlSeconds, now.getTime());
  if (!parsed.valid) {
    throw new AppError(
      400,
      'INVALID_QR',
      parsed.reason === 'EXPIRED' ? 'QR sudah kedaluwarsa. Scan ulang layar di lokasi.' : 'QR tidak valid. Scan layar di lokasi kerja.',
    );
  }
  if (parsed.locationId !== location.id) {
    throw new AppError(400, 'INVALID_QR', `QR ini bukan untuk lokasi jadwalmu (${location.nama}).`);
  }

  return { distanceM };
}
