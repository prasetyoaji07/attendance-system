import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import AppShell from '@/components/AppShell';
import RequireRole from '@/components/RequireRole';
import { useAuth } from '@/lib/auth';
import Beranda from '@/pages/Beranda';
import Devices from '@/pages/Devices';
import LocationQr from '@/pages/LocationQr';
import Login from '@/pages/Login';
import Schedule from '@/pages/Schedule';

/** Halaman di dalamnya hanya untuk yang sudah login; yang belum diarahkan ke /login. */
function RequireAuth({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const location = useLocation();
  if (status === 'loading') return <p className="p-6 text-muted">Memuat...</p>;
  if (status === 'guest') return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        element={
          <RequireAuth>
            <AppShell />
          </RequireAuth>
        }
      >
        <Route path="/beranda" element={<Beranda />} />
        <Route path="/jadwal" element={<Schedule />} />
        <Route
          path="/perangkat"
          element={
            <RequireRole roles={['HRD', 'ADMIN']}>
              <Devices />
            </RequireRole>
          }
        />
        <Route
          path="/qr-lokasi"
          element={
            <RequireRole roles={['HRD', 'ADMIN']}>
              <LocationQr />
            </RequireRole>
          }
        />
        {/* TODO: pengajuan, approval, dashboard */}
      </Route>
      <Route path="*" element={<Navigate to="/beranda" replace />} />
    </Routes>
  );
}
