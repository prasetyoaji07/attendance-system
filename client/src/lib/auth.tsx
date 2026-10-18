import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, getToken, setToken } from '@/lib/api';

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

interface AuthValue {
  user: User | null;
  status: Status;
  login(nik: string, password: string): Promise<void>;
  logout(): void;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [status, setStatus] = useState<Status>(getToken() ? 'loading' : 'guest');

  // Sesi lama: tanya server siapa pemilik token (data terbaru dari DB).
  useEffect(() => {
    if (!getToken()) return;
    let cancelled = false;
    api<{ user: User }>('/auth/me')
      .then((r) => {
        if (cancelled) return;
        setUser(r.user);
        setStatus('authed');
      })
      .catch(() => {
        if (cancelled) return;
        setToken(null);
        setStatus('guest');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (nik: string, password: string) => {
    const r = await api<{ token: string; user: User }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ nik, password }),
    });
    setToken(r.token);
    setUser(r.user);
    setStatus('authed');
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    setStatus('guest');
  }, []);

  const value = useMemo(() => ({ user, status, login, logout }), [user, status, login, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth harus dipakai di dalam AuthProvider');
  return ctx;
}
