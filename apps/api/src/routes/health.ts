import { Router } from 'express';

import { query } from '../lib/db.js';

export const healthRouter = Router();

healthRouter.get('/', async (_req, res) => {
  try {
    await query('SELECT 1');
    res.json({
      status: 'ok',
      database: 'connected'
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      database: 'unreachable',
      message: error instanceof Error ? error.message : 'Unknown database error'
    });
  }
});
