import { CircleAlert, CircleCheck } from 'lucide-react';
import type { ReactNode } from 'react';

type Tone = 'success' | 'warning' | 'danger' | 'info';

// Latar tipis dari token semantik. Teks memakai warna `text` supaya kontras 4.5:1 aman di terang dan gelap;
// maknanya dibawa ikon + judul + latar (bukan warna saja).
const TONES: Record<Tone, { bg: string; icon: string }> = {
  success: { bg: 'bg-[var(--success-bg)]', icon: 'text-success' },
  warning: { bg: 'bg-[var(--warning-bg)]', icon: 'text-warning' },
  danger: { bg: 'bg-[var(--danger-bg)]', icon: 'text-danger' },
  info: { bg: 'bg-[var(--info-bg)]', icon: 'text-info' },
};

interface Props {
  tone?: Tone;
  title?: string;
  children?: ReactNode;
  /** Mis. tombol "Coba lagi". Pakai varian secondary (satu primary per layar). */
  action?: ReactNode;
}

/** Pesan di dalam halaman (bukan toast). */
export function Alert({ tone = 'info', title, children, action }: Props) {
  const t = TONES[tone];
  const Icon = tone === 'success' ? CircleCheck : CircleAlert;
  return (
    <div role={tone === 'danger' ? 'alert' : 'status'} className={`flex items-start gap-3 rounded-md px-4 py-3 ${t.bg}`}>
      <Icon size={20} strokeWidth={1.75} className={`mt-0.5 shrink-0 ${t.icon}`} aria-hidden="true" />
      <div className="min-w-0 flex-1 text-body text-text">
        {title && <p className="font-semibold">{title}</p>}
        {children && <p>{children}</p>}
        {action && <div className="mt-3">{action}</div>}
      </div>
    </div>
  );
}
