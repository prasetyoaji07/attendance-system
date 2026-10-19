import { MapPin } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { useEffect, useState } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { useLocationQr, useLocations } from '@/features/locations/useLocationQr';
import { friendlyError } from '@/lib/api-errors';

/** Detik tersisa sampai refreshAt, diperbarui tiap detik. */
function useSecondsLeft(refreshAt: string | undefined): number | null {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!refreshAt) return;
    setNow(Date.now());
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, [refreshAt]);
  if (!refreshAt) return null;
  return Math.max(0, Math.ceil((new Date(refreshAt).getTime() - now) / 1000));
}

function QrSkeleton() {
  return (
    <div className="flex flex-col items-center gap-4" role="status" aria-label="Memuat QR">
      <div className="aspect-square w-full max-w-sm rounded-lg bg-surface-2 motion-safe:animate-pulse" />
      <div className="h-4 w-40 rounded-sm bg-surface-2 motion-safe:animate-pulse" />
    </div>
  );
}

export default function LocationQr() {
  const locations = useLocations();
  const [picked, setPicked] = useState<string | null>(null);

  const list = locations.data;
  // Satu lokasi saja: langsung terpilih. Beberapa: pilihan pertama sampai kamu memilih.
  const selectedId = picked ?? (list && list.length > 0 ? String(list[0].id) : null);
  const qr = useLocationQr(selectedId);
  const secondsLeft = useSecondsLeft(qr.data?.refreshAt);
  const ttl = qr.data?.ttlSeconds ?? 0;
  const percent = secondsLeft !== null && ttl > 0 ? Math.min(100, (secondsLeft / ttl) * 100) : 0;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-h1">QR Lokasi</h1>
        <p className="text-muted">Tampilkan layar ini di lokasi kerja. Kodenya berganti sendiri tiap beberapa detik.</p>
      </div>

      {locations.isLoading ? (
        <QrSkeleton />
      ) : locations.isError ? (
        <Alert
          tone="danger"
          title="Daftar lokasi gagal dimuat"
          action={
            <Button variant="secondary" onClick={() => void locations.refetch()}>
              Coba lagi
            </Button>
          }
        >
          {friendlyError(locations.error)}
        </Alert>
      ) : list && list.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-border bg-surface p-8 text-center shadow-2">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-50 text-primary-600">
            <MapPin size={24} strokeWidth={1.75} aria-hidden="true" />
          </div>
          <h2 className="text-h3">Belum ada lokasi</h2>
          <p className="text-muted">Tambahkan lokasi kerja dulu, nanti QR-nya muncul di sini.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {list && list.length > 1 && (
            <div className="flex flex-col gap-2">
              <label htmlFor="lokasi" className="text-caption font-semibold text-muted">
                Lokasi
              </label>
              <select
                id="lokasi"
                value={selectedId ?? ''}
                onChange={(e) => setPicked(e.target.value)}
                className="h-12 rounded-md border border-border bg-surface px-4 text-body text-text focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-primary-200"
              >
                {list.map((l) => (
                  <option key={l.id} value={String(l.id)}>
                    {l.nama}
                  </option>
                ))}
              </select>
            </div>
          )}

          {qr.isError ? (
            <Alert
              tone="danger"
              title="QR gagal dimuat"
              action={
                <Button variant="secondary" onClick={() => void qr.refetch()}>
                  Coba lagi
                </Button>
              }
            >
              {friendlyError(qr.error)}
            </Alert>
          ) : !qr.data ? (
            <QrSkeleton />
          ) : (
            <div className="flex flex-col items-center gap-4 rounded-lg border border-border bg-surface p-4 shadow-2 md:p-5">
              <h2 className="text-h3">{qr.data.locationNama}</h2>
              {/* Pengecualian token warna: QR harus gelap pekat di atas putih agar terbaca kamera,
                  juga di mode gelap. */}
              <div className="w-full max-w-sm rounded-lg bg-white p-4">
                <QRCodeSVG value={qr.data.token} size={256} level="M" fgColor="#000000" bgColor="#FFFFFF" className="h-auto w-full" />
              </div>
              <div className="flex w-full max-w-sm flex-col gap-2" role="timer" aria-label="Waktu sampai QR berganti">
                <div className="h-2 w-full overflow-hidden rounded-full bg-surface-2">
                  <div
                    className="h-full rounded-full bg-primary-500 transition-[width] duration-1000 ease-linear motion-reduce:transition-none"
                    style={{ width: `${percent}%` }}
                  />
                </div>
                <p className="text-center text-caption text-muted">
                  {secondsLeft === null ? '' : `Berganti dalam ${secondsLeft} detik`}
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
