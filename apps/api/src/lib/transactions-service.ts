import { createHash, randomUUID } from 'node:crypto';

import type { TransactionInput, TransactionListResponse, TransactionRecord } from '@trade-journal/shared';

import { query } from './db.js';
import { mapTransactionRow, type TransactionRow } from './transaction-row.js';

const baseSelect = `
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

function makeManualSourceHash(input: TransactionInput) {
  const raw = JSON.stringify({
    ...input,
    nonce: randomUUID()
  });

  return `manual:${createHash('sha256').update(raw).digest('hex')}`;
}

export async function listTransactions(): Promise<TransactionListResponse> {
  const result = await query<TransactionRow>(
    `${baseSelect} ORDER BY COALESCE(close_date, expiration, date_opened) DESC, created_at DESC`
  );
  const items = result.rows.map(mapTransactionRow);

  return {
    items,
    meta: {
      total: items.length,
      openPositions: items.filter((item) => !item.closeDate).length,
      closedPositions: items.filter((item) => Boolean(item.closeDate)).length
    }
  };
}

export async function listOpenPositions(): Promise<TransactionRecord[]> {
  const result = await query<TransactionRow>(
    `${baseSelect} WHERE close_date IS NULL ORDER BY expiration NULLS LAST, date_opened DESC`
  );
  return result.rows.map(mapTransactionRow);
}

export async function createTransaction(input: TransactionInput) {
  const result = await query<TransactionRow>(
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
        notes
      )
      VALUES (
        $1, NULL, $2, NULL, $3::jsonb, $4, $5, $6, $7, $8, $9, $10, $11,
        $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27
      )
      RETURNING *
    `,
    [
      randomUUID(),
      makeManualSourceHash(input),
      JSON.stringify(input),
      input.positionGroup,
      input.dateOpened,
      input.expiration,
      input.closeDate,
      input.stock,
      input.positionSide,
      input.strategyType,
      input.strikes,
      input.contracts,
      input.openingPrice,
      input.closingPrice,
      input.fees,
      input.profit,
      input.winLoss,
      input.broker,
      input.botOpened,
      input.tags,
      input.reviewNotes,
      input.lessonLearned,
      input.exitReason,
      input.profitTarget,
      input.stopLoss,
      input.maxRisk,
      input.notes
    ]
  );

  return mapTransactionRow(result.rows[0]);
}

export async function updateTransaction(id: string, input: TransactionInput) {
  const result = await query<TransactionRow>(
    `
      UPDATE transactions
      SET
        original_row_json = $2::jsonb,
        position_group = $3,
        date_opened = $4,
        expiration = $5,
        close_date = $6,
        stock = $7,
        position_side = $8,
        strategy_type = $9,
        strikes = $10,
        contracts = $11,
        opening_price = $12,
        closing_price = $13,
        fees = $14,
        profit = $15,
        win_loss = $16,
        broker = $17,
        bot_opened = $18,
        tags = $19,
        review_notes = $20,
        lesson_learned = $21,
        exit_reason = $22,
        profit_target = $23,
        stop_loss = $24,
        max_risk = $25,
        notes = $26,
        manually_edited = TRUE,
        manually_edited_at = NOW(),
        updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `,
    [
      id,
      JSON.stringify(input),
      input.positionGroup,
      input.dateOpened,
      input.expiration,
      input.closeDate,
      input.stock,
      input.positionSide,
      input.strategyType,
      input.strikes,
      input.contracts,
      input.openingPrice,
      input.closingPrice,
      input.fees,
      input.profit,
      input.winLoss,
      input.broker,
      input.botOpened,
      input.tags,
      input.reviewNotes,
      input.lessonLearned,
      input.exitReason,
      input.profitTarget,
      input.stopLoss,
      input.maxRisk,
      input.notes
    ]
  );

  return result.rows[0] ? mapTransactionRow(result.rows[0]) : null;
}

export async function deleteTransaction(id: string) {
  const result = await query('DELETE FROM transactions WHERE id = $1 RETURNING id', [id]);
  return (result.rowCount ?? 0) > 0;
}
