import { useEffect, useState } from 'react';

import type { AnalyticsFilters, TransactionRecord } from '@trade-journal/shared';

import { getOpenPositions } from '../lib/api';
import { filterTransactions } from '../lib/filter-transactions';
import { emptyText, formatCurrency } from '../lib/format';

interface OpenPositionsPageProps {
  filters: AnalyticsFilters;
}

export function OpenPositionsPage({ filters }: OpenPositionsPageProps) {
  const [positions, setPositions] = useState<TransactionRecord[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getOpenPositions()
      .then((response) => {
        setPositions(response.items);
        setError(null);
      })
      .catch((requestError: Error) => {
        setError(requestError.message);
      });
  }, []);

  return (
    <section className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Tracked separately from realized totals</p>
          <h2>Open Positions</h2>
        </div>
      </header>

      {error && <div className="error-banner">{error}</div>}

      {filterTransactions(positions, { ...filters, status: 'open' }).length === 0 && !error ? (
        <div className="empty-state">No open positions right now.</div>
      ) : (
        <div className="panel-grid">
          {filterTransactions(positions, { ...filters, status: 'open' }).map((position) => (
            <article className="panel" key={position.id}>
              <div className="panel-header">
                <div>
                  <h3>{position.stock}</h3>
                  <span className="muted">
                    {position.positionSide} {position.strategyType}
                  </span>
                </div>
                <span className="status-pill status-open">{position.botOpened ? 'Bot' : 'Manual'}</span>
              </div>
              <dl className="detail-list">
                <div>
                  <dt>Strikes</dt>
                  <dd>{emptyText(position.strikes)}</dd>
                </div>
                <div>
                  <dt>Contracts</dt>
                  <dd>{position.contracts}</dd>
                </div>
                <div>
                  <dt>Opened</dt>
                  <dd>{position.dateOpened}</dd>
                </div>
                <div>
                  <dt>Expiration</dt>
                  <dd>{position.expiration ?? '—'}</dd>
                </div>
                <div>
                  <dt>Opening price</dt>
                  <dd>{formatCurrency(position.openingPrice)}</dd>
                </div>
                <div>
                  <dt>Notes</dt>
                  <dd>{emptyText(position.notes)}</dd>
                </div>
              </dl>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
