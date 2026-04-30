import type { PositionGroupDetail, PositionGroupRow, SummaryMetric, TransactionRecord } from '@trade-journal/shared';

import { listTransactions } from './transactions-service.js';

function round(value: number) {
  return Number(value.toFixed(2));
}

function groupKeyForTrade(trade: TransactionRecord) {
  return (
    trade.positionGroup ??
    [trade.stock, trade.positionSide, trade.strategyType, trade.expiration ?? 'no-expiration', trade.strikes ?? 'no-strikes'].join('|')
  );
}

function groupLabelForTrade(trade: TransactionRecord) {
  return trade.positionGroup ?? `${trade.stock} ${trade.positionSide} ${trade.strategyType}`;
}

function buildSummary(rows: TransactionRecord[]): SummaryMetric {
  const closedRows = rows.filter((row) => row.closeDate && row.profit !== null);
  const openRows = rows.filter((row) => !row.closeDate);
  const winners = closedRows.filter((row) => (row.profit ?? 0) >= 0);
  const losers = closedRows.filter((row) => (row.profit ?? 0) < 0);
  const sumWins = winners.reduce((sum, row) => sum + (row.profit ?? 0), 0);
  const sumLosses = losers.reduce((sum, row) => sum + Math.abs(row.profit ?? 0), 0);
  const realizedPnL = round(closedRows.reduce((sum, row) => sum + (row.profit ?? 0), 0));

  return {
    realizedPnL,
    totalFees: round(closedRows.reduce((sum, row) => sum + Math.abs(row.fees), 0)),
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

function toGroupRow(groupKey: string, rows: TransactionRecord[]): PositionGroupRow {
  const sorted = [...rows].sort((a, b) => a.dateOpened.localeCompare(b.dateOpened));
  const first = sorted[0];
  const closedRows = rows.filter((row) => row.closeDate && row.profit !== null);
  const closeDates = closedRows.map((row) => row.closeDate as string).sort();
  const tags = Array.from(new Set(rows.flatMap((row) => row.tags))).sort();

  return {
    groupKey,
    label: groupLabelForTrade(first),
    stock: first.stock,
    positionSide: first.positionSide,
    strategyType: first.strategyType,
    openedAt: sorted[0].dateOpened,
    closedAt: rows.some((row) => !row.closeDate) ? null : closeDates.at(-1) ?? null,
    trades: rows.length,
    realizedPnL: round(closedRows.reduce((sum, row) => sum + (row.profit ?? 0), 0)),
    totalFees: round(closedRows.reduce((sum, row) => sum + Math.abs(row.fees), 0)),
    tags,
    isOpen: rows.some((row) => !row.closeDate)
  };
}

export async function listPositionGroups() {
  const transactions = (await listTransactions()).items;
  const groups = new Map<string, TransactionRecord[]>();

  for (const trade of transactions) {
    const groupKey = groupKeyForTrade(trade);
    groups.set(groupKey, [...(groups.get(groupKey) ?? []), trade]);
  }

  return Array.from(groups.entries())
    .map(([groupKey, rows]) => toGroupRow(groupKey, rows))
    .sort((a, b) => b.openedAt.localeCompare(a.openedAt));
}

export async function getPositionGroup(groupKey: string): Promise<PositionGroupDetail | null> {
  const transactions = (await listTransactions()).items;
  const lifecycle = transactions
    .filter((trade) => groupKeyForTrade(trade) === groupKey)
    .sort((a, b) => a.dateOpened.localeCompare(b.dateOpened));

  if (lifecycle.length === 0) {
    return null;
  }

  return {
    ...toGroupRow(groupKey, lifecycle),
    summary: buildSummary(lifecycle),
    lifecycle
  };
}
