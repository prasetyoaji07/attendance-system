import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError } from '@/lib/api';

export type GeoState =
  | { status: 'idle' }
  | { status: 'locating' }
  | { status: 'ready'; lat: number; lng: number; accuracyM: number }
  | { status: 'denied' }
  | { status: 'unavailable' }
  | { status: 'error'; message: string };

const GEO_OPTIONS: PositionOptions = { enableHighAccuracy: true, timeout: 15_000, maximumAge: 0 };

function geoAvailable(): boolean {
  return typeof navigator !== 'undefined' && 'geolocation' in navigator && window.isSecureContext;
}

/**
 * Lokasi sekali ambil (bukan pelacakan terus-menerus; lokasi hanya diambil saat dibutuhkan untuk absen).
 * Geolocation butuh HTTPS atau localhost.
 */
export function useGeolocation(enabled: boolean): { geo: GeoState; refresh: () => void } {
  const [geo, setGeo] = useState<GeoState>({ status: 'idle' });
  const run = useRef(0);

  const refresh = useCallback(() => {
    const id = ++run.current;
    if (!geoAvailable()) {
      setGeo({ status: 'unavailable' });
      return;
    }
    setGeo({ status: 'locating' });
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (id !== run.current) return;
        setGeo({
          status: 'ready',
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracyM: pos.coords.accuracy,
        });
      },
      (err) => {
        if (id !== run.current) return;
        if (err.code === err.PERMISSION_DENIED) setGeo({ status: 'denied' });
        else if (err.code === err.TIMEOUT) setGeo({ status: 'error', message: 'Mencari lokasi terlalu lama. Pindah ke tempat terbuka lalu coba lagi.' });
        else setGeo({ status: 'error', message: 'Lokasi belum bisa ditemukan. Cek GPS di HP-mu lalu coba lagi.' });
      },
      GEO_OPTIONS,
    );
  }, []);

  useEffect(() => {
    if (!enabled) {
      run.current++;
      setGeo({ status: 'idle' });
      return;
    }
    refresh();
    return () => {
      run.current++;
    };
  }, [enabled, refresh]);

  return { geo, refresh };
}

/**
 * Ambil lokasi BARU tepat sebelum absen dikirim (bukan lokasi saat halaman dibuka, supaya tidak basi).
 * Gagal dilempar sebagai ApiError dengan pesan ramah, jadi friendlyError() langsung bisa menampilkannya.
 */
export function getPositionOnce(): Promise<{ lat: number; lng: number; accuracyM: number }> {
  return new Promise((resolve, reject) => {
    if (!geoAvailable()) {
      reject(new ApiError(0, 'GEO_UNAVAILABLE', 'Browser ini tidak bisa memakai lokasi. Buka lewat HTTPS atau localhost.'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracyM: pos.coords.accuracy }),
      (err) => {
        const message =
          err.code === err.PERMISSION_DENIED
            ? 'Izin lokasi ditolak. Aktifkan lokasi untuk situs ini di pengaturan browser, lalu coba lagi.'
            : err.code === err.TIMEOUT
              ? 'Mencari lokasi terlalu lama. Pindah ke tempat terbuka lalu scan lagi.'
              : 'Lokasi belum bisa ditemukan. Cek GPS di HP-mu lalu scan lagi.';
        reject(new ApiError(0, 'GEO_FAILED', message));
      },
      GEO_OPTIONS,
    );
  });
}
