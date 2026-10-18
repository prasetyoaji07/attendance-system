import cron from 'node-cron';
import { RULES } from '../core/rules';
import { runDailyClose } from './daily-close';

export function startJobs() {
  // Tiap hari 00:05 WIB
  cron.schedule('5 0 * * *', () => void runDailyClose(), { timezone: RULES.timezone });
  console.log('[jobs] cron aktif');
}
