# Trade Journal

Docker-ready scaffold for a single-user stock and options journal with:

- CSV import from Google Sheets exports
- Daily, weekly, monthly, and yearly realized P&L views
- Open positions tracked separately from realized performance
- Bot vs manual breakdowns
- Editable transactions

## Workspace layout

- `apps/web`: React + TypeScript frontend
- `apps/api`: Node.js + TypeScript API
- `packages/shared`: shared domain package placeholder
- `docker/postgres/init.sql`: initial PostgreSQL schema

## Next steps

1. Install dependencies with `npm install` if you want editor tooling on the host machine
2. Start everything with `docker compose up --build`
3. Open the frontend at `http://localhost:5173`

## Planned follow-up work

- Persist imports into PostgreSQL
- Add duplicate-safe CSV ingestion
- Compute analytics from closed positions using `close_date`
- Add row-level edit history and import batch tracking
