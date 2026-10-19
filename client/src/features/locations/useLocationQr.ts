import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { api } from '@/lib/api';

export interface LocationItem {
  id: number | string;
  nama: string;
}

export interface LocationQr {
  locationId: number | string;
  locationNama: string;
  token: string;
  /** ISO UTC: akhir window sekarang, saat token baru harus diambil */
  refreshAt: string;
  ttlSeconds: number;
}

/** Daftar lokasi (login). Layar QR hanya memakai id dan nama. */
export function useLocations() {
  return useQuery({
    queryKey: ['locations', 'list'],
    queryFn: async () => (await api<{ data: LocationItem[] }>('/locations')).data,
  });
}

/**
 * Token QR dinamis satu lokasi (HRD/ADMIN). Diambil ulang otomatis saat refreshAt tiba,
 * dengan jeda minimal 1 detik supaya tidak menembak server terus-menerus bila jam laptop melenceng.
 */
export function useLocationQr(locationId: number | string | null) {
  const q = useQuery({
    queryKey: ['locations', 'qr', locationId],
    enabled: locationId !== null,
    queryFn: async () => (await api<{ data: LocationQr }>(`/locations/${locationId}/qr`)).data,
    // Token tidak boleh dipakai dari cache lama.
    staleTime: 0,
    gcTime: 0,
  });

  const { data, refetch, isError } = q;
  const refreshAt = data?.refreshAt;

  useEffect(() => {
    if (!refreshAt || isError) return;
    const wait = Math.max(1000, new Date(refreshAt).getTime() - Date.now());
    const t = window.setTimeout(() => void refetch(), wait);
    return () => window.clearTimeout(t);
  }, [refreshAt, isError, refetch]);

  return q;
}
