# Trade Journal Agent Notes

## Project Overview

Trade Journal is a single-user stock and options trading journal. It imports the user's Google Sheets CSV exports, tracks open and closed stock/options positions, and reports realized P&L by daily, weekly, monthly, and yearly views. The user's imported `Profit` column is authoritative; open positions do not count toward realized P&L until they have a close date.

The app is designed to run locally on macOS or Windows through Docker, with a path toward later AWS deployment. It currently runs as a React web app, a Node/Express API, and PostgreSQL.

## Primary User Workflows

- Import a Google Sheets CSV export containing stock and options transactions.
- Re-import updated versions of the same CSV without creating duplicate trades.
- View realized performance by date bucket, strategy, stock, bot/manual source, day of week, holding period, and trade outliers.
- Track open positions separately from closed positions.
- Edit transactions and add review metadata such as tags, notes, exit reason, risk fields, position group, and lessons learned.
- Drill into a stock, strategy, position group, trade, or calendar day.
- Attach an end-of-day chart image and daily notes to a calendar review.
- Export and restore a JSON backup of journal data.

## Current Stack

- Frontend: React 18, TypeScript, Vite
- API: Node.js, Express, TypeScript
- Database: PostgreSQL 16
- Shared package: TypeScript domain types in `packages/shared`
- Runtime: Docker Compose
- Tests: Node test runner through `tsx --test` for frontend API-client unit tests

## Important Paths

- `apps/web/src`: React app
- `apps/web/src/lib/api.ts`: frontend API client
- `apps/web/src/pages`: main app pages and drilldowns
- `apps/web/src/components`: reusable UI components
- `apps/api/src/lib`: API services, database access, CSV import, analytics
- `apps/api/src/routes`: Express route modules
- `packages/shared/src/index.ts`: shared types used by API and web
- `docker/postgres/init.sql`: initial database schema
- `docker-compose.yml`: local runtime stack
- `architecture.md`: system architecture and data flow
- `change_log.md`: chronological change history

## Development Rules For Future Agents

- Update `change_log.md` whenever you modify code, configuration, schema, tests, or documentation.
- Keep the user's existing data safe. Do not reset or delete the database unless the user explicitly asks.
- Treat imported `Profit` as the source of truth. Do not recompute realized P&L from opening/closing price.
- Keep open positions out of realized P&L totals until `closeDate` exists.
- Be careful with CSV import changes. Re-imports must update or skip matching trades instead of creating duplicates.
- Preserve user edits when importing updated CSV files.
- Keep Docker support working after changes.
- Prefer small, focused changes that match the existing code style.
- Run relevant verification before declaring work complete.

## Common Commands

From the project root:

```bash
npm test
npm run typecheck
npm run build
docker compose up -d --build api web
docker compose ps
```

The active running app has been synced to:

```text
/Users/alexanderhenry/projects/trade-journal
```

The source workspace used in this Codex thread is:

```text
/Users/alexanderhenry/Documents/New project
```

## Current Local URLs

- Web: `http://127.0.0.1:5173`
- API: `http://127.0.0.1:4000`
- PostgreSQL host port: `5433`

