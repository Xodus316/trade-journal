import { useEffect, useState } from 'react';

import type { AnalyticsFilters, AnalyticsResponse, RealizedTimeframe, StrategyBreakdownRow } from '@trade-journal/shared';

import { LineChart } from '../components/LineChart';
import { ScatterPlot } from '../components/ScatterPlot';
import { getAnalytics } from '../lib/api';
import { formatCurrency, formatPercent } from '../lib/format';

interface DashboardPageProps {
  filters: AnalyticsFilters;
  onDaySelect: (date: string) => void;
  onStockSelect: (stock: string) => void;
  onStrategySelect: (strategy: StrategyBreakdownRow) => void;
}

export function DashboardPage({ filters, onDaySelect, onStockSelect, onStrategySelect }: DashboardPageProps) {
  const [timeframe, setTimeframe] = useState<RealizedTimeframe>('monthly');
  const [analytics, setAnalytics] = useState<AnalyticsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getAnalytics(filters)
      .then((response) => {
        setAnalytics(response);
        setError(null);
      })
      .catch((requestError: Error) => {
        setError(requestError.message);
      });
  }, [filters]);

  const summaryCards = analytics
    ? [
        { label: 'Realized P&L', value: formatCurrency(analytics.summary.realizedPnL), tone: analytics.summary.realizedPnL >= 0 ? 'positive' : 'negative' },
        { label: 'Win Rate', value: formatPercent(analytics.summary.winRate), tone: 'neutral' },
        { label: 'Open Positions', value: String(analytics.summary.totalOpenPositions), tone: 'neutral' },
        { label: 'Total Fees', value: formatCurrency(analytics.summary.totalFees), tone: 'negative' }
      ]
    : [];

  const realizedRows = analytics?.realizedViews[timeframe] ?? [];

  return (
    <section className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Realized performance grouped by close date</p>
          <h2>Dashboard</h2>
        </div>
        <div className="pill-row">
          {(['daily', 'weekly', 'monthly', 'yearly'] as RealizedTimeframe[]).map((item) => (
            <button
              key={item}
              className={item === timeframe ? 'pill pill-active' : 'pill'}
              onClick={() => setTimeframe(item)}
              type="button"
            >
              {item[0].toUpperCase() + item.slice(1)}
            </button>
          ))}
        </div>
      </header>

      {error && <div className="error-banner">{error}</div>}

      {!analytics && !error && <div className="empty-state">Loading analytics…</div>}

      <div className="card-grid">
        {summaryCards.map((card) => (
          <article className={`stat-card stat-card-${card.tone}`} key={card.label}>
            <span>{card.label}</span>
            <strong>{card.value}</strong>
          </article>
        ))}
      </div>

      {analytics && (
        <div className="panel-grid">
          <section className="panel">
            <div className="panel-header">
              <h3>Performance slices</h3>
              <span className="muted">Bot, manual, side, and expectancy metrics</span>
            </div>
            <div className="metric-list">
              <div>
                <span>Bot realized P&L</span>
                <strong>{formatCurrency(analytics.summary.botRealizedPnL)}</strong>
              </div>
              <div>
                <span>Manual realized P&L</span>
                <strong>{formatCurrency(analytics.summary.manualRealizedPnL)}</strong>
              </div>
              <div>
                <span>Average winner</span>
                <strong>{formatCurrency(analytics.summary.averageWinner)}</strong>
              </div>
              <div>
                <span>Average loser</span>
                <strong>{formatCurrency(analytics.summary.averageLoser)}</strong>
              </div>
              <div>
                <span>Profit factor</span>
                <strong>{analytics.summary.profitFactor.toFixed(2)}</strong>
              </div>
              <div>
                <span>Expectancy</span>
                <strong>{formatCurrency(analytics.summary.expectancy)}</strong>
              </div>
              <div>
                <span>Max drawdown</span>
                <strong>{formatCurrency(analytics.drawdown.maxDrawdown)}</strong>
              </div>
              <div>
                <span>Worst losing streak</span>
                <strong>{analytics.drawdown.worstLosingStreak} days</strong>
              </div>
            </div>
          </section>

          <section className="panel">
            <div className="panel-header">
              <h3>{timeframe[0].toUpperCase() + timeframe.slice(1)} realized view</h3>
              <span className="muted">Closed positions only</span>
            </div>
            {realizedRows.length === 0 ? (
              <div className="empty-state compact-empty">Import transactions to see realized buckets.</div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Bucket</th>
                    <th>Trades</th>
                    <th>Wins</th>
                    <th>Losses</th>
                    <th>Realized P&L</th>
                  </tr>
                </thead>
                <tbody>
                  {realizedRows.map((row) => (
                    <tr key={row.bucket}>
                      <td>{row.bucket}</td>
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

          <section className="panel">
            <div className="panel-header">
              <h3>Strategy ranking</h3>
              <span className="muted">Grouped by side and strategy type</span>
            </div>
            {analytics.strategyBreakdown.length === 0 ? (
              <div className="empty-state compact-empty">No closed trades yet.</div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Side</th>
                    <th>Strategy</th>
                    <th>Trades</th>
                    <th>Wins</th>
                    <th>Realized P&L</th>
                  </tr>
                </thead>
                <tbody>
                  {analytics.strategyBreakdown.slice(0, 8).map((row) => (
                    <tr key={`${row.positionSide}-${row.strategyType}`}>
                      <td>{row.positionSide}</td>
                      <td>
                        <button className="table-link" onClick={() => onStrategySelect(row)} type="button">
                          {row.strategyType}
                        </button>
                      </td>
                      <td>{row.trades}</td>
                      <td>{row.wins}</td>
                      <td>{formatCurrency(row.realizedPnL)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          <section className="panel">
            <div className="panel-header">
              <h3>Equity curve</h3>
              <span className="muted">Cumulative realized P&L</span>
            </div>
            {analytics.equityCurve.length === 0 ? (
              <div className="empty-state compact-empty">No closed trades for the current filter.</div>
            ) : (
              <LineChart
                points={analytics.equityCurve.map((point) => ({ x: point.date, y: point.cumulativePnL }))}
                formatY={formatCurrency}
              />
            )}
          </section>

          <section className="panel">
            <div className="panel-header">
              <h3>Bot vs manual</h3>
              <span className="muted">Source comparison</span>
            </div>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Source</th>
                  <th>Trades</th>
                  <th>Win Rate</th>
                  <th>Expectancy</th>
                  <th>P&L</th>
                </tr>
              </thead>
              <tbody>
                {analytics.botManualBreakdown.map((row) => (
                  <tr key={row.source}>
                    <td>{row.source}</td>
                    <td>{row.trades}</td>
                    <td>{formatPercent(row.winRate)}</td>
                    <td>{formatCurrency(row.expectancy)}</td>
                    <td>{formatCurrency(row.realizedPnL)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section className="panel">
            <div className="panel-header">
              <h3>Day of week</h3>
              <span className="muted">Closed-trade performance</span>
            </div>
            <div className="dow-chart">
              {analytics.dayOfWeekBreakdown.map((row) => {
                const maxMagnitude = Math.max(...analytics.dayOfWeekBreakdown.map((item) => Math.abs(item.realizedPnL)), 1);
                const height = Math.max(8, (Math.abs(row.realizedPnL) / maxMagnitude) * 120);

                return (
                  <div className="dow-bar-column" key={row.day}>
                    <span className="dow-value">{formatCurrency(row.realizedPnL)}</span>
                    <span
                      className={row.realizedPnL >= 0 ? 'dow-bar dow-bar-positive' : 'dow-bar dow-bar-negative'}
                      style={{ height }}
                      title={`${row.label}: ${formatCurrency(row.realizedPnL)}, ${row.trades} trades, ${formatPercent(row.winRate)} win rate`}
                    />
                    <span className="dow-label">{row.label}</span>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="panel">
            <div className="panel-header">
              <h3>Holding period</h3>
              <span className="muted">Days held vs P&L</span>
            </div>
            <ScatterPlot
              points={analytics.holdingPeriodPoints.map((point) => ({
                x: point.daysHeld,
                y: point.profit,
                label: `${point.closeDate} ${point.positionSide} ${point.stock} ${point.strategyType}`,
                tone: point.profit >= 0 ? 'positive' : 'negative'
              }))}
              formatY={formatCurrency}
            />
          </section>

          <section className="panel">
            <div className="panel-header">
              <h3>Streaks</h3>
              <span className="muted">Filtered closed trades</span>
            </div>
            <div className="mini-stat-grid">
              <div>
                <span>Current</span>
                <strong>{analytics.streaks.currentType === 'None' ? '—' : `${analytics.streaks.currentLength} ${analytics.streaks.currentType}`}</strong>
              </div>
              <div>
                <span>Longest Win</span>
                <strong>{analytics.streaks.longestWin}</strong>
              </div>
              <div>
                <span>Longest Loss</span>
                <strong>{analytics.streaks.longestLoss}</strong>
              </div>
              <div>
                <span>Avg Win</span>
                <strong>{analytics.streaks.averageWinStreak.toFixed(1)}</strong>
              </div>
              <div>
                <span>Avg Loss</span>
                <strong>{analytics.streaks.averageLossStreak.toFixed(1)}</strong>
              </div>
            </div>
          </section>

          <section className="panel">
            <div className="panel-header">
              <h3>Outlier impact</h3>
              <span className="muted">Best and worst {analytics.tradeExtremes.limit}</span>
            </div>
            <div className="metric-list">
              <div>
                <span>Total P&L</span>
                <strong>{formatCurrency(analytics.tradeExtremes.totalPnL)}</strong>
              </div>
              <div>
                <span>Without worst {analytics.tradeExtremes.limit}</span>
                <strong>{formatCurrency(analytics.tradeExtremes.withoutWorst)}</strong>
              </div>
              <div>
                <span>Without best {analytics.tradeExtremes.limit}</span>
                <strong>{formatCurrency(analytics.tradeExtremes.withoutBest)}</strong>
              </div>
            </div>
          </section>

          <section className="panel full-panel">
            <div className="panel-header">
              <h3>Best and worst trades</h3>
              <span className="muted">Outliers in the current filter</span>
            </div>
            <div className="extremes-grid">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Best</th>
                    <th>Strategy</th>
                    <th>P&L</th>
                  </tr>
                </thead>
                <tbody>
                  {analytics.tradeExtremes.winners.map((trade) => (
                    <tr key={trade.id}>
                      <td>{trade.closeDate}</td>
                      <td>{trade.stock} {trade.strategyType}</td>
                      <td>{formatCurrency(trade.profit)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Worst</th>
                    <th>Strategy</th>
                    <th>P&L</th>
                  </tr>
                </thead>
                <tbody>
                  {analytics.tradeExtremes.losers.map((trade) => (
                    <tr key={trade.id}>
                      <td>{trade.closeDate}</td>
                      <td>{trade.stock} {trade.strategyType}</td>
                      <td>{formatCurrency(trade.profit)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="panel full-panel">
            <div className="panel-header">
              <h3>Calendar heatmap</h3>
              <span className="muted">Daily realized P&L</span>
            </div>
            <div className="calendar-grid">
              {analytics.calendarHeatmap.slice(-90).map((day) => (
                <button
                  className={day.realizedPnL >= 0 ? 'calendar-day calendar-day-positive' : 'calendar-day calendar-day-negative'}
                  key={day.date}
                  onClick={() => onDaySelect(day.date)}
                  title={`${day.date}: ${formatCurrency(day.realizedPnL)} across ${day.trades} trades`}
                  type="button"
                >
                  {new Date(`${day.date}T00:00:00`).getDate()}
                </button>
              ))}
            </div>
          </section>
          
          <section className="panel">
            <div className="panel-header">
              <h3>Stock breakdown</h3>
              <span className="muted">Ticker-level realized performance</span>
            </div>
            {analytics.stockBreakdown.length === 0 ? (
              <div className="empty-state compact-empty">No ticker analytics yet.</div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Stock</th>
                    <th>Trades</th>
                    <th>Realized P&L</th>
                  </tr>
                </thead>
                <tbody>
                  {analytics.stockBreakdown.slice(0, 8).map((row) => (
                    <tr key={row.stock}>
                      <td>
                        <button className="table-link" onClick={() => onStockSelect(row.stock)} type="button">
                          {row.stock}
                        </button>
                      </td>
                      <td>{row.trades}</td>
                      <td>{formatCurrency(row.realizedPnL)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        </div>
      )}
    </section>
  );
}
