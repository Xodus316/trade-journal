import type { ImportBatchRecord } from '@trade-journal/shared';

import { query } from './db.js';

interface ImportBatchRow {
  id: string;
  source_file_name: string;
  imported_at: string | Date;
  row_count: number;
  error_count: number;
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
    errorCount: Number(row.error_count)
  }));
}
