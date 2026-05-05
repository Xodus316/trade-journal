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

  const filteredPositions = filterTransactions(positions, { ...filters, status: 'open' });
  const estimatedRisk = filteredPositions.reduce((sum, position) => {
    if (position.maxRisk !== null) {
      return sum + Math.abs(position.maxRisk);
    }

    if (position.openingPrice !== null) {
      return sum + Math.abs(position.openingPrice) * Math.max(1, position.contracts);
    }

    return sum;
  }, 0);
  const expirationDates = filteredPositions
    .map((position) => position.expiration)
    .filter((expiration): expiration is string => Boolean(expiration))
    .sort();

  return (
    <section className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Tracked separately from realized totals</p>
          <h2>Open Positions</h2>
        </div>
      </header>

      {error && <div className="error-banner">{error}</div>}

      {filteredPositions.length > 0 && (
        <div className="card-grid">
          <article className="stat-card">
            <span>Open Positions</span>
            <strong>{filteredPositions.length}</strong>
          </article>
          <article className="stat-card">
            <span>Estimated Risk</span>
            <strong>{formatCurrency(estimatedRisk)}</strong>
          </article>
          <article className="stat-card">
            <span>Earliest Expiration</span>
            <strong>{expirationDates[0] ?? '—'}</strong>
          </article>
          <article className="stat-card">
            <span>Symbols</span>
            <strong>{new Set(filteredPositions.map((position) => position.stock)).size}</strong>
          </article>
        </div>
      )}

      {filteredPositions.length === 0 && !error ? (
        <div className="empty-state">No open positions right now.</div>
      ) : (
        <div className="panel-grid">
          {filteredPositions.map((position) => (
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
                  <dt>Estimated risk</dt>
                  <dd>{formatCurrency(position.maxRisk ?? (position.openingPrice === null ? null : Math.abs(position.openingPrice) * Math.max(1, position.contracts)))}</dd>
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
