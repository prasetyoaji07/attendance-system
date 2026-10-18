import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/lib/auth';

/**
 * Status perangkat di semua halaman setelah login. Hanya tampil bila ada yang perlu diketahui:
 * - pending: perangkat baru menunggu persetujuan HRD (belum bisa absen dari sini)
 * - error: pendaftaran perangkat gagal (mis. jaringan); bisa dicoba lagi
 * Perangkat active atau sedang dicek tidak menampilkan apa-apa.
 */
export default function DeviceBanner() {
  const { device, retryDevice } = useAuth();

  if (device.status === 'pending') {
    return (
      <div className="mb-4">
        <Alert tone="warning" title="Perangkat ini menunggu persetujuan">
          Kamu belum bisa absen dari sini sampai HRD menyetujuinya. Kalau mendesak, kabari HRD ya.
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
