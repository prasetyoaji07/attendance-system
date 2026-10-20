import jsQR from 'jsqr';
import { CameraOff, LoaderCircle } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';

type CamState = 'starting' | 'scanning' | 'denied' | 'nocamera' | 'unsupported' | 'error';

/** Lebar maksimum frame yang dibaca jsQR (bukan gaya): frame lebih kecil = pembacaan lebih cepat. */
const MAX_FRAME_WIDTH = 640;

const CAM_ERRORS: Record<'denied' | 'nocamera' | 'unsupported' | 'error', string> = {
  denied: 'Izin kamera ditolak. Aktifkan kamera untuk situs ini di pengaturan browser, lalu buka pemindai lagi.',
  nocamera: 'Kamera tidak ditemukan di perangkat ini.',
  unsupported: 'Browser ini tidak bisa memakai kamera. Buka lewat HTTPS atau localhost.',
  error: 'Kamera belum bisa dibuka. Tutup aplikasi lain yang sedang memakai kamera, lalu coba lagi.',
};

interface Props {
  open: boolean;
  title: string;
  /** Dipanggil sekali begitu QR terbaca. Induk yang menutup dialog (kamera mati saat open=false). */
  onResult: (text: string) => void;
  onCancel: () => void;
}

/*
 * Pola dialog sama dengan ui/ConfirmDialog (modal di desktop, bottom sheet di HP).
 * Pengecualian token: warna overlay rgba(11,13,20,0.5) disalin dari ConfirmDialog.
 */
export function QrScanner({ open, title, onResult, onCancel }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const resultRef = useRef(onResult);
  resultRef.current = onResult;
  const [cam, setCam] = useState<CamState>('starting');

  useEffect(() => {
    if (!open) return;
    setCam('starting');
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      setCam('unsupported');
      return;
    }

    let cancelled = false;
    let stream: MediaStream | null = null;
    let raf = 0;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    const stop = () => {
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
      stream = null;
    };

    const tick = () => {
      const video = videoRef.current;
      if (cancelled || !video || !ctx) return;
      if (video.readyState >= video.HAVE_ENOUGH_DATA && video.videoWidth > 0) {
        const scale = Math.min(1, MAX_FRAME_WIDTH / video.videoWidth);
        const w = Math.round(video.videoWidth * scale);
        const h = Math.round(video.videoHeight * scale);
        canvas.width = w;
        canvas.height = h;
        ctx.drawImage(video, 0, 0, w, h);
        const img = ctx.getImageData(0, 0, w, h);
        const code = jsQR(img.data, w, h, { inversionAttempts: 'dontInvert' });
        if (code?.data) {
          cancelled = true;
          stop();
          resultRef.current(code.data);
          return;
        }
      }
      raf = requestAnimationFrame(tick);
    };

    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false })
      .then(async (s) => {
        if (cancelled) {
          s.getTracks().forEach((t) => t.stop());
          return;
        }
        stream = s;
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = s;
        await video.play();
        if (cancelled) return;
        setCam('scanning');
        raf = requestAnimationFrame(tick);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const name = err instanceof DOMException ? err.name : '';
        if (name === 'NotAllowedError' || name === 'SecurityError') setCam('denied');
        else if (name === 'NotFoundError' || name === 'DevicesNotFoundError' || name === 'OverconstrainedError') setCam('nocamera');
        else setCam('error');
      });

    return () => {
      cancelled = true;
      stop();
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onCancel]);

  if (!open) return null;

  const failed = cam === 'denied' || cam === 'nocamera' || cam === 'unsupported' || cam === 'error';

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-[rgba(11,13,20,0.5)] backdrop-blur-sm md:items-center md:p-4"
      onClick={onCancel}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="qr-title"
        className="w-full rounded-t-xl bg-surface p-4 shadow-4 md:max-w-[480px] md:rounded-xl md:p-6"
        style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom, 0px))' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-border md:hidden" aria-hidden="true" />
        <h2 id="qr-title" className="text-h3 text-text">
          {title}
        </h2>
        <p className="mt-2 text-body text-muted">Arahkan kamera ke QR yang tampil di layar lokasi kerja.</p>

        <div className="relative mt-4 aspect-square w-full overflow-hidden rounded-lg bg-surface-2">
          {failed ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center" role="alert">
              <CameraOff size={40} strokeWidth={1.75} className="text-muted" aria-hidden="true" />
              <p className="text-body text-text">{CAM_ERRORS[cam]}</p>
            </div>
          ) : (
            <>
              <video ref={videoRef} className="h-full w-full object-cover" playsInline muted aria-label="Tampilan kamera" />
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-8 rounded-lg border-2 border-primary-500"
              />
              {cam === 'starting' && (
                <div className="absolute inset-0 flex items-center justify-center bg-surface-2" role="status">
                  <LoaderCircle size={40} strokeWidth={1.75} className="text-muted motion-safe:animate-spin" aria-label="Membuka kamera" />
                </div>
              )}
            </>
          )}
        </div>

        <div className="mt-6 flex">
          <Button variant="secondary" className="w-full md:ml-auto md:w-auto" onClick={onCancel}>
            Batal
          </Button>
        </div>
      </div>
    </div>
  );
}
