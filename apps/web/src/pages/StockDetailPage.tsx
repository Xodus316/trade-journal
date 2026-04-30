import { useEffect, useMemo, useState } from 'react';

import type { StockAnalyticsResponse, TransactionRecord } from '@trade-journal/shared';

import { LineChart } from '../components/LineChart';
import { getStockAnalytics } from '../lib/api';
import { emptyText, formatCurrency, formatPercent } from '../lib/format';

interface StockDetailPageProps {
  stock: string;
  onBack: () => void;
  onTradeSelect: (trade: TransactionRecord) => void;
}

export function StockDetailPage({ stock, onBack, onTradeSelect }: StockDetailPageProps) {
  const [analytics, setAnalytics] = useState<StockAnalyticsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getStockAnalytics(stock)
      .then((response) => {
        setAnalytics(response);
        setError(null);
      })
      .catch((requestError: Error) => {
        setError(requestError.message);
      });
  }, [stock]);

  const maxAbsDailyPnL = useMemo(() => {
    const values = analytics?.dailyPnL.map((row) => Math.abs(row.realizedPnL)) ?? [];
    return Math.max(1, ...values);
  }, [analytics]);

  return (
    <section className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Stock drill-down</p>
          <h2>{stock}</h2>
        </div>
        <button className="ghost-button" onClick={onBack} type="button">
          Back to dashboard
        </button>
      </header>

      {error && <div className="error-banner">{error}</div>}
      {!analytics && !error && <div className="empty-state">Loading stock analytics…</div>}

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
              <span>Closed Trades</span>
              <strong>{analytics.summary.totalClosedTrades}</strong>
            </article>
            <article className="stat-card">
              <span>Open Positions</span>
              <strong>{analytics.summary.totalOpenPositions}</strong>
            </article>
          </div>

          <section className="panel full-panel">
            <div className="panel-header">
              <h3>Equity curve</h3>
              <span className="muted">Cumulative realized P&L</span>
            </div>
            {analytics.equityCurve.length === 0 ? (
              <div className="empty-state compact-empty">No closed trades for this stock yet.</div>
            ) : (
              <LineChart points={analytics.equityCurve.map((point) => ({ x: point.date, y: point.cumulativePnL }))} formatY={formatCurrency} />
            )}
          </section>

          <section className="panel full-panel">
            <div className="panel-header">
              <h3>Daily P&L</h3>
              <span className="muted">Closed positions grouped by close date</span>
            </div>
            <div className="daily-chart">
              {analytics.dailyPnL.map((row) => {
                const width = `${Math.max(4, (Math.abs(row.realizedPnL) / maxAbsDailyPnL) * 100)}%`;
                return (
                  <div className="chart-row" key={row.bucket}>
                    <span className="chart-label">{row.bucket}</span>
                    <div className="chart-track">
                      <span
                        className={row.realizedPnL >= 0 ? 'chart-bar chart-bar-positive' : 'chart-bar chart-bar-negative'}
                        style={{ width }}
                      />
                    </div>
                    <strong>{formatCurrency(row.realizedPnL)}</strong>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="panel full-panel">
            <div className="panel-header">
              <h3>Strategy ranking</h3>
              <span className="muted">Best and worst strategy types for {analytics.stock}</span>
            </div>
            {analytics.strategyBreakdown.length === 0 ? (
              <div className="empty-state compact-empty">No strategy ranking yet.</div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Side</th>
                    <th>Strategy</th>
                    <th>Trades</th>
                    <th>Wins</th>
                    <th>Losses</th>
                    <th>Realized P&L</th>
                  </tr>
                </thead>
                <tbody>
                  {analytics.strategyBreakdown.map((row) => (
                    <tr key={`${row.positionSide}-${row.strategyType}`}>
                      <td>{row.positionSide}</td>
                      <td>{row.strategyType}</td>
                      <td>{row.trades}</td>
                      <td>{row.wins}</td>
                      <td>{row.losses}</td>
                      <td>{formatCurrency(row.realizedPnL)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          <section className="panel full-panel">
            <div className="panel-header">
              <h3>Trades</h3>
              <span className="muted">Open and closed trades for {analytics.stock}</span>
            </div>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Open Date</th>
                  <th>Close Date</th>
                  <th>Side</th>
                  <th>Strategy</th>
                  <th>Strikes</th>
                  <th>Contracts</th>
                  <th>Profit</th>
                  <th>Source</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {analytics.trades.map((trade) => (
                  <tr key={trade.id}>
                    <td>
                      <button className="table-link" onClick={() => onTradeSelect(trade)} type="button">
                        {trade.dateOpened}
                      </button>
                    </td>
                    <td>{trade.closeDate ?? 'Open'}</td>
                    <td>{trade.positionSide}</td>
                    <td>{trade.strategyType}</td>
                    <td>{emptyText(trade.strikes)}</td>
                    <td>{trade.contracts}</td>
                    <td>{trade.closeDate ? formatCurrency(trade.profit) : 'Excluded'}</td>
                    <td>{trade.botOpened ? 'Bot' : 'Manual'}</td>
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
