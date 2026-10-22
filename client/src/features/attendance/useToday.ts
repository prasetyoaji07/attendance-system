import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export type TodayStatus = 'NO_SCHEDULE' | 'UPCOMING' | 'NOT_CHECKED_IN' | 'CHECKED_IN' | 'CHECKED_OUT' | 'AUTO_CLOSED';

export interface TodayLocation {
  id: number;
  nama: string;
  lat: number;
  lng: number;
  radiusM: number;
  /** Alamat lokasi kerja (dicetak di foto selfie). Kosong/null bila belum diisi. */
  alamat?: string | null;
}

/** Bentuk balasan GET /attendance/today (server/src/utils/today-state.ts). */
export interface TodayData {
  serverTime: string;
  status: TodayStatus;
  roster: {
    rosterId: number;
    shiftDate: string;
    shiftNama: string;
    startTime: string;
    endTime: string;
    location: TodayLocation;
  } | null;
  window: { opensAt: string; closesAt: string } | null;
  canCheckIn: boolean;
  checkOut: { allowed: boolean; early: boolean; deadlineAt: string } | null;
  attendance: {
    attendanceId: number;
    checkInAt: string;
    checkOutAt: string | null;
    status: string | null;
    lateMinutes: number;
    earlyLeaveMinutes: number;
    autoClosed: boolean;
    needsCorrection: boolean;
  } | null;
}

export const TODAY_KEY = ['attendance', 'today'] as const;

/** Status absen hari ini. Diperbarui tiap menit dan saat tab dibuka lagi. */
export function useToday() {
  return useQuery({
    queryKey: TODAY_KEY,
    queryFn: async () => (await api<{ data: TodayData }>('/attendance/today')).data,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });
}
