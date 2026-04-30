import { createHash, randomUUID } from 'node:crypto';

import type { ImportResult, TransactionInput } from '@trade-journal/shared';

import { query } from './db.js';

const currentHeaders = [
  'Date',
  'Expiration',
  'Close Date',
  'Stock',
  'Strategy',
  'Strategy',
  'Strikes',
  'Amount',
  'Opening Price',
  'Closing Price',
  'Fees',
  'Profit',
  'Win/Loss',
  'Broker',
  'Bot',
  'Notes'
] as const;

const legacyHeaders = [
  'Date',
  'Expiration',
  'Close Date',
  'Stock',
  'Strategy',
  'Strategy',
  'Strikes',
  'Amount',
  'Opening Price',
  'Closing Price',
  'Fees',
  'Profit',
  'Win/Loss',
  'Broker',
  'Notes'
] as const;

type ImportFormat = 'current' | 'legacy';

function detectDelimiter(text: string) {
  const firstDataLine = text.split(/\r?\n/).find((line) => line.trim().length > 0) ?? '';
  const tabs = (firstDataLine.match(/\t/g) ?? []).length;
  const commas = (firstDataLine.match(/,/g) ?? []).length;
  return tabs > commas ? '\t' : ',';
}

function parseCsv(text: string) {
  const delimiter = detectDelimiter(text);
  const rows: string[][] = [];
  let currentField = '';
  let currentRow: string[] = [];
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    const nextCharacter = text[index + 1];

    if (character === '"') {
      if (inQuotes && nextCharacter === '"') {
        currentField += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (character === delimiter && !inQuotes) {
      currentRow.push(currentField);
      currentField = '';
      continue;
    }

    if ((character === '\n' || character === '\r') && !inQuotes) {
      if (character === '\r' && nextCharacter === '\n') {
        index += 1;
      }

      currentRow.push(currentField);
      rows.push(currentRow);
      currentField = '';
      currentRow = [];
      continue;
    }

    currentField += character;
  }

  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField);
    rows.push(currentRow);
  }

  return rows;
}

function normalizeCell(value: string | undefined) {
  const trimmed = (value ?? '').replace(/^\uFEFF/, '').trim();
  return trimmed.length > 0 ? trimmed : '';
}

function nullable(value: string | undefined) {
  const normalized = normalizeCell(value);
  return normalized.length > 0 ? normalized : null;
}

function toNumber(value: string | undefined) {
  const normalized = normalizeCell(value);
  if (!normalized) {
    return null;
  }

  const compact = normalized.replace(/\s/g, '');
  const isAccountingNegative = /\(.+\)/.test(compact);
  const safe = normalized.replace(/[$,\s()]/g, '');
  if (safe === '-' || safe === '') {
    return 0;
  }

  const parsed = Number(safe);
  return Number.isFinite(parsed) ? (isAccountingNegative ? -parsed : parsed) : Number.NaN;
}

function toContractAmount(value: string | undefined) {
  const normalized = normalizeCell(value);
  if (normalized.includes('/')) {
    const legs = normalized
      .split('/')
      .map((leg) => Number(leg.trim()))
      .filter((leg) => Number.isFinite(leg));
    const firstLeg = legs.find((leg) => leg !== 0);

    return firstLeg === undefined ? Number.NaN : Math.abs(firstLeg);
  }

  return toNumber(value);
}

function toBoolean(value: string | undefined) {
  const normalized = normalizeCell(value).toLowerCase();
  return ['true', 'yes', 'y', '1', 'checked'].includes(normalized);
}

function parseDateCell(value: string | undefined) {
  const normalized = normalizeCell(value);
  if (!normalized) {
    return null;
  }

  const monthDayYear = normalized.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (monthDayYear) {
    const [, month, day, year] = monthDayYear;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }

  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) {
    return 'invalid';
  }

  return parsed.toISOString().slice(0, 10);
}

function matchesHeaders(headers: string[], expectedHeaders: readonly string[]) {
  return expectedHeaders.every((header, index) => {
    const actual = normalizeCell(headers[index]);

    if (expectedHeaders.length === currentHeaders.length && index === 14) {
      return actual === header || actual === '';
    }

    return actual === header;
  });
}

