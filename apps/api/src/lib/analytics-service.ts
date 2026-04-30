import type {
  AnalyticsFilters,
  AnalyticsResponse,
  BotManualRow,
  CalendarDay,
  DayOfWeekBreakdownRow,
  DrawdownSummary,
  EquityPoint,
  HoldingPeriodPoint,
  RealizedTimeframe,
  StreakSummary,
  StockAnalyticsResponse,
  StockBreakdownRow,
  StrategyAnalyticsResponse,
  StrategyBreakdownRow,
  SummaryMetric,
  TimeBucket,
  TradeExtremes,
  TransactionRecord
} from '@trade-journal/shared';

import { query } from './db.js';
import { mapTransactionRow, type TransactionRow } from './transaction-row.js';

function round(value: number) {
  return Number(value.toFixed(2));
}

export const defaultAnalyticsFilters: AnalyticsFilters = {
  dateFrom: null,
  dateTo: null,
  stock: '',
  strategyType: '',
  positionSide: '',
  botOpened: 'all',
  status: 'all'
};

function getWeekBucket(dateString: string) {
  const date = new Date(`${dateString}T00:00:00Z`);
  const utcDate = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = utcDate.getUTCDay() || 7;
  utcDate.setUTCDate(utcDate.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(utcDate.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((utcDate.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${utcDate.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

function getMonthBucket(dateString: string) {
  return dateString.slice(0, 7);
}

function getYearBucket(dateString: string) {
  return dateString.slice(0, 4);
}

function toTimeBuckets(rows: TransactionRecord[], timeframe: RealizedTimeframe): TimeBucket[] {
  const buckets = new Map<string, TimeBucket>();

  for (const row of rows) {
    if (!row.closeDate || row.profit === null) {
      continue;
    }

    const bucketKey =
      timeframe === 'daily'
        ? row.closeDate
        : timeframe === 'weekly'
          ? getWeekBucket(row.closeDate)
          : timeframe === 'monthly'
            ? getMonthBucket(row.closeDate)
            : getYearBucket(row.closeDate);

    const bucket = buckets.get(bucketKey) ?? {
      bucket: bucketKey,
      realizedPnL: 0,
      trades: 0,
      wins: 0,
      losses: 0
    };

    bucket.realizedPnL += row.profit;
    bucket.trades += 1;
    if ((row.profit ?? 0) >= 0) {
      bucket.wins += 1;
    } else {
      bucket.losses += 1;
    }

    buckets.set(bucketKey, bucket);
  }

  return Array.from(buckets.values())
    .map((bucket) => ({
      ...bucket,
      realizedPnL: round(bucket.realizedPnL)
    }))
    .sort((a, b) => a.bucket.localeCompare(b.bucket));
}

function buildSummary(closedRows: TransactionRecord[], openRows: TransactionRecord[]): SummaryMetric {
  const realizedPnL = round(closedRows.reduce((sum, row) => sum + (row.profit ?? 0), 0));
  const totalFees = round(closedRows.reduce((sum, row) => sum + Math.abs(row.fees), 0));
  const winners = closedRows.filter((row) => (row.profit ?? 0) >= 0);
  const losers = closedRows.filter((row) => (row.profit ?? 0) < 0);
  const sumWins = winners.reduce((sum, row) => sum + (row.profit ?? 0), 0);
  const sumLosses = losers.reduce((sum, row) => sum + Math.abs(row.profit ?? 0), 0);

  return {
    realizedPnL,
    totalFees,
    totalClosedTrades: closedRows.length,
    totalOpenPositions: openRows.length,
    wins: winners.length,
    losses: losers.length,
    winRate: closedRows.length ? round((winners.length / closedRows.length) * 100) : 0,
    averageWinner: winners.length ? round(sumWins / winners.length) : 0,
    averageLoser: losers.length ? round(losers.reduce((sum, row) => sum + (row.profit ?? 0), 0) / losers.length) : 0,
    largestWinner: winners.length ? round(Math.max(...winners.map((row) => row.profit ?? 0))) : 0,
    largestLoser: losers.length ? round(Math.min(...losers.map((row) => row.profit ?? 0))) : 0,
    profitFactor: sumLosses > 0 ? round(sumWins / sumLosses) : 0,
    expectancy: closedRows.length ? round(realizedPnL / closedRows.length) : 0,
    botRealizedPnL: round(closedRows.filter((row) => row.botOpened).reduce((sum, row) => sum + (row.profit ?? 0), 0)),
    manualRealizedPnL: round(closedRows.filter((row) => !row.botOpened).reduce((sum, row) => sum + (row.profit ?? 0), 0)),
    longRealizedPnL: round(closedRows.filter((row) => row.positionSide === 'Long').reduce((sum, row) => sum + (row.profit ?? 0), 0)),
    shortRealizedPnL: round(closedRows.filter((row) => row.positionSide === 'Short').reduce((sum, row) => sum + (row.profit ?? 0), 0))
  };
}

function buildBotManualBreakdown(closedRows: TransactionRecord[]): BotManualRow[] {
  return [
    { source: 'Bot' as const, rows: closedRows.filter((row) => row.botOpened) },
    { source: 'Manual' as const, rows: closedRows.filter((row) => !row.botOpened) }
  ].map(({ source, rows }) => {
    const summary = buildSummary(rows, []);

    return {
      source,
      trades: summary.totalClosedTrades,
      wins: summary.wins,
      losses: summary.losses,
      realizedPnL: summary.realizedPnL,
      winRate: summary.winRate,
      profitFactor: summary.profitFactor,
      expectancy: summary.expectancy
    };
  });
}

function buildEquityCurve(closedRows: TransactionRecord[]): EquityPoint[] {
  let cumulativePnL = 0;

  return toTimeBuckets(closedRows, 'daily').map((bucket) => {
    cumulativePnL = round(cumulativePnL + bucket.realizedPnL);

    return {
      date: bucket.bucket,
      dailyPnL: bucket.realizedPnL,
      cumulativePnL
    };
  });
}

function buildDrawdown(closedRows: TransactionRecord[]): DrawdownSummary {
  const equity = buildEquityCurve(closedRows);
  let peak = 0;
  let peakDate: string | null = null;
  let maxDrawdown = 0;
  let maxDrawdownStart: string | null = null;
  let maxDrawdownEnd: string | null = null;
  let currentDrawdown = 0;
  let currentWinStreak = 0;
  let currentLossStreak = 0;
  let bestWinningStreak = 0;
  let worstLosingStreak = 0;

  for (const point of equity) {
    if (point.cumulativePnL > peak) {
      peak = point.cumulativePnL;
      peakDate = point.date;
    }

    currentDrawdown = round(point.cumulativePnL - peak);
    if (currentDrawdown < maxDrawdown) {
      maxDrawdown = currentDrawdown;
      maxDrawdownStart = peakDate;
      maxDrawdownEnd = point.date;
    }

    if (point.dailyPnL >= 0) {
      currentWinStreak += 1;
      currentLossStreak = 0;
    } else {
      currentLossStreak += 1;
      currentWinStreak = 0;
    }

    bestWinningStreak = Math.max(bestWinningStreak, currentWinStreak);
    worstLosingStreak = Math.max(worstLosingStreak, currentLossStreak);
  }

  return {
    maxDrawdown: round(maxDrawdown),
    maxDrawdownStart,
    maxDrawdownEnd,
    currentDrawdown: round(currentDrawdown),
    bestWinningStreak,
    worstLosingStreak
  };
}

function buildCalendarHeatmap(closedRows: TransactionRecord[]): CalendarDay[] {
  return toTimeBuckets(closedRows, 'daily').map((bucket) => ({
    date: bucket.bucket,
    realizedPnL: bucket.realizedPnL,
    trades: bucket.trades
  }));
}

const dayLabels = ['', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function getIsoDay(dateString: string) {
  const day = new Date(`${dateString}T00:00:00Z`).getUTCDay();
  return day === 0 ? 7 : day;
}

function daysBetween(start: string, end: string) {
  const startDate = new Date(`${start}T00:00:00Z`);
  const endDate = new Date(`${end}T00:00:00Z`);
  return Math.max(0, Math.round((endDate.getTime() - startDate.getTime()) / 86400000));
}

function buildDayOfWeekBreakdown(closedRows: TransactionRecord[]): DayOfWeekBreakdownRow[] {
  const rows = new Map<number, DayOfWeekBreakdownRow>();

  for (let day = 1; day <= 7; day += 1) {
    rows.set(day, {
      day,
      label: dayLabels[day],
      trades: 0,
      wins: 0,
      losses: 0,
      winRate: 0,
      realizedPnL: 0
    });
  }

  for (const row of closedRows) {
    if (!row.closeDate) {
      continue;
    }

    const day = getIsoDay(row.closeDate);
    const current = rows.get(day);
    if (!current) {
      continue;
    }

    current.trades += 1;
    current.realizedPnL += row.profit ?? 0;
    if ((row.profit ?? 0) >= 0) {
      current.wins += 1;
    } else {
      current.losses += 1;
    }
  }

  return Array.from(rows.values()).map((row) => ({
    ...row,
    winRate: row.trades ? round((row.wins / row.trades) * 100) : 0,
    realizedPnL: round(row.realizedPnL)
  }));
}

function buildHoldingPeriodPoints(closedRows: TransactionRecord[]): HoldingPeriodPoint[] {
  return closedRows
    .filter((row) => row.closeDate && row.profit !== null)
    .map((row) => ({
      daysHeld: daysBetween(row.dateOpened, row.closeDate as string),
      profit: row.profit ?? 0,
      closeDate: row.closeDate as string,
      stock: row.stock,
      positionSide: row.positionSide,
      strategyType: row.strategyType,
      winLoss: row.winLoss
    }))
    .sort((a, b) => a.closeDate.localeCompare(b.closeDate));
}

function buildStreaks(closedRows: TransactionRecord[]): StreakSummary {
  const ordered = [...closedRows]
    .filter((row) => row.closeDate && row.profit !== null)
    .sort((a, b) => {
      const dateCompare = (a.closeDate ?? '').localeCompare(b.closeDate ?? '');
      return dateCompare || a.createdAt.localeCompare(b.createdAt);
    });
  let currentType: 'Win' | 'Loss' | 'None' = 'None';
  let currentLength = 0;
  let longestWin = 0;
  let longestLoss = 0;
  let winStreaks = 0;
  let lossStreaks = 0;
  let winStreakTotal = 0;
  let lossStreakTotal = 0;

  function flush() {
    if (currentLength === 0) {
      return;
    }

    if (currentType === 'Win') {
      winStreaks += 1;
      winStreakTotal += currentLength;
      longestWin = Math.max(longestWin, currentLength);
    } else if (currentType === 'Loss') {
      lossStreaks += 1;
      lossStreakTotal += currentLength;
      longestLoss = Math.max(longestLoss, currentLength);
    }
  }

  for (const row of ordered) {
    const nextType = (row.profit ?? 0) >= 0 ? 'Win' : 'Loss';
    if (nextType === currentType) {
      currentLength += 1;
    } else {
      flush();
      currentType = nextType;
      currentLength = 1;
    }
  }
  flush();

  return {
    currentType: ordered.length ? currentType : 'None',
    currentLength: ordered.length ? currentLength : 0,
    longestWin,
    longestLoss,
    averageWinStreak: winStreaks ? round(winStreakTotal / winStreaks) : 0,
    averageLossStreak: lossStreaks ? round(lossStreakTotal / lossStreaks) : 0
  };
}

function buildTradeExtremes(closedRows: TransactionRecord[], limit = 5): TradeExtremes {
  const ordered = [...closedRows].filter((row) => row.profit !== null);
  const totalPnL = round(ordered.reduce((sum, row) => sum + (row.profit ?? 0), 0));
  const sortedAscending = [...ordered].sort((a, b) => (a.profit ?? 0) - (b.profit ?? 0));
  const worstSum = sortedAscending.slice(0, limit).reduce((sum, row) => sum + (row.profit ?? 0), 0);
  const bestSum = sortedAscending.slice(-limit).reduce((sum, row) => sum + (row.profit ?? 0), 0);

  return {
    limit,
    totalPnL,
    tradeCount: ordered.length,
    withoutWorst: round(totalPnL - worstSum),
    withoutBest: round(totalPnL - bestSum),
    winners: [...ordered].sort((a, b) => (b.profit ?? 0) - (a.profit ?? 0)).slice(0, limit),
    losers: sortedAscending.slice(0, limit)
  };
}

function buildStrategyBreakdown(closedRows: TransactionRecord[]): StrategyBreakdownRow[] {
  const map = new Map<string, StrategyBreakdownRow>();

  for (const row of closedRows) {
    const key = `${row.positionSide}:${row.strategyType}`;
    const current = map.get(key) ?? {
      positionSide: row.positionSide,
      strategyType: row.strategyType,
      trades: 0,
      wins: 0,
      losses: 0,
      realizedPnL: 0
    };

    current.trades += 1;
    current.realizedPnL += row.profit ?? 0;
    if ((row.profit ?? 0) >= 0) {
      current.wins += 1;
    } else {
      current.losses += 1;
    }

    map.set(key, current);
  }

  return Array.from(map.values())
    .map((row) => ({ ...row, realizedPnL: round(row.realizedPnL) }))
    .sort((a, b) => b.realizedPnL - a.realizedPnL);
}

function buildStockBreakdown(closedRows: TransactionRecord[]): StockBreakdownRow[] {
  const map = new Map<string, StockBreakdownRow>();

  for (const row of closedRows) {
    const current = map.get(row.stock) ?? {
      stock: row.stock,
      trades: 0,
      realizedPnL: 0
    };

    current.trades += 1;
    current.realizedPnL += row.profit ?? 0;
    map.set(row.stock, current);
  }

  return Array.from(map.values())
    .map((row) => ({ ...row, realizedPnL: round(row.realizedPnL) }))
    .sort((a, b) => b.realizedPnL - a.realizedPnL);
}

async function listAnalyticsRows() {
  const result = await query<TransactionRow>(
    `
      SELECT
        id,
        import_batch_id,
        source_file_name,
        position_group,
        date_opened,
        expiration,
        close_date,
        stock,
        position_side,
        strategy_type,
        strikes,
        contracts,
        opening_price,
        closing_price,
        fees,
        profit,
        win_loss,
        broker,
        bot_opened,
        tags,
        review_notes,
        lesson_learned,
        exit_reason,
        profit_target,
        stop_loss,
        max_risk,
        notes,
        manually_edited,
        manually_edited_at,
        created_at,
        updated_at
      FROM transactions
      ORDER BY COALESCE(close_date, expiration, date_opened) DESC
    `
  );

  return result.rows.map(mapTransactionRow);
}

function applyFilters(rows: TransactionRecord[], filters: AnalyticsFilters) {
  return rows.filter((row) => {
    const reportingDate = row.closeDate ?? row.dateOpened;

    if (filters.dateFrom && reportingDate < filters.dateFrom) {
      return false;
    }

    if (filters.dateTo && reportingDate > filters.dateTo) {
      return false;
    }

    if (filters.stock && !row.stock.toLowerCase().includes(filters.stock.toLowerCase())) {
      return false;
    }

    if (filters.strategyType && !row.strategyType.toLowerCase().includes(filters.strategyType.toLowerCase())) {
      return false;
    }

    if (filters.positionSide && row.positionSide !== filters.positionSide) {
      return false;
    }

    if (filters.botOpened === 'bot' && !row.botOpened) {
      return false;
    }

    if (filters.botOpened === 'manual' && row.botOpened) {
      return false;
    }

    if (filters.status === 'open' && row.closeDate) {
      return false;
    }

    if (filters.status === 'closed' && !row.closeDate) {
      return false;
    }

    return true;
  });
}

export async function getAnalytics(filters: AnalyticsFilters = defaultAnalyticsFilters): Promise<AnalyticsResponse> {
  const rows = applyFilters(await listAnalyticsRows(), filters);
  const closedRows = rows.filter((row) => row.closeDate && row.profit !== null);
  const openRows = rows.filter((row) => !row.closeDate);

  return {
    summary: buildSummary(closedRows, openRows),
    filters,
    realizedViews: {
      daily: toTimeBuckets(closedRows, 'daily'),
      weekly: toTimeBuckets(closedRows, 'weekly'),
      monthly: toTimeBuckets(closedRows, 'monthly'),
      yearly: toTimeBuckets(closedRows, 'yearly')
    },
    equityCurve: buildEquityCurve(closedRows),
    drawdown: buildDrawdown(closedRows),
    calendarHeatmap: buildCalendarHeatmap(closedRows),
    dayOfWeekBreakdown: buildDayOfWeekBreakdown(closedRows),
    holdingPeriodPoints: buildHoldingPeriodPoints(closedRows),
    streaks: buildStreaks(closedRows),
    tradeExtremes: buildTradeExtremes(closedRows),
    botManualBreakdown: buildBotManualBreakdown(closedRows),
    strategyBreakdown: buildStrategyBreakdown(closedRows),
    stockBreakdown: buildStockBreakdown(closedRows),
    openPositions: openRows
  };
}

export async function getStockAnalytics(stock: string): Promise<StockAnalyticsResponse | null> {
  const normalizedStock = stock.trim().toUpperCase();
  const rows = (await listAnalyticsRows()).filter((row) => row.stock.toUpperCase() === normalizedStock);

  if (rows.length === 0) {
    return null;
  }

  const closedRows = rows.filter((row) => row.closeDate && row.profit !== null);
  const openRows = rows.filter((row) => !row.closeDate);

  return {
    stock: rows[0].stock,
    summary: buildSummary(closedRows, openRows),
    dailyPnL: toTimeBuckets(closedRows, 'daily'),
    equityCurve: buildEquityCurve(closedRows),
    drawdown: buildDrawdown(closedRows),
    strategyBreakdown: buildStrategyBreakdown(closedRows),
    trades: rows
  };
}

export async function getStrategyAnalytics(
  positionSide: string,
  strategyType: string
): Promise<StrategyAnalyticsResponse | null> {
  const normalizedSide = positionSide.trim();
  const normalizedStrategy = strategyType.trim().toLowerCase();
  const rows = (await listAnalyticsRows()).filter(
    (row) => row.positionSide === normalizedSide && row.strategyType.toLowerCase() === normalizedStrategy
  );

  if (rows.length === 0 || (normalizedSide !== 'Long' && normalizedSide !== 'Short')) {
    return null;
  }

  const closedRows = rows.filter((row) => row.closeDate && row.profit !== null);
  const openRows = rows.filter((row) => !row.closeDate);

  return {
    positionSide: normalizedSide,
    strategyType: rows[0].strategyType,
    summary: buildSummary(closedRows, openRows),
    dailyPnL: toTimeBuckets(closedRows, 'daily'),
    equityCurve: buildEquityCurve(closedRows),
    drawdown: buildDrawdown(closedRows),
    stockBreakdown: buildStockBreakdown(closedRows),
    trades: rows
  };
}
