import cron from 'node-cron';
import { RULES } from '../core/rules';
import { runAutoClose } from './auto-close';
import { runDailyClose } from './daily-close';

export function startJobs() {
  // Tiap hari 00:05 WIB
  cron.schedule('5 0 * * *', () => void runDailyClose(), { timezone: RULES.timezone });
  // Tiap 15 menit: tutup absen yang check-in-nya ada tetapi check-out-nya tidak ada setelah batas waktu
  cron.schedule('*/15 * * * *', () => void runAutoClose(), { timezone: RULES.timezone });
  console.log('[jobs] cron aktif');
}
