CREATE TABLE IF NOT EXISTS import_batches (
  id UUID PRIMARY KEY,
  source_file_name TEXT NOT NULL,
  imported_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  row_count INTEGER NOT NULL DEFAULT 0,
  error_count INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS transactions (
  id UUID PRIMARY KEY,
  import_batch_id UUID REFERENCES import_batches(id) ON DELETE SET NULL,
  source_row_hash TEXT NOT NULL,
  source_file_name TEXT,
  original_row_json JSONB NOT NULL,
  position_group TEXT,
  date_opened DATE NOT NULL,
  expiration DATE,
  close_date DATE,
  stock TEXT NOT NULL,
  position_side TEXT NOT NULL,
  strategy_type TEXT NOT NULL,
  strikes TEXT,
  contracts NUMERIC(10, 2) NOT NULL,
  opening_price NUMERIC(12, 4),
  closing_price NUMERIC(12, 4),
  fees NUMERIC(12, 2) NOT NULL DEFAULT 0,
  profit NUMERIC(12, 2),
  win_loss TEXT,
  broker TEXT,
  bot_opened BOOLEAN NOT NULL DEFAULT FALSE,
  tags TEXT[] NOT NULL DEFAULT '{}',
  review_notes TEXT,
  lesson_learned TEXT,
  exit_reason TEXT,
  profit_target NUMERIC(12, 2),
  stop_loss NUMERIC(12, 2),
  max_risk NUMERIC(12, 2),
  notes TEXT,
  manually_edited BOOLEAN NOT NULL DEFAULT FALSE,
  manually_edited_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS transactions_source_row_hash_idx
  ON transactions (source_row_hash);

CREATE INDEX IF NOT EXISTS transactions_close_date_idx
  ON transactions (close_date);

CREATE INDEX IF NOT EXISTS transactions_open_positions_idx
  ON transactions (close_date)
  WHERE close_date IS NULL;

CREATE INDEX IF NOT EXISTS transactions_strategy_idx
  ON transactions (position_side, strategy_type);

CREATE TABLE IF NOT EXISTS daily_reviews (
  review_date DATE PRIMARY KEY,
  notes TEXT,
  chart_image_data_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
