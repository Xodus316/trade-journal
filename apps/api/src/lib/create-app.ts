import cors from 'cors';
import express from 'express';

import { analyticsRouter } from '../routes/analytics.js';
import { backupRouter } from '../routes/backup.js';
import { cleanupRouter } from '../routes/cleanup.js';
import { dailyReviewsRouter } from '../routes/daily-reviews.js';
import { healthRouter } from '../routes/health.js';
import { importsRouter } from '../routes/imports.js';
import { positionsRouter } from '../routes/positions.js';
import { transactionsRouter } from '../routes/transactions.js';

export function createApp() {
  const app = express();

  app.use(cors());
  app.use(express.json({ limit: '25mb' }));

  app.get('/', (_req, res) => {
    res.json({
      name: 'trade-journal-api',
      status: 'ok'
    });
  });

  app.use('/health', healthRouter);
  app.use('/transactions', transactionsRouter);
  app.use('/analytics', analyticsRouter);
  app.use('/imports', importsRouter);
  app.use('/positions', positionsRouter);
  app.use('/cleanup', cleanupRouter);
  app.use('/daily-reviews', dailyReviewsRouter);
  app.use('/backup', backupRouter);

  return app;
}
