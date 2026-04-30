import type {
  StockBreakdownRow,
  StrategyBreakdownRow,
  SummaryMetric,
  TransactionRecord
} from '@trade-journal/shared';

function round(value: number) {
  return Number(value.toFixed(2));
}

export function buildSummary(closedRows: TransactionRecord[], openRows: TransactionRecord[]): SummaryMetric {
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

export function buildStrategyBreakdown(closedRows: TransactionRecord[]): StrategyBreakdownRow[] {
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

export function buildStockBreakdown(closedRows: TransactionRecord[]): StockBreakdownRow[] {
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
