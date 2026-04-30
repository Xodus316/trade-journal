import { Router } from 'express';

import { getPositionGroup, listPositionGroups } from '../lib/positions-service.js';

export const positionsRouter = Router();

positionsRouter.get('/', async (_req, res) => {
  const items = await listPositionGroups();
  res.json({ items });
});

positionsRouter.get('/:groupKey', async (req, res) => {
  const payload = await getPositionGroup(req.params.groupKey);

  if (!payload) {
    return res.status(404).json({ message: 'Position group not found.' });
  }

  return res.json(payload);
});
