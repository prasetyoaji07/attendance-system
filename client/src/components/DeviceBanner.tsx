import { Link } from 'react-router-dom';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/lib/auth';

/**
 * Status perangkat di semua halaman setelah login. Hanya tampil bila ada yang perlu diketahui:
 * - pending: perangkat baru menunggu persetujuan (teks berbeda per role)
 * - error: pendaftaran perangkat gagal (mis. jaringan); bisa dicoba lagi
 * Perangkat active atau sedang dicek tidak menampilkan apa-apa.
 */
export default function DeviceBanner() {
  const { user, device, retryDevice } = useAuth();

  if (device.status === 'pending') {
    return (
      <div className="mb-4">
        <Alert tone="warning" title="Perangkat ini menunggu persetujuan">
          {user?.role === 'ADMIN' ? (
            <>
              Kamu belum bisa absen dari sini. Setujui lewat halaman{' '}
              <Link to="/perangkat" className="font-semibold text-primary-600 underline">
                Perangkat
              </Link>
              .
            </>
          ) : user?.role === 'HRD' ? (
            'Kamu belum bisa absen dari sini. Perlu disetujui HRD lain atau Admin; kamu tidak bisa menyetujui perangkatmu sendiri.'
          ) : (
            'Kamu belum bisa absen dari sini sampai HRD menyetujuinya. Kalau mendesak, kabari HRD ya.'
          )}
        </Alert>
      </div>
    );
  }
  if (device.status === 'error') {
    return (
      <div className="mb-4">
        <Alert
          tone="danger"
          title="Perangkat belum terdaftar"
          action={
            <Button variant="secondary" onClick={retryDevice}>
              Coba lagi
            </Button>
          }
        >
          {device.message}
        </Alert>
      </div>
    );
  }
  return null;
}