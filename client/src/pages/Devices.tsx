import { Smartphone } from 'lucide-react';
import { useState } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import {
  useDeviceDecision,
  usePendingDevices,
  type DeviceAction,
  type PendingDevice,
} from '@/features/devices/useDevices';
import { ApiError } from '@/lib/api';
import { friendlyError } from '@/lib/api-errors';
import { useAuth } from '@/lib/auth';

const WIB = new Intl.DateTimeFormat('id-ID', {
  timeZone: 'Asia/Jakarta',
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

/** "Sen, 19 Okt 2026, 20:44 WIB" (format design.md bagian 13). */
function formatRequested(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '-';
  const p: Record<string, string> = {};
  for (const part of WIB.formatToParts(d)) p[part.type] = part.value.replace(/\.$/, '');
  return `${p.weekday}, ${p.day} ${p.month} ${p.year}, ${p.hour}:${p.minute} WIB`;
}

function SkeletonCards() {
  return (
    <div className="flex flex-col gap-4" role="status" aria-label="Memuat daftar perangkat">
      {[0, 1, 2].map((i) => (
        <div key={i} className="rounded-lg border border-border bg-surface p-4 shadow-2 md:p-5" aria-hidden="true">
          <div className="flex flex-col gap-3 motion-safe:animate-pulse">
            <div className="h-4 w-1/2 rounded-sm bg-surface-2" />
            <div className="h-3 w-1/3 rounded-sm bg-surface-2" />
            <div className="h-3 w-2/3 rounded-sm bg-surface-2" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function Devices() {
  const { user } = useAuth();
  const pending = usePendingDevices();
  const decision = useDeviceDecision();
  const [target, setTarget] = useState<{ item: PendingDevice; action: DeviceAction } | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  async function confirm() {
    if (!target) return;
    const { item, action } = target;
    setBusy(true);
    setProblem(null);
    setNotice(null);
    try {
      const r = await decision.mutateAsync({ id: item.id, action });
      if (action === 'approve') {
        const n = r.replacedDevices ?? 0;
        setNotice(
          `Perangkat ${item.nama} disetujui.${n > 0 ? ` ${n} perangkat lama akunnya dihapus.` : ''}`,
        );
      } else {
        setNotice(`Permintaan ${item.nama} ditolak. Perangkat lama akunnya tetap aktif.`);
      }
    } catch (err) {
      if (err instanceof ApiError && (err.status === 404 || err.status === 409)) {
        setProblem('Permintaan ini sudah ditangani. Daftar sudah diperbarui.');
      } else {
        setProblem(friendlyError(err));
      }
    } finally {
      setBusy(false);
      setTarget(null);
    }
  }

  const items = pending.data;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-h1">Perangkat</h1>
        <p className="text-muted">Permintaan perangkat baru yang menunggu persetujuan.</p>
      </div>

      {notice && <Alert tone="info">{notice}</Alert>}
      {problem && <Alert tone="danger">{problem}</Alert>}

      {pending.isLoading ? (
        <SkeletonCards />
      ) : pending.isError ? (
        <Alert
          tone="danger"
          title="Daftar perangkat gagal dimuat"
          action={
            <Button variant="secondary" onClick={() => void pending.refetch()}>
              Coba lagi
            </Button>
          }
        >
          {friendlyError(pending.error)}
        </Alert>
      ) : items && items.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-border bg-surface p-8 text-center shadow-2">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-50 text-primary-600">
            <Smartphone size={24} strokeWidth={1.75} aria-hidden="true" />
          </div>
          <h2 className="text-h3">Belum ada permintaan</h2>
          <p className="text-muted">Tenang, semua perangkat sudah beres.</p>
        </div>
      ) : (
        <ul className="flex flex-col gap-4">
          {items?.map((item) => {
            const own = user?.role === 'HRD' && item.userId === user.userId;
            return (
              <li key={item.id} className="rounded-lg border border-border bg-surface p-4 shadow-2 md:p-5">
                <div className="flex flex-col gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{item.nama}</p>
                    <p className="truncate text-caption text-muted">
                      {item.nik} {'\u00B7'} {item.departmentNama}
                    </p>
                    <p className="text-caption text-muted">Diminta {formatRequested(item.requestedAt)}</p>
                  </div>
                  {own && (
                    <p className="text-caption text-muted">
                      Ini perangkatmu sendiri. Minta HRD lain atau Admin untuk menyetujuinya.
                    </p>
                  )}
                  <div className="flex flex-col gap-3 md:flex-row md:justify-end">
                    <Button
                      variant="danger"
                      className="w-full md:w-auto"
                      onClick={() => setTarget({ item, action: 'reject' })}
                    >
                      Tolak
                    </Button>
                    <Button
                      variant="success"
                      className="w-full md:w-auto"
                      disabled={own}
                      onClick={() => setTarget({ item, action: 'approve' })}
                    >
                      Setujui
                    </Button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <ConfirmDialog
        open={target !== null}
        title={target?.action === 'approve' ? 'Setujui perangkat ini?' : 'Tolak permintaan ini?'}
        confirmLabel={target?.action === 'approve' ? 'Setujui' : 'Tolak'}
        confirmVariant={target?.action === 'approve' ? 'success' : 'danger'}
        busy={busy}
        onConfirm={() => void confirm()}
        onCancel={() => setTarget(null)}
      >
        {target?.action === 'approve'
          ? `${target.item.nama} (${target.item.nik}) akan memakai perangkat ini untuk absen. Perangkat lain milik akun itu dihapus.`
          : target
            ? `Permintaan ${target.item.nama} dihapus. Perangkat lama akunnya tetap aktif.`
            : null}
      </ConfirmDialog>
    </div>
  );
}