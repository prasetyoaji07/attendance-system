import { CalendarOff, CircleAlert, Clock, LocateFixed, LogOut, MapPin } from 'lucide-react';
import { useState } from 'react';
import { AttendanceButton, type AttendanceButtonState } from '@/components/AttendanceButton';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { distanceMeters } from '@/features/attendance/distance';
import {
  EARLY_LEAVE_REASONS,
  EARLY_LEAVE_REASON_LABELS,
  type EarlyLeaveReason,
} from '@/features/attendance/earlyLeave';
import { dateWib, greetingWib, timeWib } from '@/features/attendance/format';
import { QrScanner } from '@/features/attendance/QrScanner';
import { useGeolocation } from '@/features/attendance/useGeolocation';
import { useSubmitAttendance } from '@/features/attendance/useSubmitAttendance';
import { useToday } from '@/features/attendance/useToday';
import { friendlyError } from '@/lib/api-errors';
import { useAuth } from '@/lib/auth';

/** Salinan RULES.maxGpsAccuracyM server (hanya untuk tanda "GPS lemah" di layar; server tetap penentu). */
const MAX_ACCURACY_M = 50;

/** Titik tengah (middle dot). Ditulis sebagai escape supaya aman dari masalah encoding file. */
const DOT = '\u00b7';

const REASON_OPTIONS = EARLY_LEAVE_REASONS.map((r) => ({ value: r, label: EARLY_LEAVE_REASON_LABELS[r] }));

interface Notice {
  tone: 'info' | 'danger';
  title: string;
  text: string;
}

function BerandaSkeleton() {
  return (
    <div className="flex flex-col items-center gap-4" role="status" aria-label="Memuat beranda">
      <div className="h-28 w-full rounded-xl bg-surface-2 motion-safe:animate-pulse" />
      <div className="h-[168px] w-[168px] rounded-full bg-surface-2 motion-safe:animate-pulse md:h-[192px] md:w-[192px]" />
      <div className="h-6 w-48 rounded-sm bg-surface-2 motion-safe:animate-pulse" />
    </div>
  );
}

