import type {
  AnalyticsFilters,
  AnalyticsResponse,
  BrokerAnalyticsResponse,
  BotManualRow,
  CalendarDay,
  ConsistencyScore,
  DayOfWeekBreakdownRow,
  DrawdownPoint,
  DrawdownSummary,
  EquityPoint,
  HoldingPeriodPoint,
  MonthlyPace,
  NamedPerformanceRow,
  OptionAnalytics,
  PositionSizingRow,
  RealizedTimeframe,
  ReviewAnalytics,
  RiskSimulator,
  RollingExpectancyPoint,
  SetupCombinationRow,
  StreakSummary,
  StockAnalyticsResponse,
  StockBreakdownRow,
  StrategyAnalyticsResponse,
  StrategyBreakdownRow,
  StrategyDecayRow,
  SummaryMetric,
  TimeBucket,
  TradeExtremes,
  TransactionRecord,
  UnsupportedAnalysis,
  WhatIfScenario
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

function summarizeNamedGroup(label: string, rows: TransactionRecord[]): NamedPerformanceRow {
  const winners = rows.filter((row) => (row.profit ?? 0) >= 0);
  const losers = rows.filter((row) => (row.profit ?? 0) < 0);
  const sumWins = winners.reduce((sum, row) => sum + (row.profit ?? 0), 0);
  const sumLosses = Math.abs(losers.reduce((sum, row) => sum + (row.profit ?? 0), 0));
  const realizedPnL = rows.reduce((sum, row) => sum + (row.profit ?? 0), 0);

  return {
    label,
    trades: rows.length,
    wins: winners.length,
    losses: losers.length,
    winRate: rows.length ? round((winners.length / rows.length) * 100) : 0,
    realizedPnL: round(realizedPnL),
    expectancy: rows.length ? round(realizedPnL / rows.length) : 0,
    profitFactor: sumLosses > 0 ? round(sumWins / sumLosses) : 0
  };
}

function groupedPerformanceRows(
  closedRows: TransactionRecord[],
  getLabel: (row: TransactionRecord) => string | null,
  minimumTrades = 1
) {
  const groups = new Map<string, TransactionRecord[]>();

  for (const row of closedRows) {
    const label = getLabel(row);
    if (!label) {
      continue;
    }

    groups.set(label, [...(groups.get(label) ?? []), row]);
  }

  return [...groups.entries()]
    .map(([label, rows]) => summarizeNamedGroup(label, rows))
    .filter((row) => row.trades >= minimumTrades)
    .sort((a, b) => b.realizedPnL - a.realizedPnL);
}

function getDte(row: TransactionRecord) {
  if (!row.expiration) {
    return null;
  }

  return daysBetween(row.dateOpened, row.expiration);
}

function getDteBucket(row: TransactionRecord) {
  const dte = getDte(row);
  if (dte === null) {
    return null;
  }

  if (dte === 0) {
    return '0DTE';
  }

  if (dte <= 7) {
    return '1-7 DTE';
  }

  if (dte <= 30) {
    return '8-30 DTE';
  }

  return '31+ DTE';
}

function parseStrikeNumbers(strikes: string | null) {
  if (!strikes) {
    return [];
  }

  return strikes
    .split('/')
    .map((strike) => Number(strike.replace(/[cp]/gi, '').trim()))
    .filter((strike) => Number.isFinite(strike));
}

function getSpreadWidth(row: TransactionRecord) {
  const strikes = parseStrikeNumbers(row.strikes);
  if (strikes.length < 2) {
    return null;
  }

  return round(Math.max(...strikes) - Math.min(...strikes));
}

function getLegCount(row: TransactionRecord) {
  if (!row.strikes) {
    return null;
  }

  return row.strikes.split('/').filter((strike) => strike.trim()).length;
}

function buildOptionAnalytics(closedRows: TransactionRecord[]): OptionAnalytics {
  const optionRows = closedRows.filter((row) => row.expiration || row.strikes);

  return {
    dteBreakdown: groupedPerformanceRows(optionRows, getDteBucket),
    expirationWeekdayBreakdown: groupedPerformanceRows(optionRows, (row) =>
      row.expiration ? dayLabels[getIsoDay(row.expiration)] : null
    ),
    spreadWidthBreakdown: groupedPerformanceRows(optionRows, (row) => {
      const width = getSpreadWidth(row);
      return width === null ? null : `${width}-wide`;
    }),
    creditDebitBreakdown: groupedPerformanceRows(optionRows, (row) => {
      if (row.openingPrice === null) {
        return 'Unknown open price';
      }

      return row.openingPrice >= 0 ? 'Credit opened' : 'Debit opened';
    }),
    legCountBreakdown: groupedPerformanceRows(optionRows, (row) => {
      const legs = getLegCount(row);
      return legs === null ? null : `${legs} leg${legs === 1 ? '' : 's'}`;
    })
  };
}

function buildRollingExpectancy(closedRows: TransactionRecord[]): RollingExpectancyPoint[] {
  const ordered = [...closedRows]
    .filter((row) => row.closeDate && row.profit !== null)
    .sort((a, b) => {
      const dateCompare = (a.closeDate ?? '').localeCompare(b.closeDate ?? '');
      return dateCompare || a.createdAt.localeCompare(b.createdAt);
    });

  function windowExpectancy(index: number, size: number) {
    const start = index - size + 1;
    if (start < 0) {
      return null;
    }

    const window = ordered.slice(start, index + 1);
    return round(window.reduce((sum, row) => sum + (row.profit ?? 0), 0) / window.length);
  }

  return ordered.map((row, index) => ({
    date: row.closeDate as string,
    tradeNumber: index + 1,
    expectancy20: windowExpectancy(index, 20),
    expectancy50: windowExpectancy(index, 50),
    expectancy100: windowExpectancy(index, 100)
  }));
}

function buildStrategyDecay(closedRows: TransactionRecord[], windowSize = 30): StrategyDecayRow[] {
  const groups = new Map<string, TransactionRecord[]>();

  for (const row of closedRows) {
    const key = `${row.positionSide}:${row.strategyType}`;
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }

  return [...groups.values()]
    .map((rows) => {
      const ordered = [...rows].sort((a, b) => (a.closeDate ?? '').localeCompare(b.closeDate ?? ''));
      const recent = ordered.slice(-windowSize);
      const prior = ordered.slice(Math.max(0, ordered.length - windowSize * 2), Math.max(0, ordered.length - windowSize));
      const recentExpectancy = recent.length ? round(recent.reduce((sum, row) => sum + (row.profit ?? 0), 0) / recent.length) : 0;
      const priorExpectancy = prior.length ? round(prior.reduce((sum, row) => sum + (row.profit ?? 0), 0) / prior.length) : 0;
      const delta = round(recentExpectancy - priorExpectancy);
      const first = ordered[0];

      return {
        positionSide: first.positionSide,
        strategyType: first.strategyType,
        trades: ordered.length,
        recentTrades: recent.length,
        priorTrades: prior.length,
        recentExpectancy,
        priorExpectancy,
        delta,
        trend: prior.length === 0 ? 'New' : Math.abs(delta) < 10 ? 'Flat' : delta > 0 ? 'Improving' : 'Declining'
      } satisfies StrategyDecayRow;
    })
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
}

function buildBestSetupCombinations(closedRows: TransactionRecord[]): SetupCombinationRow[] {
  const groups = new Map<string, TransactionRecord[]>();

  for (const row of closedRows) {
    const dteBucket = getDteBucket(row) ?? 'No expiration';
    const source = row.botOpened ? 'Bot' : 'Manual';
    const key = `${row.stock}|${row.positionSide}|${row.strategyType}|${dteBucket}|${source}`;
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }

  return [...groups.entries()]
    .map(([key, rows]) => {
      const [stock, positionSide, strategyType, dteBucket, source] = key.split('|');
      return {
        ...summarizeNamedGroup(key, rows),
        stock,
        positionSide: positionSide as 'Long' | 'Short',
        strategyType,
        dteBucket,
        source: source as 'Bot' | 'Manual'
      };
    })
    .filter((row) => row.trades >= 3)
    .sort((a, b) => b.expectancy - a.expectancy)
    .slice(0, 20);
}

function buildPositionSizing(closedRows: TransactionRecord[]): PositionSizingRow[] {
  const rows = groupedPerformanceRows(closedRows, (row) => {
    if (row.contracts <= 1) {
      return '1 contract/share lot';
    }

    if (row.contracts <= 3) {
      return '2-3 contracts/shares';
    }

    if (row.contracts <= 10) {
      return '4-10 contracts/shares';
    }

    return '11+ contracts/shares';
  });

  return rows.map((row) => {
    const sourceRows = closedRows.filter((trade) => {
      if (row.label === '1 contract/share lot') return trade.contracts <= 1;
      if (row.label === '2-3 contracts/shares') return trade.contracts > 1 && trade.contracts <= 3;
      if (row.label === '4-10 contracts/shares') return trade.contracts > 3 && trade.contracts <= 10;
      return trade.contracts > 10;
    });

    return {
      ...row,
      averageContracts: round(sourceRows.reduce((sum, trade) => sum + trade.contracts, 0) / sourceRows.length),
      averageOpeningNotional: round(
        sourceRows.reduce((sum, trade) => sum + Math.abs(trade.openingPrice ?? 0), 0) / sourceRows.length
      )
    };
  });
}

function buildDrawdownCurve(closedRows: TransactionRecord[]): DrawdownPoint[] {
  let peak = 0;
  return buildEquityCurve(closedRows).map((point) => {
    peak = Math.max(peak, point.cumulativePnL);
    return {
      date: point.date,
      drawdown: round(point.cumulativePnL - peak)
    };
  });
}

function buildConsistency(closedRows: TransactionRecord[], summary: SummaryMetric, drawdown: DrawdownSummary): ConsistencyScore {
  const profits = closedRows.map((row) => row.profit ?? 0);
  const average = profits.length ? profits.reduce((sum, profit) => sum + profit, 0) / profits.length : 0;
  const variance = profits.length ? profits.reduce((sum, profit) => sum + (profit - average) ** 2, 0) / profits.length : 0;
  const returnVolatility = round(Math.sqrt(variance));
  const winRateScore = Math.min(100, Math.max(0, summary.winRate));
  const expectancyScore = Math.min(100, Math.max(0, 50 + summary.expectancy / 10));
  const profitFactorScore = Math.min(100, Math.max(0, summary.profitFactor * 35));
  const drawdownRatio = Math.abs(drawdown.maxDrawdown) / Math.max(Math.abs(summary.realizedPnL), 1);
  const drawdownScore = Math.min(100, Math.max(0, 100 - drawdownRatio * 60));
  const score = round(winRateScore * 0.25 + expectancyScore * 0.3 + profitFactorScore * 0.25 + drawdownScore * 0.2);

  return {
    score,
    winRateScore: round(winRateScore),
    expectancyScore: round(expectancyScore),
    drawdownScore: round(drawdownScore),
    profitFactorScore: round(profitFactorScore),
    returnVolatility
  };
}

function buildRiskSimulator(summary: SummaryMetric): RiskSimulator {
  const winRate = summary.totalClosedTrades ? summary.winRate / 100 : 0;
  const lossRate = Math.max(0, 1 - winRate);
  const averageWin = summary.averageWinner;
  const averageLoss = Math.abs(summary.averageLoser);
  const breakevenWinRate = averageWin + averageLoss > 0 ? round((averageLoss / (averageWin + averageLoss)) * 100) : 0;

  return {
    winRate: summary.winRate,
    averageWin,
    averageLoss,
    breakevenWinRate,
    probabilityThreeLosses: round(lossRate ** 3 * 100),
    probabilityFiveLosses: round(lossRate ** 5 * 100),
    probabilityTenLosses: round(lossRate ** 10 * 100),
    expectedTenTradePnL: round(summary.expectancy * 10),
    expectedTwentyTradePnL: round(summary.expectancy * 20),
    expectedFiftyTradePnL: round(summary.expectancy * 50)
  };
}

function buildMonthlyPace(closedRows: TransactionRecord[]): MonthlyPace {
  const latestCloseDate = closedRows.reduce<string | null>((latest, row) => {
    if (!row.closeDate) return latest;
    return !latest || row.closeDate > latest ? row.closeDate : latest;
  }, null);

  if (!latestCloseDate) {
    return { month: null, elapsedTradingDays: 0, currentPnL: 0, averageDailyPnL: 0, projectedMonthlyPnL: 0 };
  }

  const month = latestCloseDate.slice(0, 7);
  const monthRows = closedRows.filter((row) => row.closeDate?.startsWith(month));
  const currentPnL = round(monthRows.reduce((sum, row) => sum + (row.profit ?? 0), 0));
  const tradingDays = new Set(monthRows.map((row) => row.closeDate as string));
  const elapsedTradingDays = tradingDays.size;
  const averageDailyPnL = elapsedTradingDays ? round(currentPnL / elapsedTradingDays) : 0;

  return {
    month,
    elapsedTradingDays,
    currentPnL,
    averageDailyPnL,
    projectedMonthlyPnL: round(averageDailyPnL * 21)
  };
}

function buildWhatIfScenarios(closedRows: TransactionRecord[]): WhatIfScenario[] {
  const totalPnL = closedRows.reduce((sum, row) => sum + (row.profit ?? 0), 0);
  const strategies = buildStrategyBreakdown(closedRows).slice(-8);
  const stocks = buildStockBreakdown(closedRows).slice(-5);

  const strategyScenarios = strategies.map((row) => {
    const removedPnL = closedRows
      .filter((trade) => trade.positionSide === row.positionSide && trade.strategyType === row.strategyType)
      .reduce((sum, trade) => sum + (trade.profit ?? 0), 0);
    const nextPnL = round(totalPnL - removedPnL);

    return {
      label: `Skip ${row.positionSide} ${row.strategyType}`,
      tradesRemoved: row.trades,
      realizedPnL: nextPnL,
      delta: round(nextPnL - totalPnL)
    };
  });

  const stockScenarios = stocks.map((row) => {
    const removedPnL = closedRows.filter((trade) => trade.stock === row.stock).reduce((sum, trade) => sum + (trade.profit ?? 0), 0);
    const nextPnL = round(totalPnL - removedPnL);

    return {
      label: `Skip ${row.stock}`,
      tradesRemoved: row.trades,
      realizedPnL: nextPnL,
      delta: round(nextPnL - totalPnL)
    };
  });

  return [...strategyScenarios, ...stockScenarios].sort((a, b) => b.delta - a.delta).slice(0, 12);
}

function keywordFromText(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .split(/\s+/)
    .filter((word) => word.length >= 4 && !['trade', 'trades', 'this', 'that', 'with', 'from', 'because'].includes(word))[0];
}

function buildReviewAnalytics(closedRows: TransactionRecord[]): ReviewAnalytics {
  const reviewedTrades = closedRows.filter((row) => row.reviewNotes || row.lessonLearned || row.exitReason || row.tags.length > 0);
  const tagRows = closedRows.flatMap((row) => row.tags.map((tag) => ({ ...row, stock: tag })));
  const lessonGroups = new Map<string, TransactionRecord[]>();

  for (const row of closedRows) {
    const keyword = keywordFromText(row.lessonLearned ?? '');
    if (keyword) {
      lessonGroups.set(keyword, [...(lessonGroups.get(keyword) ?? []), row]);
    }
  }

  return {
    totalClosedTrades: closedRows.length,
    reviewedTrades: reviewedTrades.length,
    reviewCompletionRate: closedRows.length ? round((reviewedTrades.length / closedRows.length) * 100) : 0,
    missingReviewTrades: closedRows.length - reviewedTrades.length,
    tagBreakdown: groupedPerformanceRows(tagRows, (row) => row.stock),
    exitReasonBreakdown: groupedPerformanceRows(closedRows, (row) => row.exitReason),
    lessonKeywordBreakdown: [...lessonGroups.entries()]
      .map(([label, rows]) => summarizeNamedGroup(label, rows))
      .sort((a, b) => b.trades - a.trades)
      .slice(0, 12),
    missingChartOrReviewNote: closedRows.filter((row) => !row.reviewNotes).length
  };
}

function buildUnsupportedAnalyses(): UnsupportedAnalysis[] {
  return [
    {
      label: 'MAE/MFE and entry/exit efficiency versus intraday range',
      reason: 'The app does not currently store intraday high/low marks, quotes, or chart-derived excursion data.'
    },
    {
      label: 'Time-of-day performance',
      reason: 'Current transaction dates do not include execution timestamps.'
    },
    {
      label: 'Market regime and volatility regime performance',
      reason: 'The app does not currently ingest market index trend, VIX, IV rank, or realized volatility series.'
    },
    {
      label: 'Formal monthly goal tracking',
      reason: 'No monthly P&L target setting exists yet, so the dashboard shows monthly pace and projection instead.'
    }
  ];
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
  const summary = buildSummary(closedRows, openRows);
  const drawdown = buildDrawdown(closedRows);

  return {
    summary,
    filters,
    realizedViews: {
      daily: toTimeBuckets(closedRows, 'daily'),
      weekly: toTimeBuckets(closedRows, 'weekly'),
      monthly: toTimeBuckets(closedRows, 'monthly'),
      yearly: toTimeBuckets(closedRows, 'yearly')
    },
    equityCurve: buildEquityCurve(closedRows),
    drawdown,
    calendarHeatmap: buildCalendarHeatmap(closedRows),
    dayOfWeekBreakdown: buildDayOfWeekBreakdown(closedRows),
    holdingPeriodPoints: buildHoldingPeriodPoints(closedRows),
    streaks: buildStreaks(closedRows),
    tradeExtremes: buildTradeExtremes(closedRows),
    rollingExpectancy: buildRollingExpectancy(closedRows),
    strategyDecay: buildStrategyDecay(closedRows),
    bestSetupCombinations: buildBestSetupCombinations(closedRows),
    optionAnalytics: buildOptionAnalytics(closedRows),
    positionSizing: buildPositionSizing(closedRows),
    consistency: buildConsistency(closedRows, summary, drawdown),
    riskSimulator: buildRiskSimulator(summary),
    drawdownCurve: buildDrawdownCurve(closedRows),
    monthlyPace: buildMonthlyPace(closedRows),
    whatIfScenarios: buildWhatIfScenarios(closedRows),
    reviewAnalytics: buildReviewAnalytics(closedRows),
    unsupportedAnalyses: buildUnsupportedAnalyses(),
    botManualBreakdown: buildBotManualBreakdown(closedRows),
    brokerBreakdown: groupedPerformanceRows(closedRows, (row) => row.broker ?? 'Unknown broker'),
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

export async function getBrokerAnalytics(broker: string): Promise<BrokerAnalyticsResponse | null> {
  const normalizedBroker = broker.trim().toLowerCase();
  const rows = (await listAnalyticsRows()).filter((row) => (row.broker ?? 'Unknown broker').toLowerCase() === normalizedBroker);

  if (rows.length === 0) {
    return null;
  }

  const closedRows = rows.filter((row) => row.closeDate && row.profit !== null);
  const openRows = rows.filter((row) => !row.closeDate);

  return {
    broker: rows[0].broker ?? 'Unknown broker',
    summary: buildSummary(closedRows, openRows),
    dailyPnL: toTimeBuckets(closedRows, 'daily'),
    equityCurve: buildEquityCurve(closedRows),
    drawdown: buildDrawdown(closedRows),
    strategyBreakdown: buildStrategyBreakdown(closedRows),
    stockBreakdown: buildStockBreakdown(closedRows),
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
