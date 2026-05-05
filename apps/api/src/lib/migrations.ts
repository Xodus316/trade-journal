import { query } from './db.js';

export async function ensureSchema() {
  await query(`
    ALTER TABLE transactions
      ADD COLUMN IF NOT EXISTS position_group TEXT,
      ADD COLUMN IF NOT EXISTS tags TEXT[] NOT NULL DEFAULT '{}',
      ADD COLUMN IF NOT EXISTS mistake_tags TEXT[] NOT NULL DEFAULT '{}',
      ADD COLUMN IF NOT EXISTS review_notes TEXT,
      ADD COLUMN IF NOT EXISTS lesson_learned TEXT,
      ADD COLUMN IF NOT EXISTS exit_reason TEXT,
      ADD COLUMN IF NOT EXISTS profit_target NUMERIC(12, 2),
      ADD COLUMN IF NOT EXISTS stop_loss NUMERIC(12, 2),
      ADD COLUMN IF NOT EXISTS max_risk NUMERIC(12, 2)
  `);

  await query(`
    ALTER TABLE import_batches
      ADD COLUMN IF NOT EXISTS imported_count INTEGER NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS updated_count INTEGER NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS skipped_duplicate_count INTEGER NOT NULL DEFAULT 0
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS daily_reviews (
      review_date DATE PRIMARY KEY,
      notes TEXT,
      chart_image_data_url TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await query(`
    ALTER TABLE daily_reviews
      ADD COLUMN IF NOT EXISTS what_went_well TEXT,
      ADD COLUMN IF NOT EXISTS what_went_poorly TEXT,
      ADD COLUMN IF NOT EXISTS lesson_learned TEXT,
      ADD COLUMN IF NOT EXISTS mood TEXT,
      ADD COLUMN IF NOT EXISTS discipline_score INTEGER
  `);
}
