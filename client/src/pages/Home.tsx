import { useQuery } from '@tanstack/react-query';
import { CircleCheck, Moon, Sun } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { api } from '@/lib/api';
import { useTheme } from '@/lib/theme';

interface Health { status: string; db: 'ok' | 'down'; time: string }

/** Halaman uji setup: cek token desain (tombol 3D, kartu, tema) dan koneksi ke API. */
export default function Home() {
  const { theme, toggle } = useTheme();
  const health = useQuery({ queryKey: ['health'], queryFn: () => api<Health>('/health') });

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col gap-4 p-4">
      <header className="flex items-center justify-between">
        <div>
          <h1>Absensi</h1>
          <p className="text-muted">Setup berhasil. Siap dikembangkan.</p>
        </div>
        <Button variant="secondary" size="sm" onClick={toggle} aria-label="Ganti tema">
          {theme === 'dark' ? <Sun size={20} strokeWidth={1.75} /> : <Moon size={20} strokeWidth={1.75} />}
        </Button>
      </header>

      <section className="card-hero">
        <p className="text-caption uppercase tracking-wider opacity-80">Shift hari ini</p>
        <p className="font-mono text-display">07:00 - 15:00</p>
      </section>

      <section className="card flex flex-col gap-3">
        <h3>Status sistem</h3>
        <p className="flex items-center gap-2">
          <CircleCheck size={20} className={health.data ? 'text-success' : 'text-faint'} />
          API: {health.isLoading ? 'mengecek...' : health.data ? 'terhubung' : 'tidak terhubung (jalankan npm run dev)'}
        </p>
        <p className="flex items-center gap-2">
          <CircleCheck size={20} className={health.data?.db === 'ok' ? 'text-success' : 'text-faint'} />
          Database: {health.data ? (health.data.db === 'ok' ? 'terhubung' : 'belum terhubung (cek server/.env)') : '-'}
        </p>
      </section>

      <section className="flex flex-col gap-3">
        <Button size="lg">Absen Masuk</Button>
        <div className="flex gap-3">
          <Button variant="secondary" className="flex-1">Sekunder</Button>
          <Button variant="success" className="flex-1">Setujui</Button>
          <Button variant="danger" className="flex-1">Tolak</Button>
        </div>
      </section>
    </main>
  );
}
