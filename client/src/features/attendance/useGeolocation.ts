import { useCallback, useEffect, useRef, useState } from 'react';

export type GeoState =
  | { status: 'idle' }
  | { status: 'locating' }
  | { status: 'ready'; lat: number; lng: number; accuracyM: number }
  | { status: 'denied' }
  | { status: 'unavailable' }
  | { status: 'error'; message: string };

/**
 * Lokasi sekali ambil (bukan pelacakan terus-menerus; lokasi hanya diambil saat dibutuhkan untuk absen).
 * Geolocation butuh HTTPS atau localhost.
 */
export function useGeolocation(enabled: boolean): { geo: GeoState; refresh: () => void } {
  const [geo, setGeo] = useState<GeoState>({ status: 'idle' });
  const run = useRef(0);

  const refresh = useCallback(() => {
    const id = ++run.current;
    if (typeof navigator === 'undefined' || !('geolocation' in navigator) || !window.isSecureContext) {
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
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 0 },
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
