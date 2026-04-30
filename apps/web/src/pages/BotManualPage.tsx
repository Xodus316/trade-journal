import { useEffect, useState } from 'react';

import type { AnalyticsFilters, AnalyticsResponse } from '@trade-journal/shared';

import { getAnalytics } from '../lib/api';
import { formatCurrency, formatPercent } from '../lib/format';

interface BotManualPageProps {
  filters: AnalyticsFilters;
}

export function BotManualPage({ filters }: BotManualPageProps) {
  const [analytics, setAnalytics] = useState<AnalyticsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getAnalytics(filters)
      .then((response) => {
        setAnalytics(response);
        setError(null);
      })
      .catch((requestError: Error) => setError(requestError.message));
  }, [filters]);

  return (
    <section className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Source performance</p>
          <h2>Bot vs Manual</h2>
        </div>
      </header>

      {error && <div className="error-banner">{error}</div>}
      {!analytics && !error && <div className="empty-state">Loading comparison…</div>}

      {analytics && (
        <div className="panel-grid">
          {analytics.botManualBreakdown.map((row) => (
            <section className="panel" key={row.source}>
              <div className="panel-header">
                <h3>{row.source}</h3>
                <span className="muted">{row.trades} closed trades</span>
              </div>
              <div className="metric-list">
                <div>
                  <span>Realized P&L</span>
                  <strong>{formatCurrency(row.realizedPnL)}</strong>
                </div>
                <div>
                  <span>Win rate</span>
                  <strong>{formatPercent(row.winRate)}</strong>
                </div>
                <div>
                  <span>Profit factor</span>
                  <strong>{row.profitFactor.toFixed(2)}</strong>
                </div>
                <div>
                  <span>Expectancy</span>
                  <strong>{formatCurrency(row.expectancy)}</strong>
                </div>
              </div>
            </section>
          ))}
        </div>
      )}
    </section>
  );
}
