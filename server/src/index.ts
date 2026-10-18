import { createApp } from './app';
import { config } from './core/config';
import { startJobs } from './jobs';

const app = createApp();
app.listen(config.PORT, () => {
  console.log(`API siap di http://localhost:${config.PORT}  (cek: /api/health)`);
  if (config.RUN_JOBS) startJobs();
});
