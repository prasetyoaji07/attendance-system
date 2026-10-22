import { CameraOff, LoaderCircle } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { captureJpeg, type JpegShot } from './imageResize';

type CamState = 'starting' | 'live' | 'denied' | 'nocamera' | 'unsupported' | 'error';
type Phase = 'camera' | 'preview';

const CAM_ERRORS: Record<'denied' | 'nocamera' | 'unsupported' | 'error', string> = {
  denied: 'Izin kamera ditolak. Aktifkan kamera untuk situs ini di pengaturan browser, lalu coba lagi.',
  nocamera: 'Kamera tidak ditemukan di perangkat ini.',
  unsupported: 'Browser ini tidak bisa memakai kamera. Buka lewat HTTPS atau localhost.',
  error: 'Kamera belum bisa dibuka. Tutup aplikasi lain yang sedang memakai kamera, lalu coba lagi.',
};

interface Props {
  open: boolean;
  title: string;
  /** Dipanggil saat pengguna memilih "Pakai foto ini". Induk yang menutup dialog. */
  onResult: (jpegBase64: string) => void;
  onCancel: () => void;
  /** Dipanggil tepat saat "Ambil foto" ditekan; hasilnya dicetak di pojok bawah foto (jamnya jadi segar). */
  getOverlayLines?: () => string[];
}

/*
 * Selfie langsung dari kamera depan (getUserMedia). Tidak ada input file, jadi tidak bisa memilih dari galeri.
 * Pola dialog sama dengan QrScanner (modal di desktop, bottom sheet di HP).
 * Pengecualian token: warna overlay rgba(11,13,20,0.5) disalin dari ConfirmDialog.
 */
export function SelfieCamera({ open, title, onResult, onCancel, getOverlayLines }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [cam, setCam] = useState<CamState>('starting');
  const [phase, setPhase] = useState<Phase>('camera');
  const [shot, setShot] = useState<JpegShot | null>(null);
  const [taking, setTaking] = useState(false);
  const [attempt, setAttempt] = useState(0);

  // Dialog ditutup: kembali ke keadaan awal.
  useEffect(() => {
    if (!open) {
      setPhase('camera');
      setShot(null);
      setTaking(false);
    }
  }, [open]);

  // Kamera hanya menyala saat dialog terbuka dan belum di tahap pratinjau.
  useEffect(() => {
    if (!open || phase !== 'camera') return;
    setCam('starting');
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      setCam('unsupported');
      return;
    }

    let cancelled = false;
    let stream: MediaStream | null = null;

    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'user' }, audio: false })
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
        if (!cancelled) setCam('live');
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
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [open, phase, attempt]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !taking) onCancel();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, taking, onCancel]);

  async function take() {
    const video = videoRef.current;
    if (!video || taking) return;
    setTaking(true);
    try {
      const s = await captureJpeg(video, getOverlayLines?.() ?? []);
      setShot(s);
      setPhase('preview');
    } catch {
      setCam('error');
    } finally {
      setTaking(false);
    }
  }

  if (!open) return null;

  const failed = cam === 'denied' || cam === 'nocamera' || cam === 'unsupported' || cam === 'error';
  const canRetry = cam === 'denied' || cam === 'error';

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-[rgba(11,13,20,0.5)] backdrop-blur-sm md:items-center md:p-4"
      onClick={() => {
        if (!taking) onCancel();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="selfie-title"
        className="w-full rounded-t-xl bg-surface p-4 shadow-4 md:max-w-[480px] md:rounded-xl md:p-6"
        style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom, 0px))' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-border md:hidden" aria-hidden="true" />
        <h2 id="selfie-title" className="text-h3 text-text">
          {title}
        </h2>
        <p className="mt-2 text-body text-muted">
          {phase === 'camera'
            ? 'Hadap ke kamera dan pastikan wajahmu terlihat jelas. Foto diambil langsung dari kamera.'
            : 'Cek fotonya. Kalau wajahmu terlihat jelas, pakai foto ini.'}
        </p>

        <div className="relative mt-4 aspect-[4/3] w-full overflow-hidden rounded-lg bg-surface-2">
          {phase === 'preview' && shot ? (
            <img src={shot.previewUrl} alt="Hasil selfie" className="h-full w-full object-cover" />
          ) : failed ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center" role="alert">
              <CameraOff size={40} strokeWidth={1.75} className="text-muted" aria-hidden="true" />
              <p className="text-body text-text">{CAM_ERRORS[cam]}</p>
            </div>
          ) : (
            <>
              {/* Dicerminkan hanya di layar supaya terasa seperti cermin; foto yang dikirim tidak dicerminkan. */}
              <video
                ref={videoRef}
                className="h-full w-full -scale-x-100 object-cover"
                playsInline
                muted
                aria-label="Tampilan kamera depan"
              />
              {cam === 'starting' && (
                <div className="absolute inset-0 flex items-center justify-center bg-surface-2" role="status">
                  <LoaderCircle size={40} strokeWidth={1.75} className="text-muted motion-safe:animate-spin" aria-label="Membuka kamera" />
                </div>
              )}
            </>
          )}
        </div>

        <p className="mt-3 text-caption text-muted">Fotomu hanya dilihat HRD dan dihapus otomatis setelah 30 hari.</p>

        <div className="mt-6 flex flex-col-reverse gap-3 md:flex-row md:justify-end">
          {phase === 'preview' ? (
            <>
              <Button
                variant="secondary"
                className="w-full md:w-auto"
                onClick={() => {
                  setShot(null);
                  setPhase('camera');
                }}
              >
                Ulangi
              </Button>
              <Button className="w-full md:w-auto" onClick={() => shot && onResult(shot.base64)}>
                Pakai foto ini
              </Button>
            </>
          ) : (
            <>
              <Button variant="secondary" className="w-full md:w-auto" onClick={onCancel} disabled={taking}>
                Batal
              </Button>
              {failed ? (
                canRetry && (
                  <Button className="w-full md:w-auto" onClick={() => setAttempt((a) => a + 1)}>
                    Coba lagi
                  </Button>
                )
              ) : (
                <Button className="w-full md:w-auto" onClick={() => void take()} disabled={cam !== 'live' || taking}>
                  {taking ? 'Memproses...' : 'Ambil foto'}
                </Button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
