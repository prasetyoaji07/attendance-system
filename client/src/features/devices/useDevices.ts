import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface PendingDevice {
  id: number | string;
  userId: number;
  nik: string;
  nama: string;
  departmentNama: string;
  /** ISO UTC dari server */
  requestedAt: string;
}

export type DeviceAction = 'approve' | 'reject';

export interface DeviceDecisionResult {
  id: number | string;
  replacedDevices?: number;
}

export const PENDING_KEY = ['devices', 'pending'] as const;

/** Antrean permintaan perangkat baru (HRD/ADMIN). */
export function usePendingDevices() {
  return useQuery({
    queryKey: PENDING_KEY,
    queryFn: async () => (await api<{ data: PendingDevice[] }>('/devices/pending')).data,
  });
}

/** Setujui / tolak satu permintaan. Antrean dimuat ulang setelah selesai, berhasil maupun gagal. */
export function useDeviceDecision() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, action }: { id: number | string; action: DeviceAction }) =>
      (await api<{ data: DeviceDecisionResult }>(`/devices/${id}/${action}`, { method: 'POST' })).data,
    onSettled: () => qc.invalidateQueries({ queryKey: PENDING_KEY }),
  });
}