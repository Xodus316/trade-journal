import { Router } from 'express';

import type { AnalyticsFilters } from '@trade-journal/shared';

import { defaultAnalyticsFilters, getAnalytics, getStockAnalytics, getStrategyAnalytics } from '../lib/analytics-service.js';

export const analyticsRouter = Router();

function parseFilters(query: Record<string, unknown>): AnalyticsFilters {
  const positionSide = query.positionSide === 'Long' || query.positionSide === 'Short' ? query.positionSide : '';
  const botOpened = query.botOpened === 'bot' || query.botOpened === 'manual' ? query.botOpened : 'all';
  const status = query.status === 'open' || query.status === 'closed' ? query.status : 'all';

  return {
    ...defaultAnalyticsFilters,
    dateFrom: typeof query.dateFrom === 'string' && query.dateFrom ? query.dateFrom : null,
    dateTo: typeof query.dateTo === 'string' && query.dateTo ? query.dateTo : null,
    stock: typeof query.stock === 'string' ? query.stock : '',
    strategyType: typeof query.strategyType === 'string' ? query.strategyType : '',
    positionSide,
    botOpened,
    status
  };
}

analyticsRouter.get('/', async (req, res) => {
  const payload = await getAnalytics(parseFilters(req.query));
  res.json(payload);
});

analyticsRouter.get('/stocks/:stock', async (req, res) => {
  const payload = await getStockAnalytics(req.params.stock);

  if (!payload) {
    return res.status(404).json({
      message: 'Stock not found.'
    });
  }

  return res.json(payload);
});

analyticsRouter.get('/strategies/:positionSide/:strategyType', async (req, res) => {
  const payload = await getStrategyAnalytics(req.params.positionSide, req.params.strategyType);

  if (!payload) {
    return res.status(404).json({
      message: 'Strategy not found.'
    });
  }

  return res.json(payload);
});
