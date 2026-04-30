import { Router } from 'express';
import { z } from 'zod';

import { query } from '../lib/db.js';

export const cleanupRouter = Router();

const renameSchema = z.object({
  from: z.string().min(1),
  to: z.string().min(1)
});

const groupSchema = z.object({
  ids: z.array(z.string()).min(1),
  positionGroup: z.string().min(1)
});

cleanupRouter.post('/strategy', async (req, res) => {
  const parsed = renameSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid strategy cleanup payload.' });
  }

  const result = await query('UPDATE transactions SET strategy_type = $2, updated_at = NOW() WHERE strategy_type = $1', [
    parsed.data.from,
    parsed.data.to
  ]);
  return res.json({ updated: result.rowCount ?? 0 });
});

cleanupRouter.post('/stock', async (req, res) => {
  const parsed = renameSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid stock cleanup payload.' });
  }

  const result = await query('UPDATE transactions SET stock = $2, updated_at = NOW() WHERE stock = $1', [
    parsed.data.from,
    parsed.data.to
  ]);
  return res.json({ updated: result.rowCount ?? 0 });
});

cleanupRouter.post('/group', async (req, res) => {
  const parsed = groupSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid group cleanup payload.' });
  }

  const result = await query(
    'UPDATE transactions SET position_group = $2, updated_at = NOW() WHERE id = ANY($1::uuid[])',
    [parsed.data.ids, parsed.data.positionGroup]
  );

  return res.json({ updated: result.rowCount ?? 0 });
});
