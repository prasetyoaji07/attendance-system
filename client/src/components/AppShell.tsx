import { CalendarDays, CircleCheck, LogOut, Moon, Sun, type LucideIcon } from 'lucide-react';
import { NavLink, Outlet } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/lib/auth';
import { useTheme } from '@/lib/theme';

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
}

// Tambah item di sini saat halaman baru jadi (Beranda, Pengajuan, Approval, Dashboard).
const NAV: NavItem[] = [
  { to: '/jadwal', label: 'Jadwal', icon: CalendarDays },
  { to: '/setup', label: 'Status', icon: CircleCheck },
];

const ROLE_LABEL: Record<string, string> = {
  EMPLOYEE: 'Karyawan',
  FOREMAN: 'Foreman',
  SPV: 'Supervisor',
  HRD: 'HRD',
  ADMIN: 'Admin',
};

export default function AppShell() {
  const { user, logout } = useAuth();
  const { theme, toggle } = useTheme();
  const ThemeIcon = theme === 'dark' ? Sun : Moon;

  return (
    <div className="min-h-screen md:pl-60">
      {/* Sidebar desktop */}
      <aside className="fixed inset-y-0 left-0 hidden w-60 flex-col gap-6 border-r border-border bg-surface p-4 md:flex">
        <div className="px-2 pt-2">
          <p className="text-h3 font-bold">Absensi</p>
          <p className="text-caption text-muted">Sistem absensi pabrik</p>
        </div>
        <nav className="flex flex-1 flex-col gap-1" aria-label="Menu utama">
          {NAV.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex h-11 items-center gap-3 rounded-md px-3 font-semibold transition-colors ${
                  isActive ? 'bg-primary-50 text-primary-600' : 'text-muted hover:bg-surface-2 hover:text-text'
                }`
              }
            >
              <Icon size={20} strokeWidth={1.75} />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="flex flex-col gap-3 border-t border-border pt-4">
          <div className="px-2">
            <p className="truncate font-semibold">{user?.nama}</p>
            <p className="truncate text-caption text-muted">
              {user?.nik} · {ROLE_LABEL[user?.role ?? ''] ?? user?.role} · {user?.department.nama}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={toggle} aria-label="Ganti tema">
              <ThemeIcon size={20} strokeWidth={1.75} />
            </Button>
            <Button variant="secondary" size="sm" className="flex-1" onClick={logout}>
              <LogOut size={18} strokeWidth={1.75} /> Keluar
            </Button>
          </div>
        </div>
      </aside>

      {/* Header HP */}
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-border bg-surface px-4 py-2 md:hidden">
        <div className="min-w-0">
          <p className="truncate font-bold">{user?.nama}</p>
          <p className="truncate text-caption text-muted">
            {user?.nik} · {ROLE_LABEL[user?.role ?? ''] ?? user?.role}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={toggle} aria-label="Ganti tema">
            <ThemeIcon size={20} strokeWidth={1.75} />
          </Button>
          <Button variant="secondary" size="sm" onClick={logout} aria-label="Keluar">
            <LogOut size={20} strokeWidth={1.75} />
          </Button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl px-4 pb-28 pt-4 md:px-8 md:pb-10 md:pt-8">
        <Outlet />
      </main>

      {/* Navigasi bawah HP */}
      <nav
        aria-label="Menu utama"
        className="fixed inset-x-0 bottom-0 z-20 flex border-t border-border bg-surface md:hidden"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        {NAV.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex h-16 flex-1 flex-col items-center justify-center gap-1 text-caption font-semibold ${
                isActive ? 'text-primary-600' : 'text-muted'
              }`
            }
          >
            <Icon size={22} strokeWidth={1.75} />
            {label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
