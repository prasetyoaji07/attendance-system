import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { config } from './core/config';
import { pool } from './core/db';
import { errorHandler, notFoundHandler } from './core/middleware/error';
import { apiRouter } from './modules';

export function createApp() {
  const app = express();
  app.use(helmet());
  app.use(cors({ origin: config.CORS_ORIGIN.split(','), credentials: true }));
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', async (_req, res) => {
    let db: 'ok' | 'down' = 'ok';
    try {
      await pool.query('SELECT 1');
    } catch {
      db = 'down';
    }
    res.json({ status: 'ok', db, time: new Date().toISOString() });
  });

  app.use('/api', apiRouter);
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