function getImportFormat(headers: string[]): ImportFormat | null {
  if (matchesHeaders(headers, currentHeaders)) {
    return 'current';
  }

  if (matchesHeaders(headers, legacyHeaders)) {
    return 'legacy';
  }

  return null;
}

function validateHeaders(headers: string[]) {
  return getImportFormat(headers) !== null;
}

function findHeaderRowIndex(rows: string[][]) {
  return rows.findIndex((row) => validateHeaders(row));
}

function isNonTransactionRow(cells: string[]) {
  const hasDataShape =
    normalizeCell(cells[0]) ||
    normalizeCell(cells[1]) ||
    normalizeCell(cells[2]) ||
    normalizeCell(cells[3]) ||
    normalizeCell(cells[4]) ||
    normalizeCell(cells[5]) ||
    normalizeCell(cells[6]) ||
    normalizeCell(cells[7]) ||
    normalizeCell(cells[8]) ||
    normalizeCell(cells[9]) ||
    normalizeCell(cells[10]) ||
    normalizeCell(cells[11]) ||
    normalizeCell(cells[12]) ||
    normalizeCell(cells[13]) ||
    normalizeCell(cells[14]) ||
    normalizeCell(cells[15]);

  if (!hasDataShape) {
    return true;
  }

  if (validateHeaders(cells)) {
    return true;
  }

  const dateOpened = parseDateCell(cells[0]);
  const stock = normalizeCell(cells[3]);
  const side = normalizeCell(cells[4]);
  const strategy = normalizeCell(cells[5]);

  return dateOpened === 'invalid' && !stock && !side && !strategy;
}

function hashRow(row: TransactionInput) {
  return createHash('sha256').update(JSON.stringify(row)).digest('hex');
}

function stableTradeIdentity(row: TransactionInput) {
  return {
    stock: row.stock.trim().toUpperCase(),
    strategyType: row.strategyType.trim().toLowerCase(),
    strikes: row.strikes?.trim().toLowerCase() ?? null,
    broker: row.broker?.trim().toLowerCase() ?? null
  };
}

function inferWinLoss(profit: number | null) {
  if (profit === null) {
    return null;
  }

  return profit >= 0 ? 'Win' : 'Loss';
}

function parseWinLoss(value: string | null, profit: number | null) {
  const normalized = (value ?? '').trim().toLowerCase();

  if (['win', 'w', '1', 'true', 'yes'].includes(normalized)) {
    return 'Win';
  }

  if (['loss', 'l', '0', 'false', 'no'].includes(normalized)) {
    return 'Loss';
  }

  return inferWinLoss(profit);
}

async function removeExactDuplicateTransactions() {
  await query(`
    WITH ranked AS (
      SELECT
        id,
        ROW_NUMBER() OVER (
          PARTITION BY
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
            notes
          ORDER BY manually_edited DESC, updated_at DESC, created_at DESC
        ) AS row_rank
      FROM transactions
      WHERE source_file_name IS NOT NULL
    )
    DELETE FROM transactions t
    USING ranked
    WHERE t.id = ranked.id
      AND ranked.row_rank > 1
  `);
}

