import type {
  ImportBatchRecord,
  ImportBatchReviewResponse,
  ImportReconciliationResponse,
  NamedPerformanceRow,
  TransactionRecord
} from '@trade-journal/shared';

import { query } from './db.js';
import { buildStockBreakdown, buildStrategyBreakdown, buildSummary } from './summary.js';
import { mapTransactionRow, type TransactionRow } from './transaction-row.js';

interface ImportBatchRow {
  id: string;
  source_file_name: string;
  imported_at: string | Date;
  row_count: number;
  error_count: number;
  imported_count: number;
  updated_count: number;
  skipped_duplicate_count: number;
}

function toTimestamp(value: string | Date) {
  return value instanceof Date ? value.toISOString() : value;
}

export async function listImportBatches(): Promise<ImportBatchRecord[]> {
  const result = await query<ImportBatchRow>(
    `
      SELECT id, source_file_name, imported_at, row_count, error_count
      FROM import_batches
      ORDER BY imported_at DESC
    `
  );

  return result.rows.map((row) => ({
    id: row.id,
      sourceFileName: row.source_file_name,
      importedAt: toTimestamp(row.imported_at),
      rowCount: Number(row.row_count),
      errorCount: Number(row.error_count),
      importedCount: Number(row.imported_count ?? 0),
      updatedCount: Number(row.updated_count ?? 0),
      skippedDuplicateCount: Number(row.skipped_duplicate_count ?? 0)
  }));
}

const transactionSelect = `
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
    mistake_tags,
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
`;

function round(value: number) {
  return Number(value.toFixed(2));
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

function groupedPerformanceRows(rows: TransactionRecord[], getLabel: (row: TransactionRecord) => string) {
  const groups = new Map<string, TransactionRecord[]>();

  for (const row of rows) {
    const label = getLabel(row);
    groups.set(label, [...(groups.get(label) ?? []), row]);
  }

  return [...groups.entries()].map(([label, groupRows]) => summarizeNamedGroup(label, groupRows)).sort((a, b) => b.realizedPnL - a.realizedPnL);
}

export async function getImportBatchReview(batchId: string): Promise<ImportBatchReviewResponse | null> {
  const [batchResult, transactionResult] = await Promise.all([
    query<ImportBatchRow>('SELECT * FROM import_batches WHERE id = $1', [batchId]),
    query<TransactionRow>(`${transactionSelect} WHERE import_batch_id = $1 ORDER BY COALESCE(close_date, expiration, date_opened) DESC`, [
      batchId
    ])
  ]);

  if (!batchResult.rows[0]) {
    return null;
  }

  const trades = transactionResult.rows.map(mapTransactionRow);
  const closedRows = trades.filter((row) => row.closeDate && row.profit !== null);
  const openRows = trades.filter((row) => !row.closeDate);

  return {
    batch: {
      id: batchResult.rows[0].id,
      sourceFileName: batchResult.rows[0].source_file_name,
      importedAt: toTimestamp(batchResult.rows[0].imported_at),
      rowCount: Number(batchResult.rows[0].row_count),
      errorCount: Number(batchResult.rows[0].error_count),
      importedCount: Number(batchResult.rows[0].imported_count ?? 0),
      updatedCount: Number(batchResult.rows[0].updated_count ?? 0),
      skippedDuplicateCount: Number(batchResult.rows[0].skipped_duplicate_count ?? 0)
    },
    summary: buildSummary(closedRows, openRows),
    brokerBreakdown: groupedPerformanceRows(closedRows, (row) => row.broker ?? 'Unknown broker'),
    strategyBreakdown: buildStrategyBreakdown(closedRows),
    stockBreakdown: buildStockBreakdown(closedRows),
    trades
  };
}

export async function getImportReconciliation(): Promise<ImportReconciliationResponse> {
  const [batchResult, transactionResult] = await Promise.all([
    query<ImportBatchRow>('SELECT * FROM import_batches ORDER BY imported_at ASC'),
    query<TransactionRow>(`${transactionSelect} ORDER BY source_file_name ASC, broker ASC, close_date ASC`)
  ]);

  const batchGroups = new Map<string, ImportBatchRow[]>();
  for (const batch of batchResult.rows) {
    batchGroups.set(batch.source_file_name, [...(batchGroups.get(batch.source_file_name) ?? []), batch]);
  }

  const tradeGroups = new Map<string, TransactionRecord[]>();
  for (const row of transactionResult.rows.map(mapTransactionRow)) {
    const key = `${row.sourceFileName ?? 'Manual'}|${row.broker ?? 'Unknown broker'}`;
    tradeGroups.set(key, [...(tradeGroups.get(key) ?? []), row]);
  }

  const rows = [...tradeGroups.entries()].map(([key, trades]) => {
    const [sourceFileName, broker] = key.split('|');
    const batches = batchGroups.get(sourceFileName) ?? [];
    const closedTrades = trades.filter((trade) => trade.closeDate && trade.profit !== null);

    return {
      sourceFileName,
      broker,
      batches: batches.length,
      importedRows: batches.reduce((sum, batch) => sum + Number(batch.imported_count ?? 0), 0),
      updatedRows: batches.reduce((sum, batch) => sum + Number(batch.updated_count ?? 0), 0),
      skippedDuplicateRows: batches.reduce((sum, batch) => sum + Number(batch.skipped_duplicate_count ?? 0), 0),
      errorRows: batches.reduce((sum, batch) => sum + Number(batch.error_count ?? 0), 0),
      tradeCount: trades.length,
      closedTrades: closedTrades.length,
      openTrades: trades.length - closedTrades.length,
      realizedPnL: round(closedTrades.reduce((sum, trade) => sum + (trade.profit ?? 0), 0)),
      fees: round(closedTrades.reduce((sum, trade) => sum + Math.abs(trade.fees), 0)),
      firstImportedAt: batches[0] ? toTimestamp(batches[0].imported_at) : null,
      lastImportedAt: batches[batches.length - 1] ? toTimestamp(batches[batches.length - 1].imported_at) : null
    };
  });

  return {
    rows: rows.sort((a, b) => b.realizedPnL - a.realizedPnL)
  };
}
