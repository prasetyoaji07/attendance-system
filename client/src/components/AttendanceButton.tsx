import { CircleAlert, CircleCheck, Fingerprint, LoaderCircle } from 'lucide-react';

export type AttendanceButtonState = 'ready' | 'locating' | 'outside' | 'weak' | 'sending' | 'done' | 'idle';

interface Props {
  state: AttendanceButtonState;
  /** Mis. "Absen Masuk", "Di luar area". */
  label: string;
  /** Baris kecil di bawah label (mis. jarak, jam). */
  detail?: string;
  /** Hanya berlaku saat state 'ready': tombol tampil redup. */
  disabled?: boolean;
  onClick?: () => void;
}

/*
 * design.md 9.2. Pengecualian token (ditulis sengaja):
 * - diameter 168 (HP) / 192 (desktop) ditetapkan design.md, belum ada token ukurannya;
 * - sisi tebal 8 px dan highlight tipis memakai nilai shadow langsung seperti ui/Button.tsx.
 */
const MUTED = 'bg-surface-2 text-muted shadow-[inset_0_1px_0_rgba(255,255,255,.2),0_8px_0_var(--border)]';
const SKIN: Record<AttendanceButtonState, string> = {
  ready:
    'bg-grad-primary text-white shadow-[inset_0_1px_0_rgba(255,255,255,.35),0_8px_0_var(--primary-700),var(--shadow-glow)]',
  locating: MUTED,
  outside: 'bg-danger text-white shadow-[inset_0_1px_0_rgba(255,255,255,.35),0_8px_0_rgba(0,0,0,.3)]',
  weak: MUTED,
  sending: MUTED,
  done: 'bg-success text-white shadow-[inset_0_1px_0_rgba(255,255,255,.35),0_8px_0_rgba(0,0,0,.3)]',
  idle: MUTED,
};

export function AttendanceButton({ state, label, detail, disabled = false, onClick }: Props) {
  const blocked = state !== 'ready' || disabled;
  const pulse = state === 'ready' && !disabled;
  const dim = state === 'ready' && disabled ? 'opacity-50' : '';

  return (
    <div className="relative mb-2 flex h-[168px] w-[168px] items-center justify-center md:h-[192px] md:w-[192px]">
      {pulse && (
        <span
          aria-hidden="true"
          className="absolute inset-0 rounded-full bg-primary-500 opacity-30 motion-safe:animate-ping"
        />
      )}
      <button
        type="button"
        disabled={blocked}
        onClick={onClick}
        className={`relative z-10 flex h-full w-full select-none flex-col items-center justify-center gap-1 rounded-full px-4 text-center font-semibold transition-all duration-[120ms] ease-out focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-primary-200 disabled:cursor-not-allowed enabled:active:translate-y-[3px] ${SKIN[state]} ${dim}`}
      >
        {state === 'locating' || state === 'sending' ? (
          <LoaderCircle size={40} strokeWidth={1.75} className="motion-safe:animate-spin" aria-hidden="true" />
        ) : state === 'outside' ? (
          <CircleAlert size={40} strokeWidth={1.75} aria-hidden="true" />
        ) : state === 'weak' ? (
          <CircleAlert size={40} strokeWidth={1.75} className="text-warning" aria-hidden="true" />
        ) : state === 'done' ? (
          <CircleCheck size={40} strokeWidth={1.75} aria-hidden="true" />
        ) : (
          <Fingerprint size={40} strokeWidth={1.75} aria-hidden="true" />
        )}
        <span className="text-h3">{label}</span>
        {detail && <span className="font-mono text-caption">{detail}</span>}
      </button>
    </div>
  );
}
