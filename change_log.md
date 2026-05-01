# Change Log

All notable changes to Trade Journal should be recorded here. Future agents must update this file whenever they modify code, configuration, schema, tests, or documentation.

## 2026-04-30 21:47:24 PDT

- Normalized imported contract amounts to positive values, including plain negative numbers.
- Treated blank or `-` open-date cells as ignorable placeholder rows when Win/Loss is empty.
- Allowed completed rows with blank or `-` open dates to import by using the close date, then expiration date, as the trade date fallback.

## 2026-04-30 16:06:56 PDT

- Added CSV import support for an older spreadsheet format with no `Bot` column.
- Older rows are treated as manual trades with `botOpened = false`.
- Added support for tab-delimited spreadsheet exports in addition to comma-delimited CSV.
- Added contract amount parsing for ratio-style option quantities like `1/-2/1`, using the first non-zero leg as the contract count.
- Added `1`/`0`, `W`/`L`, and yes/no handling for imported Win/Loss cells.

## 2026-04-30 15:51:33 PDT

- Added `Agents.md` with project overview, future-agent guidance, important paths, commands, and data-safety rules.
- Added `architecture.md` with system architecture, runtime services, database shape, import flow, analytics rules, backup/restore behavior, and testing notes.
- Added this `change_log.md` and established the rule that it should be updated on every future modification.

## 2026-04-30

- Reviewed the separate `/Users/alexanderhenry/projects/pnl-tracker` app for useful ideas.
- Ported dashboard date presets: All, Today, This Week, MTD, Last 30, Last 90, and YTD.
- Added dashboard diagnostics inspired by `pnl-tracker`:
  - Day-of-week P&L breakdown
  - Holding period vs P&L scatter plot
  - Win/loss streak panel
  - Outlier impact panel
  - Best and worst trades tables
- Extended shared analytics types and API analytics output to include the new diagnostics.
- Rebuilt Docker and verified the analytics payload includes the new sections.

## 2026-04-30

- Fixed duplicate creation when importing updated versions of the same CSV.
- Changed CSV import matching to use exact fingerprints first, then stable trade identity.
- Stable import identity uses open date, expiration, stock, side, strategy, strikes, contracts, opening price, broker, and bot/manual.
- Updated matching trades instead of inserting duplicates when mutable fields changed.
- Added an exact-duplicate cleanup safeguard after import.
- Added `updated` to import results and surfaced it in the import UI.
- Cleaned existing duplicate rows from the database.

## 2026-04-28

- Added daily calendar drilldown.
- Added `daily_reviews` storage for day-level notes and chart image attachments.
- Added a daily review page with daily P&L, trade count, win rate, fees, strategy ranking, stock ranking, notes, chart image, and trade list.
- Made dashboard calendar heatmap days clickable.
- Added JSON backup export and restore.
- Added backup/restore UI to the Imports page.
- Increased API JSON body limit to support backup files and chart image data URLs.

## 2026-04-28

- Added unit tests for all frontend API-client calls.
- Added root `npm test` script and web test runner script.
- Added test-safe API URL override helpers in `apps/web/src/lib/api.ts`.
- Added `tsx` as a web workspace dev dependency for TypeScript tests.
- Verified tests locally and inside Docker.

## 2026-04-27

- Scaffolded the Dockerized Trade Journal application.
- Built a React/Vite frontend, Node/Express API, shared TypeScript package, and PostgreSQL schema.
- Added Google Sheets CSV import workflow.
- Added daily, weekly, monthly, and yearly realized P&L views.
- Added open positions tracking separate from realized P&L.
- Added bot/manual breakdowns.
- Added transaction editing.
- Added stock drilldown and strategy drilldown.
- Added position grouping and position lifecycle view.
- Added tags, review notes, lessons learned, exit reason, profit target, stop loss, and max risk fields.
- Added dashboard equity curve, drawdown, calendar heatmap, and strategy/stock breakdowns.
- Added import history, cleanup tools, saved views, dark mode, backup/restore groundwork, and LAN API URL resolution.
- Verified realized P&L excludes open positions and uses the imported `Profit` value.
