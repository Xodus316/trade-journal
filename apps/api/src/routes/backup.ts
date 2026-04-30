import { Router } from 'express';
import { z } from 'zod';

import type { BackupPayload } from '@trade-journal/shared';

import { exportBackup, restoreBackup } from '../lib/backup-service.js';

export const backupRouter = Router();

const transactionSchema = z.object({}).passthrough();
const backupSchema = z.object({
  version: z.literal(1),
  exportedAt: z.string(),
  importBatches: z.array(z.object({}).passthrough()),
  transactions: z.array(transactionSchema),
  dailyReviews: z.array(z.object({}).passthrough())
});

backupRouter.get('/', async (_req, res) => {
  res.json(await exportBackup());
});

backupRouter.post('/restore', async (req, res) => {
  const parsed = backupSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid backup payload.' });
  }

  try {
    return res.json(await restoreBackup(parsed.data as unknown as BackupPayload));
  } catch (error) {
    return res.status(400).json({
      message: error instanceof Error ? error.message : 'Restore failed.'
    });
  }
});
