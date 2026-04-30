import type { TransactionRecord } from '@trade-journal/shared';

export interface TransactionRow {
  id: string;
  import_batch_id: string | null;
  source_row_hash?: string;
  source_file_name: string | null;
  original_row_json?: unknown;
  position_group: string | null;
  date_opened: string | Date;
  expiration: string | Date | null;
  close_date: string | Date | null;
  stock: string;
  position_side: 'Long' | 'Short';
  strategy_type: string;
  strikes: string | null;
  contracts: string | number;
  opening_price: string | number | null;
  closing_price: string | number | null;
  fees: string | number;
  profit: string | number | null;
  win_loss: 'Win' | 'Loss' | null;
  broker: string | null;
  bot_opened: boolean;
  tags: string[] | null;
  review_notes: string | null;
  lesson_learned: string | null;
  exit_reason: string | null;
  profit_target: string | number | null;
  stop_loss: string | number | null;
  max_risk: string | number | null;
  notes: string | null;
  manually_edited: boolean;
  manually_edited_at: string | Date | null;
  created_at: string | Date;
  updated_at: string | Date;
}

function toNumber(value: string | number | null) {
  if (value === null) {
    return null;
  }

  return typeof value === 'number' ? value : Number(value);
}

function toDateString(value: string | Date | null) {
  if (value === null) {
    return null;
  }

  return value instanceof Date ? value.toISOString().slice(0, 10) : value;
}

function toTimestampString(value: string | Date | null) {
  if (value === null) {
    return null;
  }

  return value instanceof Date ? value.toISOString() : value;
}

export function mapTransactionRow(row: TransactionRow): TransactionRecord {
  return {
    id: row.id,
    importBatchId: row.import_batch_id,
    sourceFileName: row.source_file_name,
    positionGroup: row.position_group,
    dateOpened: toDateString(row.date_opened) as string,
    expiration: toDateString(row.expiration),
    closeDate: toDateString(row.close_date),
    stock: row.stock,
    positionSide: row.position_side,
    strategyType: row.strategy_type,
    strikes: row.strikes,
    contracts: Number(row.contracts),
    openingPrice: toNumber(row.opening_price),
    closingPrice: toNumber(row.closing_price),
    fees: Number(row.fees),
    profit: toNumber(row.profit),
    winLoss: row.win_loss,
    broker: row.broker,
    botOpened: row.bot_opened,
    tags: row.tags ?? [],
    reviewNotes: row.review_notes,
    lessonLearned: row.lesson_learned,
    exitReason: row.exit_reason,
    profitTarget: toNumber(row.profit_target),
    stopLoss: toNumber(row.stop_loss),
    maxRisk: toNumber(row.max_risk),
    percentMaxProfit:
      row.profit !== null && row.profit_target !== null && Number(row.profit_target) !== 0
        ? Number(((Number(row.profit) / Number(row.profit_target)) * 100).toFixed(2))
        : null,
    returnOnRisk:
      row.profit !== null && row.max_risk !== null && Number(row.max_risk) !== 0
        ? Number(((Number(row.profit) / Math.abs(Number(row.max_risk))) * 100).toFixed(2))
        : null,
    notes: row.notes,
    manuallyEdited: row.manually_edited,
    manuallyEditedAt: toTimestampString(row.manually_edited_at),
    createdAt: toTimestampString(row.created_at) as string,
    updatedAt: toTimestampString(row.updated_at) as string
  };
}
