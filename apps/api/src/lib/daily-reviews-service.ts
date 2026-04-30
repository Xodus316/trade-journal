import type { DailyReview, DailyReviewInput, DailyReviewResponse } from '@trade-journal/shared';

import { query } from './db.js';
import { buildStockBreakdown, buildStrategyBreakdown, buildSummary } from './summary.js';
import { mapTransactionRow, type TransactionRow } from './transaction-row.js';

interface DailyReviewRow {
  review_date: string | Date;
  notes: string | null;
  chart_image_data_url: string | null;
  created_at: string | Date;
  updated_at: string | Date;
}

function toDateString(value: string | Date) {
  return value instanceof Date ? value.toISOString().slice(0, 10) : value;
}

function toTimestamp(value: string | Date) {
  return value instanceof Date ? value.toISOString() : value;
}

function mapDailyReviewRow(row: DailyReviewRow): DailyReview {
  return {
    reviewDate: toDateString(row.review_date),
    notes: row.notes,
    chartImageDataUrl: row.chart_image_data_url,
    createdAt: toTimestamp(row.created_at),
    updatedAt: toTimestamp(row.updated_at)
  };
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

export async function getDailyReview(reviewDate: string): Promise<DailyReviewResponse> {
  const [reviewResult, tradeResult] = await Promise.all([
    query<DailyReviewRow>('SELECT * FROM daily_reviews WHERE review_date = $1', [reviewDate]),
    query<TransactionRow>(
      `${transactionSelect} WHERE close_date = $1 ORDER BY stock ASC, strategy_type ASC, created_at ASC`,
      [reviewDate]
    )
  ]);

  const trades = tradeResult.rows.map(mapTransactionRow);
  const closedRows = trades.filter((row) => row.closeDate && row.profit !== null);

  return {
    review: reviewResult.rows[0] ? mapDailyReviewRow(reviewResult.rows[0]) : null,
    summary: buildSummary(closedRows, []),
    strategyBreakdown: buildStrategyBreakdown(closedRows),
    stockBreakdown: buildStockBreakdown(closedRows),
    trades
  };
}

export async function saveDailyReview(reviewDate: string, input: DailyReviewInput): Promise<DailyReview> {
  const result = await query<DailyReviewRow>(
    `
      INSERT INTO daily_reviews (review_date, notes, chart_image_data_url)
      VALUES ($1, $2, $3)
      ON CONFLICT (review_date)
      DO UPDATE SET
        notes = EXCLUDED.notes,
        chart_image_data_url = EXCLUDED.chart_image_data_url,
        updated_at = NOW()
      RETURNING *
    `,
    [reviewDate, input.notes, input.chartImageDataUrl]
  );

  return mapDailyReviewRow(result.rows[0]);
}