function Chip({ icon, children, warn = false }: { icon: React.ReactNode; children: React.ReactNode; warn?: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-sm bg-surface-2 px-3 py-1 text-caption ${warn ? 'text-text' : 'text-muted'}`}
    >
      {icon}
      {/* Satu elemen untuk seluruh teks, supaya jarak (gap) hanya antara ikon dan teks. */}
      <span>{children}</span>
    </span>
  );
}

export default function Beranda() {
  const { user } = useAuth();
  const today = useToday();
  const data = today.data;

  const needsLocation = data?.status === 'NOT_CHECKED_IN' || data?.status === 'CHECKED_IN';
  const { geo, refresh } = useGeolocation(needsLocation);
  const [reason, setReason] = useState<EarlyLeaveReason | ''>('');
  const [scanning, setScanning] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const submit = useSubmitAttendance();

  const firstName = user?.nama.split(' ')[0] ?? '';

  if (today.isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <BerandaSkeleton />
      </div>
    );
  }

  if (today.isError || !data) {
    return (
      <Alert
        tone="danger"
        title="Beranda gagal dimuat"
        action={
          <Button variant="secondary" onClick={() => void today.refetch()}>
            Coba lagi
          </Button>
        }
      >
        {friendlyError(today.error)}
      </Alert>
    );
  }

  const roster = data.roster;
  const att = data.attendance;
  const mode: 'in' | 'out' = data.status === 'CHECKED_IN' ? 'out' : 'in';
  const showEarlyReason = data.status === 'CHECKED_IN' && data.checkOut?.early === true;

  // Jarak ke lokasi kerja (hanya tampilan; server yang memutuskan di check-in/out).
  const distanceM =
    geo.status === 'ready' && roster
      ? Math.round(distanceMeters({ lat: geo.lat, lng: geo.lng }, roster.location))
      : null;
  const outside = distanceM !== null && roster !== null && distanceM > roster.location.radiusM;
  const weakGps = geo.status === 'ready' && geo.accuracyM > MAX_ACCURACY_M;

  function handleScan(qr: string) {
    setScanning(false);
    setNotice(null);
    submit.mutate(
      { mode, qr, earlyLeaveReason: mode === 'out' && reason ? reason : undefined },
      {
        onSuccess: (res) =>
          setNotice({
            tone: 'info',
            title: mode === 'in' ? 'Absen masuk tercatat' : 'Absen pulang tercatat',
            text: res.message,
          }),
        onError: (err) => {
          setNotice({ tone: 'danger', title: 'Absen belum berhasil', text: friendlyError(err) });
          refresh(); // perbarui jarak dan akurasi di layar
        },
      },
    );
  }

  // Tampilan tombol Absen menurut status dari server dan keadaan GPS.
  let btn: { state: AttendanceButtonState; label: string; detail?: string; onClick?: () => void } | null = null;
  if (data.status === 'NOT_CHECKED_IN' || data.status === 'CHECKED_IN') {
    const action = mode === 'out' ? 'Absen Pulang' : 'Absen Masuk';
    if (submit.isPending) {
      btn = { state: 'sending', label: 'Mengirim...' };
    } else if (geo.status === 'idle' || geo.status === 'locating') {
      btn = { state: 'locating', label: 'Mencari lokasi...' };
    } else if (geo.status === 'ready') {
      if (outside) btn = { state: 'outside', label: 'Di luar area', detail: `${distanceM} m` };
      else if (weakGps) btn = { state: 'weak', label: 'GPS lemah', detail: `${Math.round(geo.accuracyM)} m` };
      else if (showEarlyReason && !reason) btn = { state: 'idle', label: 'Pilih alasan dulu' };
      else
        btn = {
          state: 'ready',
          label: action,
          onClick: () => {
            setNotice(null);
            setScanning(true);
          },
        };
    } else {
      btn = { state: 'idle', label: 'Lokasi belum aktif' };
    }
  } else if (data.status === 'CHECKED_OUT') {
    btn = { state: 'done', label: 'Sudah pulang' };
  } else if (data.status === 'UPCOMING') {
    btn = { state: 'idle', label: 'Belum waktunya', detail: data.window ? `Buka ${timeWib(data.window.opensAt)}` : undefined };
  } else if (data.status === 'AUTO_CLOSED') {
    btn = { state: 'idle', label: 'Ditutup otomatis' };
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-h1">
          {greetingWib(data.serverTime)}
          {firstName ? `, ${firstName}` : ''}
        </h1>
        <p className="text-muted">{dateWib(data.serverTime)}</p>
      </div>

      {roster ? (
        <section className="card-hero">
          <p className="text-caption uppercase tracking-wider opacity-80">
            {data.status === 'UPCOMING' ? 'Shift berikutnya' : 'Shift hari ini'} {DOT} {roster.shiftNama}
          </p>
          <p className="font-mono text-h1">
            {roster.startTime} - {roster.endTime}
          </p>
          <p className="text-body opacity-90">{roster.location.nama}</p>
        </section>
      ) : (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-border bg-surface p-8 text-center shadow-2">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-50 text-primary-600">
            <CalendarOff size={24} strokeWidth={1.75} aria-hidden="true" />
          </div>
          <h2 className="text-h3">Hari ini tidak ada jadwal</h2>
          <p className="text-muted">Nikmati waktu istirahatmu. Cek tab Jadwal untuk shift berikutnya.</p>
        </div>
      )}

      {btn && (
        <section className="flex flex-col items-center gap-3">
          <AttendanceButton state={btn.state} label={btn.label} detail={btn.detail} onClick={btn.onClick} />

          {roster && geo.status === 'ready' && (
            <div className="flex flex-wrap items-center justify-center gap-2">
              <Chip icon={<MapPin size={14} strokeWidth={1.75} aria-hidden="true" />}>
                <span className="font-mono">{distanceM} m</span> dari {roster.location.nama}
              </Chip>
              <Chip
                warn={weakGps}
                icon={
                  weakGps ? (
                    <CircleAlert size={14} strokeWidth={1.75} className="text-warning" aria-hidden="true" />
                  ) : (
                    <LocateFixed size={14} strokeWidth={1.75} aria-hidden="true" />
                  )
                }
              >
                Akurasi <span className="font-mono">{Math.round(geo.accuracyM)} m</span>
                {weakGps ? ', GPS lemah' : ''}
              </Chip>
            </div>
          )}

          {(geo.status === 'denied' || geo.status === 'unavailable' || geo.status === 'error') && needsLocation && (
            <div className="w-full max-w-md">
              <Alert
                tone="warning"
                title="Lokasi belum aktif"
                action={
                  geo.status === 'unavailable' ? undefined : (
                    <Button variant="secondary" onClick={refresh}>
                      Coba lagi
                    </Button>
                  )
                }
              >
                {geo.status === 'denied'
                  ? 'Izin lokasi ditolak. Aktifkan lokasi untuk situs ini di pengaturan browser, lalu coba lagi.'
                  : geo.status === 'unavailable'
                    ? 'Browser ini tidak bisa memakai lokasi. Buka lewat HTTPS atau localhost.'
                    : geo.message}
              </Alert>
            </div>
          )}

          {weakGps && (
            <p className="max-w-md text-center text-caption text-muted">
              Sinyal GPS masih lemah (batas {MAX_ACCURACY_M} m). Pindah ke tempat terbuka lalu cari lokasi lagi.
            </p>
          )}

          {(weakGps || outside) && !submit.isPending && (
            <Button variant="secondary" onClick={refresh}>
              Cari lokasi lagi
            </Button>
          )}

          {data.status === 'AUTO_CLOSED' && (
            <div className="w-full max-w-md">
              <Alert tone="warning" title="Absen ditutup otomatis">
                Jam pulangmu belum tercatat. Ajukan koreksi absen ke HRD ya.
              </Alert>
            </div>
          )}

          {data.status === 'UPCOMING' && data.window && (
            <p className="max-w-md text-center text-caption text-muted">
              Jendela absen dibuka pukul {timeWib(data.window.opensAt)} WIB.
            </p>
          )}
        </section>
      )}

      {notice && (
        <div className="mx-auto w-full max-w-md">
          <Alert tone={notice.tone} title={notice.title}>
            {notice.text}
          </Alert>
        </div>
      )}

      {showEarlyReason && (
        <div className="mx-auto flex w-full max-w-md flex-col gap-2">
          <Select
            label="Alasan pulang lebih awal"
            value={reason}
            options={REASON_OPTIONS}
            onChange={setReason}
            placeholder="Pilih alasan"
            disabled={submit.isPending}
          />
          <p className="text-caption text-muted">Belum jam selesai shift, jadi alasan pulang wajib dipilih.</p>
        </div>
      )}

      {att && (
        <div className="mx-auto w-full max-w-md rounded-lg border border-border bg-surface p-4 shadow-2">
          <p className="font-semibold">
            Masuk <span className="font-mono">{timeWib(att.checkInAt)}</span> WIB
            {att.checkOutAt ? (
              <>
                {' '}
                {DOT} Pulang <span className="font-mono">{timeWib(att.checkOutAt)}</span> WIB
              </>
            ) : null}
          </p>
          {att.lateMinutes > 0 || att.earlyLeaveMinutes > 0 ? (
            <div className="mt-2 flex flex-wrap gap-2">
              {att.lateMinutes > 0 && (
                <Chip warn icon={<Clock size={14} strokeWidth={1.75} aria-hidden="true" />}>
                  Telat <span className="font-mono">{att.lateMinutes}</span> menit
                </Chip>
              )}
              {att.earlyLeaveMinutes > 0 && (
                <Chip warn icon={<LogOut size={14} strokeWidth={1.75} aria-hidden="true" />}>
                  Pulang cepat <span className="font-mono">{att.earlyLeaveMinutes}</span> menit
                </Chip>
              )}
            </div>
          ) : (
            <p className="text-caption text-muted">Tepat waktu.</p>
          )}
        </div>
      )}

      <QrScanner
        open={scanning}
        title={mode === 'in' ? 'Scan QR untuk absen masuk' : 'Scan QR untuk absen pulang'}
        onResult={handleScan}
        onCancel={() => setScanning(false)}
      />
    </div>
  );
}