function mapRowToTransaction(cells: string[], rowNumber: number, format: ImportFormat) {
  const dateOpened = parseDateCell(cells[0]);
  const expiration = parseDateCell(cells[1]);
  const closeDate = parseDateCell(cells[2]);
  const contracts = toContractAmount(cells[7]);
  const openingPrice = toNumber(cells[8]);
  const closingPrice = toNumber(cells[9]);
  const fees = toNumber(cells[10]);
  const profit = toNumber(cells[11]);
  const winLossCell = nullable(cells[12]);
  const side = normalizeCell(cells[4]);
  const problems: string[] = [];

  if (dateOpened === 'invalid') {
    problems.push('invalid open date');
  }
  if (expiration === 'invalid') {
    problems.push('invalid expiration date');
  }
  if (closeDate === 'invalid') {
    problems.push('invalid close date');
  }
  if (!normalizeCell(cells[3])) {
    problems.push('missing stock');
  }
  if (!side) {
    problems.push('missing long/short strategy side');
  }
  if (side && side !== 'Long' && side !== 'Short') {
    problems.push('strategy side must be Long or Short');
  }
  if (!normalizeCell(cells[5])) {
    problems.push('missing strategy type');
  }
  if (!Number.isFinite(contracts) || contracts === null || contracts <= 0) {
    problems.push('invalid contract amount');
  }
  if (fees !== null && Number.isNaN(fees)) {
    problems.push('invalid fees');
  }
  if (profit !== null && Number.isNaN(profit)) {
    problems.push('invalid profit');
  }
  if (openingPrice !== null && Number.isNaN(openingPrice)) {
    problems.push('invalid opening price');
  }
  if (closingPrice !== null && Number.isNaN(closingPrice)) {
    problems.push('invalid closing price');
  }

  if (problems.length > 0 || dateOpened === 'invalid' || expiration === 'invalid' || closeDate === 'invalid') {
    return {
      error: {
        rowNumber,
        message: problems.join(', ')
      }
    };
  }

  const profitValue = Number.isNaN(profit) ? null : profit;
  const winLoss = parseWinLoss(winLossCell, profitValue);
  const botOpened = format === 'current' ? toBoolean(cells[14]) : false;
  const notes = format === 'current' ? nullable(cells[15]) : nullable(cells[14]);

  return {
    transaction: {
      positionGroup: null,
      dateOpened: dateOpened as string,
      expiration: expiration as string | null,
      closeDate: closeDate as string | null,
      stock: normalizeCell(cells[3]),
      positionSide: side as 'Long' | 'Short',
      strategyType: normalizeCell(cells[5]),
      strikes: nullable(cells[6]),
      contracts: contracts as number,
      openingPrice: Number.isNaN(openingPrice) ? null : openingPrice,
      closingPrice: Number.isNaN(closingPrice) ? null : closingPrice,
      fees: Number.isNaN(fees) || fees === null ? 0 : fees,
      profit: profitValue,
      winLoss,
      broker: nullable(cells[13]),
      botOpened,
      tags: [],
      reviewNotes: null,
      lessonLearned: null,
      exitReason: null,
      profitTarget: null,
      stopLoss: null,
      maxRisk: null,
      notes
    } satisfies TransactionInput
  };
}

