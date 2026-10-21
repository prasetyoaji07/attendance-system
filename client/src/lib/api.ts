import { DEVICE_HEADER, getDeviceId } from '@/lib/device';

const BASE = (import.meta.env.VITE_API_URL as string | undefined) || '/api';

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string, public details?: unknown) {
    super(message);
  }
}

const TOKEN_KEY = 'absensi_token';
export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (t: string | null) =>
  t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY);

/**
 * Wrapper fetch: otomatis JWT + X-Device-Id + parse error server { error: { code, message } }.
 * Server tidak terjangkau (fetch gagal) dilaporkan sebagai ApiError(0, 'NETWORK', ...).
 */
export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getToken();
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        [DEVICE_HEADER]: getDeviceId(),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...init.headers,
      },
    });
  } catch {
    throw new ApiError(0, 'NETWORK', 'Tidak bisa terhubung ke server. Cek koneksimu lalu coba lagi ya.');
  }
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const e = body?.error;
    // Galat 502/503/504 biasanya datang dari proxy/gateway tanpa isi JSON, jadi pesannya dipilih dari status.
    const unreachable = res.status === 502 || res.status === 503 || res.status === 504;
    const fallbackCode = unreachable ? 'SERVER_UNAVAILABLE' : 'UNKNOWN';
    const fallbackMessage = unreachable
      ? 'Server sedang tidak bisa dijangkau. Tunggu sebentar lalu coba lagi ya.'
      : 'Terjadi kesalahan. Coba lagi ya.';
    throw new ApiError(res.status, e?.code ?? fallbackCode, e?.message ?? fallbackMessage, e?.details);
  }
  return body as T;
}
