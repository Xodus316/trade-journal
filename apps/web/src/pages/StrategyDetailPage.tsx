import { useEffect, useMemo, useState } from 'react';

import type { PositionSide, StrategyAnalyticsResponse, TransactionRecord } from '@trade-journal/shared';

import { getStrategyAnalytics } from '../lib/api';
import { emptyText, formatCurrency, formatPercent } from '../lib/format';

interface StrategyDetailPageProps {
  positionSide: PositionSide;
  strategyType: string;
  onBack: () => void;
  onTradeSelect: (trade: TransactionRecord) => void;
}

export function StrategyDetailPage({ positionSide, strategyType, onBack, onTradeSelect }: StrategyDetailPageProps) {
  const [analytics, setAnalytics] = useState<StrategyAnalyticsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getStrategyAnalytics(positionSide, strategyType)
      .then((response) => {
        setAnalytics(response);
        setError(null);
      })
      .catch((requestError: Error) => setError(requestError.message));
  }, [positionSide, strategyType]);

  const maxAbsDailyPnL = useMemo(() => {
    const values = analytics?.dailyPnL.map((row) => Math.abs(row.realizedPnL)) ?? [];
    return Math.max(1, ...values);
  }, [analytics]);

  return (
    <section className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Strategy drill-down</p>
          <h2>
            {positionSide} {strategyType}
          </h2>
        </div>
        <button className="ghost-button" onClick={onBack} type="button">
          Back to dashboard
        </button>
      </header>

      {error && <div className="error-banner">{error}</div>}
      {!analytics && !error && <div className="empty-state">Loading strategy analytics…</div>}

      {analytics && (
        <>
          <div className="card-grid">
            <article className={`stat-card ${analytics.summary.realizedPnL >= 0 ? 'stat-card-positive' : 'stat-card-negative'}`}>
              <span>Realized P&L</span>
              <strong>{formatCurrency(analytics.summary.realizedPnL)}</strong>
            </article>
            <article className="stat-card">
              <span>Win Rate</span>
              <strong>{formatPercent(analytics.summary.winRate)}</strong>
            </article>
            <article className="stat-card">
              <span>Profit Factor</span>
              <strong>{analytics.summary.profitFactor.toFixed(2)}</strong>
            </article>
            <article className="stat-card">
              <span>Max Drawdown</span>
              <strong>{formatCurrency(analytics.drawdown.maxDrawdown)}</strong>
            </article>
          </div>

          <section className="panel full-panel">
            <div className="panel-header">
              <h3>Daily P&L</h3>
              <span className="muted">Closed trades only</span>
            </div>
            <div className="daily-chart">
              {analytics.dailyPnL.map((row) => (
                <div className="chart-row" key={row.bucket}>
                  <span className="chart-label">{row.bucket}</span>
                  <div className="chart-track">
                    <span
                      className={row.realizedPnL >= 0 ? 'chart-bar chart-bar-positive' : 'chart-bar chart-bar-negative'}
                      style={{ width: `${Math.max(4, (Math.abs(row.realizedPnL) / maxAbsDailyPnL) * 100)}%` }}
                    />
                  </div>
                  <strong>{formatCurrency(row.realizedPnL)}</strong>
                </div>
              ))}
            </div>
          </section>

          <section className="panel full-panel">
            <div className="panel-header">
              <h3>Best tickers</h3>
              <span className="muted">Ticker ranking inside this strategy</span>
            </div>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Stock</th>
                  <th>Trades</th>
                  <th>Realized P&L</th>
                </tr>
              </thead>
              <tbody>
                {analytics.stockBreakdown.map((row) => (
                  <tr key={row.stock}>
                    <td>{row.stock}</td>
                    <td>{row.trades}</td>
                    <td>{formatCurrency(row.realizedPnL)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section className="panel full-panel">
            <div className="panel-header">
              <h3>Trades</h3>
              <span className="muted">All trades for this strategy</span>
            </div>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Stock</th>
                  <th>Open</th>
                  <th>Close</th>
                  <th>Strikes</th>
                  <th>Profit</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {analytics.trades.map((trade) => (
                  <tr key={trade.id}>
                    <td>
                      <button className="table-link" onClick={() => onTradeSelect(trade)} type="button">
                        {trade.stock}
                      </button>
                    </td>
                    <td>{trade.dateOpened}</td>
                    <td>{trade.closeDate ?? 'Open'}</td>
                    <td>{emptyText(trade.strikes)}</td>
                    <td>{trade.closeDate ? formatCurrency(trade.profit) : 'Excluded'}</td>
                    <td>{emptyText(trade.notes)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </>
      )}
    </section>
  );
}
