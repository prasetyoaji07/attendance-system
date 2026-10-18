import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { api, getToken, setToken } from '@/lib/api';
import { friendlyError } from '@/lib/api-errors';
import { getDeviceId } from '@/lib/device';

export type Role = 'EMPLOYEE' | 'FOREMAN' | 'SPV' | 'HRD' | 'ADMIN';

export interface User {
  userId: number;
  employeeId: number;
  nik: string;
  nama: string;
  role: Role;
  department: { id: number; nama: string };
  atasanId: number | null;
}

type Status = 'loading' | 'authed' | 'guest';

/** idle = belum login; checking = sedang didaftarkan; error = pendaftaran gagal (mis. jaringan), bisa dicoba lagi. */
export interface DeviceInfo {
  status: 'idle' | 'checking' | 'active' | 'pending' | 'error';
  message?: string;
}

interface AuthValue {
  user: User | null;
  status: Status;
  device: DeviceInfo;
  login(nik: string, password: string): Promise<void>;
  logout(): void;
  retryDevice(): void;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [status, setStatus] = useState<Status>(getToken() ? 'loading' : 'guest');
  const [device, setDevice] = useState<DeviceInfo>({ status: 'idle' });
  // Penanda putaran pendaftaran: hasil yang datang terlambat (mis. setelah logout) dibuang.
  const deviceRun = useRef(0);

  // POST /devices/register aman diulang (docs/api.md). Gagal tidak membatalkan login.
  const registerDevice = useCallback(async () => {
    const run = ++deviceRun.current;
    setDevice({ status: 'checking' });
    try {
      const r = await api<{ data: { status: 'active' | 'pending'; created: boolean; message: string } }>(
        '/devices/register',
        { method: 'POST', body: JSON.stringify({ deviceId: getDeviceId() }) },
      );
      if (run === deviceRun.current) setDevice({ status: r.data.status, message: r.data.message });
    } catch (err) {
      if (run === deviceRun.current) setDevice({ status: 'error', message: friendlyError(err) });
    }
  }, []);

  // Sesi lama: tanya server siapa pemilik token (data terbaru dari DB), lalu pastikan perangkat terdaftar.
  useEffect(() => {
    if (!getToken()) return;
    let cancelled = false;
    api<{ user: User }>('/auth/me')
      .then((r) => {
        if (cancelled) return;
        setUser(r.user);
        setStatus('authed');
        void registerDevice();
      })
      .catch(() => {
        if (cancelled) return;
        setToken(null);
        setStatus('guest');
      });
    return () => {
      cancelled = true;
    };
  }, [registerDevice]);

  const login = useCallback(
    async (nik: string, password: string) => {
      const r = await api<{ token: string; user: User }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ nik, password }),
      });
      setToken(r.token);
      setUser(r.user);
      setStatus('authed');
      void registerDevice();
    },
    [registerDevice],
  );

  const logout = useCallback(() => {
    deviceRun.current++;
    setToken(null);
    setUser(null);
    setStatus('guest');
    setDevice({ status: 'idle' });
  }, []);

  const value = useMemo(
    () => ({ user, status, device, login, logout, retryDevice: () => void registerDevice() }),
    [user, status, device, login, logout, registerDevice],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth harus dipakai di dalam AuthProvider');
  return ctx;
}
