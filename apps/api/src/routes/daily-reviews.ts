import { Router } from 'express';
import { z } from 'zod';

import { getDailyReview, saveDailyReview } from '../lib/daily-reviews-service.js';

export const dailyReviewsRouter = Router();

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const dailyReviewSchema = z.object({
  notes: z.string().nullable(),
  chartImageDataUrl: z.string().nullable()
});

dailyReviewsRouter.get('/:date', async (req, res) => {
  const parsedDate = dateSchema.safeParse(req.params.date);
  if (!parsedDate.success) {
    return res.status(400).json({ message: 'Invalid review date.' });
  }

  return res.json(await getDailyReview(parsedDate.data));
});

dailyReviewsRouter.put('/:date', async (req, res) => {
  const parsedDate = dateSchema.safeParse(req.params.date);
  const parsedBody = dailyReviewSchema.safeParse(req.body);

  if (!parsedDate.success || !parsedBody.success) {
    return res.status(400).json({ message: 'Invalid daily review payload.' });
  }

  return res.json(await saveDailyReview(parsedDate.data, parsedBody.data));
});