export async function importTransactionsCsv(sourceFileName: string, csvText: string): Promise<ImportResult> {
  const rows = parseCsv(csvText).filter((row) => row.some((cell) => normalizeCell(cell).length > 0));

  if (rows.length === 0) {
    throw new Error('The CSV file is empty.');
  }

  const headerRowIndex = findHeaderRowIndex(rows);
  if (headerRowIndex === -1) {
    throw new Error('The CSV headers do not match the expected Google Sheets export format.');
  }

  const importFormat = getImportFormat(rows[headerRowIndex]);
  if (!importFormat) {
    throw new Error('The CSV headers do not match the expected Google Sheets export format.');
  }

  const dataRows = rows.slice(headerRowIndex + 1);
  const batchId = randomUUID();
  const errors: ImportResult['errors'] = [];
  let imported = 0;
  let updated = 0;
  let skippedDuplicates = 0;

  await query(
    `
      INSERT INTO import_batches (id, source_file_name, row_count, error_count)
      VALUES ($1, $2, 0, 0)
    `,
    [batchId, sourceFileName]
  );

  for (const [rowIndex, row] of dataRows.entries()) {
    const rowNumber = headerRowIndex + rowIndex + 2;
    if (isNonTransactionRow(row)) {
      continue;
    }

    const mapped = mapRowToTransaction(row, rowNumber, importFormat);

    if ('error' in mapped) {
      if (mapped.error) {
        errors.push(mapped.error);
      }
      continue;
    }

    const sourceHash = hashRow(mapped.transaction);
    const identity = stableTradeIdentity(mapped.transaction);
    const existing = await query<{ id: string; source_row_hash: string }>(
      `
        SELECT id, source_row_hash
        FROM transactions
        WHERE
          source_row_hash = $1
          OR (
            date_opened = $2
            AND expiration IS NOT DISTINCT FROM $3::date
            AND UPPER(stock) = $4
            AND position_side = $5
            AND LOWER(strategy_type) = $6
            AND LOWER(COALESCE(strikes, '')) = COALESCE($7, '')
            AND contracts = $8
            AND opening_price IS NOT DISTINCT FROM $9::numeric
            AND LOWER(COALESCE(broker, '')) = COALESCE($10, '')
            AND bot_opened = $11
            AND source_file_name IS NOT NULL
          )
        ORDER BY (source_row_hash = $1) DESC, manually_edited DESC, updated_at DESC, created_at DESC
        LIMIT 1
      `,
      [
        sourceHash,
        mapped.transaction.dateOpened,
        mapped.transaction.expiration,
        identity.stock,
        mapped.transaction.positionSide,
        identity.strategyType,
        identity.strikes,
        mapped.transaction.contracts,
        mapped.transaction.openingPrice,
        identity.broker,
        mapped.transaction.botOpened
      ]
    );

    if (existing.rows[0]) {
      const existingRow = existing.rows[0];
      if (existingRow.source_row_hash === sourceHash) {
        skippedDuplicates += 1;
        continue;
      }

      await query(
        `
          UPDATE transactions
          SET
            import_batch_id = $2,
            source_row_hash = $3,
            source_file_name = $4,
            original_row_json = $5::jsonb,
            expiration = $6,
            close_date = $7,
            closing_price = $8,
            fees = $9,
            profit = $10,
            win_loss = $11,
            broker = $12,
            bot_opened = $13,
            notes = $14,
            updated_at = NOW()
          WHERE id = $1
        `,
        [
          existingRow.id,
          batchId,
          sourceHash,
          sourceFileName,
          JSON.stringify(row),
          mapped.transaction.expiration,
          mapped.transaction.closeDate,
          mapped.transaction.closingPrice,
          mapped.transaction.fees,
          mapped.transaction.profit,
          mapped.transaction.winLoss,
          mapped.transaction.broker,
          mapped.transaction.botOpened,
          mapped.transaction.notes
        ]
      );
      updated += 1;
      continue;
    }

    const result = await query(
      `
        INSERT INTO transactions (
          id,
          import_batch_id,
          source_row_hash,
          source_file_name,
          original_row_json,
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
          notes
        )
        VALUES (
          $1, $2, $3, $4, $5::jsonb, $6, $7, $8, $9, $10, $11, $12, $13,
          $14, $15, $16, $17, $18, $19, $20, $21
        )
        ON CONFLICT (source_row_hash) DO NOTHING
        RETURNING id
      `,
      [
        randomUUID(),
        batchId,
        sourceHash,
        sourceFileName,
        JSON.stringify(row),
        mapped.transaction.dateOpened,
        mapped.transaction.expiration,
        mapped.transaction.closeDate,
        mapped.transaction.stock,
        mapped.transaction.positionSide,
        mapped.transaction.strategyType,
        mapped.transaction.strikes,
        mapped.transaction.contracts,
        mapped.transaction.openingPrice,
        mapped.transaction.closingPrice,
        mapped.transaction.fees,
        mapped.transaction.profit,
        mapped.transaction.winLoss,
        mapped.transaction.broker,
        mapped.transaction.botOpened,
        mapped.transaction.notes
      ]
    );

    if (result.rowCount === 0) {
      skippedDuplicates += 1;
    } else {
      imported += 1;
    }
  }

  await query(
    `
      UPDATE import_batches
      SET row_count = $2, error_count = $3
      WHERE id = $1
    `,
    [batchId, imported + updated + skippedDuplicates, errors.length]
  );

  await removeExactDuplicateTransactions();

  return {
    batchId,
    sourceFileName,
    imported,
    updated,
    skippedDuplicates,
    errors
  };
}
