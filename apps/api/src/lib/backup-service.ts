import type {
  BackupPayload,
  BackupRestoreResult,
  BackupTransactionRecord,
  DailyReview,
  ImportBatchRecord
} from '@trade-journal/shared';

import { getPool, query } from './db.js';
import { mapTransactionRow, type TransactionRow } from './transaction-row.js';

interface ImportBatchRow {
  id: string;
  source_file_name: string;
  imported_at: string | Date;
  row_count: number;
  error_count: number;
}

interface DailyReviewRow {
  review_date: string | Date;
  notes: string | null;
  chart_image_data_url: string | null;
  created_at: string | Date;
  updated_at: string | Date;
}

type BackupTransactionRow = TransactionRow & {
  source_row_hash: string;
  original_row_json: unknown;
};

function toDateString(value: string | Date | null) {
  if (value === null) {
    return null;
  }

  return value instanceof Date ? value.toISOString().slice(0, 10) : value;
}

function toTimestamp(value: string | Date) {
  return value instanceof Date ? value.toISOString() : value;
}

function mapImportBatch(row: ImportBatchRow): ImportBatchRecord {
  return {
    id: row.id,
    sourceFileName: row.source_file_name,
    importedAt: toTimestamp(row.imported_at),
    rowCount: Number(row.row_count),
    errorCount: Number(row.error_count)
  };
}

function mapDailyReview(row: DailyReviewRow): DailyReview {
  return {
    reviewDate: toDateString(row.review_date) as string,
    notes: row.notes,
    chartImageDataUrl: row.chart_image_data_url,
    createdAt: toTimestamp(row.created_at),
    updatedAt: toTimestamp(row.updated_at)
  };
}

function mapBackupTransaction(row: BackupTransactionRow): BackupTransactionRecord {
  return {
    ...mapTransactionRow(row),
    sourceRowHash: row.source_row_hash,
    originalRowJson: row.original_row_json
  };
}

export async function exportBackup(): Promise<BackupPayload> {
  const [batchResult, transactionResult, reviewResult] = await Promise.all([
    query<ImportBatchRow>('SELECT * FROM import_batches ORDER BY imported_at ASC'),
    query<BackupTransactionRow>(
      `
        SELECT
          id,
          import_batch_id,
          source_row_hash,
          source_file_name,
          original_row_json,
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
        ORDER BY created_at ASC
      `
    ),
    query<DailyReviewRow>('SELECT * FROM daily_reviews ORDER BY review_date ASC')
  ]);

  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    importBatches: batchResult.rows.map(mapImportBatch),
    transactions: transactionResult.rows.map(mapBackupTransaction),
    dailyReviews: reviewResult.rows.map(mapDailyReview)
  };
}

export async function restoreBackup(payload: BackupPayload): Promise<BackupRestoreResult> {
  const client = await getPool().connect();

  try {
    await client.query('BEGIN');
    await client.query('TRUNCATE TABLE transactions, import_batches, daily_reviews');

    for (const batch of payload.importBatches) {
      await client.query(
        `
          INSERT INTO import_batches (id, source_file_name, imported_at, row_count, error_count)
          VALUES ($1, $2, $3, $4, $5)
        `,
        [batch.id, batch.sourceFileName, batch.importedAt, batch.rowCount, batch.errorCount]
      );
    }

    for (const trade of payload.transactions) {
      await client.query(
        `
          INSERT INTO transactions (
            id,
            import_batch_id,
            source_row_hash,
            source_file_name,
            original_row_json,
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
          )
          VALUES (
            $1, $2, $3, $4, $5::jsonb, $6, $7, $8, $9, $10, $11, $12, $13,
            $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26,
            $27, $28, $29, $30, $31, $32, $33
          )
        `,
        [
          trade.id,
          trade.importBatchId,
          trade.sourceRowHash,
          trade.sourceFileName,
          JSON.stringify(trade.originalRowJson),
          trade.positionGroup,
          trade.dateOpened,
          trade.expiration,
          trade.closeDate,
          trade.stock,
          trade.positionSide,
          trade.strategyType,
          trade.strikes,
          trade.contracts,
          trade.openingPrice,
          trade.closingPrice,
          trade.fees,
          trade.profit,
          trade.winLoss,
          trade.broker,
          trade.botOpened,
          trade.tags,
          trade.reviewNotes,
          trade.lessonLearned,
          trade.exitReason,
          trade.profitTarget,
          trade.stopLoss,
          trade.maxRisk,
          trade.notes,
          trade.manuallyEdited,
          trade.manuallyEditedAt,
          trade.createdAt,
          trade.updatedAt
        ]
      );
    }

    for (const review of payload.dailyReviews) {
      await client.query(
        `
          INSERT INTO daily_reviews (review_date, notes, chart_image_data_url, created_at, updated_at)
          VALUES ($1, $2, $3, $4, $5)
        `,
        [review.reviewDate, review.notes, review.chartImageDataUrl, review.createdAt, review.updatedAt]
      );
    }

    await client.query('COMMIT');

    return {
      importedBatches: payload.importBatches.length,
      importedTransactions: payload.transactions.length,
      importedDailyReviews: payload.dailyReviews.length
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
