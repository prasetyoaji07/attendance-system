import { Eye, EyeOff, Moon, Sun } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { inputCls } from '@/components/ui/inputClass';
import { ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useTheme } from '@/lib/theme';

export default function Login() {
  const { status, login } = useAuth();
  const { theme, toggle } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [nik, setNik] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (status === 'authed') return <Navigate to="/jadwal" replace />;

  const from = (location.state as { from?: string } | null)?.from ?? '/jadwal';

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await login(nik.trim(), password);
      navigate(from, { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Tidak bisa terhubung ke server. Cek koneksi, lalu coba lagi.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center gap-6 px-4 py-8">
      <div className="flex items-center justify-between">
        <div>
          <h1>Absensi</h1>
          <p className="text-muted">Masuk dengan NIK dan password kamu.</p>
        </div>
        <Button variant="secondary" size="sm" onClick={toggle} aria-label="Ganti tema" type="button">
          {theme === 'dark' ? <Sun size={20} strokeWidth={1.75} /> : <Moon size={20} strokeWidth={1.75} />}
        </Button>
      </div>

      <form onSubmit={onSubmit} className="card flex flex-col gap-4" noValidate>
        <label className="flex flex-col gap-1.5">
          <span className="text-caption text-muted">NIK</span>
          <input
            className={inputCls}
            value={nik}
            onChange={(e) => setNik(e.target.value)}
            autoComplete="username"
            autoCapitalize="characters"
            inputMode="text"
            placeholder="contoh: SIM0001"
            required
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-caption text-muted">Password</span>
          <div className="relative">
            <input
              className={`${inputCls} pr-12`}
              type={show ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
            <button
              type="button"
              onClick={() => setShow((v) => !v)}
              aria-label={show ? 'Sembunyikan password' : 'Tampilkan password'}
              className="absolute right-1 top-1 flex h-9 w-9 items-center justify-center rounded-sm text-muted hover:text-text"
            >
              {show ? <EyeOff size={20} strokeWidth={1.75} /> : <Eye size={20} strokeWidth={1.75} />}
            </button>
          </div>
        </label>

        {error && (
          <p role="alert" className="rounded-md bg-[var(--danger-bg)] px-3 py-2 text-body text-danger">
            {error}
          </p>
        )}

        <Button type="submit" size="lg" disabled={busy || !nik.trim() || !password}>
          {busy ? 'Memeriksa...' : 'Masuk'}
        </Button>
      </form>

      <p className="text-center text-caption text-faint">Data simulasi. Akun contoh: SIM0001 (HRD) sampai SIM0050.</p>
    </main>
  );
}
