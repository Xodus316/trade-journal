import { query } from './db.js';

export async function ensureSchema() {
  await query(`
    ALTER TABLE transactions
      ADD COLUMN IF NOT EXISTS position_group TEXT,
      ADD COLUMN IF NOT EXISTS tags TEXT[] NOT NULL DEFAULT '{}',
      ADD COLUMN IF NOT EXISTS review_notes TEXT,
      ADD COLUMN IF NOT EXISTS lesson_learned TEXT,
      ADD COLUMN IF NOT EXISTS exit_reason TEXT,
      ADD COLUMN IF NOT EXISTS profit_target NUMERIC(12, 2),
      ADD COLUMN IF NOT EXISTS stop_loss NUMERIC(12, 2),
      ADD COLUMN IF NOT EXISTS max_risk NUMERIC(12, 2)
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
}
