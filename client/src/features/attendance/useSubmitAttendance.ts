import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { EarlyLeaveReason } from './earlyLeave';
import { getPositionOnce } from './useGeolocation';
import { TODAY_KEY } from './useToday';

export interface SubmitInput {
  mode: 'in' | 'out';
  /** Isi QR hasil scan (token dari layar lokasi). */
  qr: string;
  /** Hanya dikirim saat check-out. Server yang memutuskan wajib atau tidaknya. */
  earlyLeaveReason?: EarlyLeaveReason;
}

/**
 * Kirim check-in / check-out: ambil lokasi baru, kirim { lat, lng, accuracyM, qr } (+ earlyLeaveReason),
 * lalu muat ulang status hari ini (juga saat gagal, supaya layar tidak basi).
 */
export function useSubmitAttendance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: SubmitInput) => {
      const pos = await getPositionOnce();
      const body = {
        lat: pos.lat,
        lng: pos.lng,
        accuracyM: pos.accuracyM,
        qr: input.qr,
        ...(input.mode === 'out' && input.earlyLeaveReason ? { earlyLeaveReason: input.earlyLeaveReason } : {}),
      };
      const res = await api<{ data: { message: string } }>(
        input.mode === 'in' ? '/attendance/check-in' : '/attendance/check-out',
        { method: 'POST', body: JSON.stringify(body) },
      );
      return res.data;
    },
    onSettled: () => qc.invalidateQueries({ queryKey: TODAY_KEY }),
  });
}
