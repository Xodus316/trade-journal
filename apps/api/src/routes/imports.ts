import { Router } from 'express';
import { z } from 'zod';

import { importTransactionsCsv } from '../lib/csv-import.js';
import { getImportBatchReview, getImportReconciliation, listImportBatches } from '../lib/imports-service.js';

export const importsRouter = Router();

const importSchema = z.object({
  fileName: z.string().min(1),
  csvText: z.string().min(1)
});

importsRouter.get('/', async (_req, res) => {
  const items = await listImportBatches();
  res.json({ items });
});

importsRouter.get('/reconciliation', async (_req, res) => {
  res.json(await getImportReconciliation());
});

importsRouter.get('/:batchId', async (req, res) => {
  const review = await getImportBatchReview(req.params.batchId);
  if (!review) {
    return res.status(404).json({ message: 'Import batch not found.' });
  }

  return res.json(review);
});

importsRouter.post('/', async (req, res) => {
  const parsed = importSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      message: 'Invalid import payload.',
      issues: parsed.error.flatten()
    });
  }

  try {
    const result = await importTransactionsCsv(parsed.data.fileName, parsed.data.csvText);
    return res.status(201).json(result);
  } catch (error) {
    return res.status(400).json({
      message: error instanceof Error ? error.message : 'Import failed.'
    });
  }
});
