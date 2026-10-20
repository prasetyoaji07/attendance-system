import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth, type Role } from '@/lib/auth';

/**
 * Penjaga tampilan per role (dipasang di dalam RequireAuth).
 * Hanya soal tampilan: yang menolak akses sungguhan tetap server (403).
 */
export default function RequireRole({ roles, children }: { roles: Role[]; children: ReactNode }) {
  const { user } = useAuth();
  if (!user || !roles.includes(user.role)) return <Navigate to="/beranda" replace />;
  return <>{children}</>;
}