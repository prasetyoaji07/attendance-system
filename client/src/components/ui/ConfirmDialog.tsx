import { useEffect, useRef, type ReactNode } from 'react';
import { Button } from '@/components/ui/Button';

interface Props {
  open: boolean;
  title: string;
  children: ReactNode;
  confirmLabel: string;
  confirmVariant?: 'success' | 'danger';
  /** Sedang memproses: tombol dikunci, Esc dan klik overlay tidak menutup. */
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/** design.md 9.8: modal tengah di desktop, bottom sheet di HP. Tombol utama di kanan (desktop) / penuh (HP). */
export function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel,
  confirmVariant = 'success',
  busy = false,
  onConfirm,
  onCancel,
}: Props) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    cancelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) onCancel();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, busy, onCancel]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-[rgba(11,13,20,0.5)] backdrop-blur-sm md:items-center md:p-4"
      onClick={() => {
        if (!busy) onCancel();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        className="w-full rounded-t-xl bg-surface p-4 shadow-4 md:max-w-[480px] md:rounded-xl md:p-6"
        style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom, 0px))' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-border md:hidden" aria-hidden="true" />
        <h2 id="confirm-title" className="text-h3 text-text">
          {title}
        </h2>
        <div className="mt-2 text-body text-muted">{children}</div>
        <div className="mt-6 flex flex-col-reverse gap-3 md:flex-row md:justify-end">
          <Button ref={cancelRef} variant="secondary" className="w-full md:w-auto" onClick={onCancel} disabled={busy}>
            Batal
          </Button>
          <Button variant={confirmVariant} className="w-full md:w-auto" onClick={onConfirm} disabled={busy}>
            {busy ? 'Memproses...' : confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}