import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

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

type DashboardSection = 'overview' | 'performance' | 'breakdowns' | 'calendar' | 'risk';

const dashboardSections: Array<{ id: DashboardSection; label: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'performance', label: 'Performance' },
  { id: 'breakdowns', label: 'Breakdowns' },
  { id: 'calendar', label: 'Calendar' },
  { id: 'risk', label: 'Risk' }
];

const timeframes: RealizedTimeframe[] = ['daily', 'weekly', 'monthly', 'yearly'];

function SectionHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="panel-header">
      <div>
        <h3>{title}</h3>
        <span className="muted">{subtitle}</span>
      </div>
    </div>
  );
}

function ValueTile({ label, value, tone = 'neutral' }: { label: string; value: string; tone?: 'positive' | 'negative' | 'neutral' }) {
  return (
    <article className={`stat-card stat-card-${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

function CompactMetricList({
  rows
}: {
  rows: Array<{ label: string; value: string; tone?: 'positive' | 'negative' | 'neutral' }>;
}) {
  return (
    <div className="metric-list">
      {rows.map((row) => (
        <div key={row.label}>
          <span>{row.label}</span>
          <strong className={row.tone ? `text-${row.tone}` : undefined}>{row.value}</strong>
        </div>
      ))}
    </div>
  );
}

function TableShell({ children, empty }: { children: ReactNode; empty?: boolean }) {
  if (empty) {
    return <div className="empty-state compact-empty">No data for the current filter.</div>;
  }

  return <div className="table-scroll">{children}</div>;
}

export function DashboardPage({ filters, onDaySelect, onStockSelect, onStrategySelect }: DashboardPageProps) {
  const [timeframe, setTimeframe] = useState<RealizedTimeframe>('monthly');
  const [activeSection, setActiveSection] = useState<DashboardSection>('overview');
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

  const realizedRows = analytics?.realizedViews[timeframe] ?? [];
  const topStrategies = useMemo(() => analytics?.strategyBreakdown.slice(0, 10) ?? [], [analytics]);
  const topStocks = useMemo(() => analytics?.stockBreakdown.slice(0, 10) ?? [], [analytics]);

  return (
    <section className="page dashboard-page">
      <header className="page-header dashboard-hero">
        <div>
          <p className="eyebrow">Realized performance grouped by close date</p>
          <h2>Dashboard</h2>
        </div>
      </header>

      {error && <div className="error-banner">{error}</div>}
      {!analytics && !error && <div className="empty-state">Loading analytics...</div>}

      {analytics && (
        <>
          <div className="card-grid dashboard-summary">
            <ValueTile
              label="Realized P&L"
              value={formatCurrency(analytics.summary.realizedPnL)}
              tone={analytics.summary.realizedPnL >= 0 ? 'positive' : 'negative'}
            />
            <ValueTile label="Closed Trades" value={String(analytics.summary.totalClosedTrades)} />
            <ValueTile label="Win Rate" value={formatPercent(analytics.summary.winRate)} />
            <ValueTile label="Open Positions" value={String(analytics.summary.totalOpenPositions)} />
            <ValueTile label="Profit Factor" value={analytics.summary.profitFactor.toFixed(2)} />
            <ValueTile
              label="Expectancy"
              value={formatCurrency(analytics.summary.expectancy)}
              tone={analytics.summary.expectancy >= 0 ? 'positive' : 'negative'}
            />
          </div>

          <nav className="section-tabs" aria-label="Dashboard sections">
            {dashboardSections.map((section) => (
              <button
                className={section.id === activeSection ? 'section-tab section-tab-active' : 'section-tab'}
                key={section.id}
                onClick={() => setActiveSection(section.id)}
                type="button"
              >
                {section.label}
              </button>
            ))}
          </nav>

          {activeSection === 'overview' && (
            <div className="dashboard-layout">
              <section className="panel panel-large">
                <SectionHeader title="Equity curve" subtitle="Cumulative realized P&L" />
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
                <SectionHeader title="Performance quality" subtitle="Outcome shape" />
                <CompactMetricList
                  rows={[
                    { label: 'Average winner', value: formatCurrency(analytics.summary.averageWinner), tone: 'positive' },
                    { label: 'Average loser', value: formatCurrency(analytics.summary.averageLoser), tone: 'negative' },
                    { label: 'Largest winner', value: formatCurrency(analytics.summary.largestWinner), tone: 'positive' },
                    { label: 'Largest loser', value: formatCurrency(analytics.summary.largestLoser), tone: 'negative' },
                    { label: 'Total fees', value: formatCurrency(analytics.summary.totalFees), tone: 'negative' },
                    { label: 'Max drawdown', value: formatCurrency(analytics.drawdown.maxDrawdown), tone: 'negative' }
                  ]}
                />
              </section>

              <section className="panel">
                <SectionHeader title="Source split" subtitle="Bot and manual contribution" />
                <CompactMetricList
                  rows={[
                    {
                      label: 'Bot realized P&L',
                      value: formatCurrency(analytics.summary.botRealizedPnL),
                      tone: analytics.summary.botRealizedPnL >= 0 ? 'positive' : 'negative'
                    },
                    {
                      label: 'Manual realized P&L',
                      value: formatCurrency(analytics.summary.manualRealizedPnL),
                      tone: analytics.summary.manualRealizedPnL >= 0 ? 'positive' : 'negative'
                    },
                    {
                      label: 'Long realized P&L',
                      value: formatCurrency(analytics.summary.longRealizedPnL),
                      tone: analytics.summary.longRealizedPnL >= 0 ? 'positive' : 'negative'
                    },
                    {
                      label: 'Short realized P&L',
                      value: formatCurrency(analytics.summary.shortRealizedPnL),
                      tone: analytics.summary.shortRealizedPnL >= 0 ? 'positive' : 'negative'
                    }
                  ]}
                />
              </section>
            </div>
          )}

          {activeSection === 'performance' && (
            <div className="dashboard-layout">
              <section className="panel panel-large">
                <div className="panel-header split-panel-header">
                  <div>
                    <h3>{timeframe[0].toUpperCase() + timeframe.slice(1)} realized view</h3>
                    <span className="muted">Closed positions only</span>
                  </div>
                  <div className="pill-row">
                    {timeframes.map((item) => (
                      <button
                        className={item === timeframe ? 'pill pill-active' : 'pill'}
                        key={item}
                        onClick={() => setTimeframe(item)}
                        type="button"
                      >
                        {item[0].toUpperCase() + item.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>
                <TableShell empty={realizedRows.length === 0}>
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
                </TableShell>
              </section>

              <section className="panel">
                <SectionHeader title="Day of week" subtitle="Closed-trade performance" />
                <div className="dow-chart">
                  {analytics.dayOfWeekBreakdown.map((row) => {
                    const maxMagnitude = Math.max(...analytics.dayOfWeekBreakdown.map((item) => Math.abs(item.realizedPnL)), 1);
                    const height = Math.max(8, (Math.abs(row.realizedPnL) / maxMagnitude) * 120);

                    return (
                      <div className="dow-bar-column" key={row.day}>
                        <span
                          className={row.realizedPnL >= 0 ? 'dow-bar dow-bar-positive' : 'dow-bar dow-bar-negative'}
                          style={{ height }}
                          title={`${row.label}: ${formatCurrency(row.realizedPnL)}, ${row.trades} trades, ${formatPercent(row.winRate)} win rate`}
                        />
                        <span className="dow-label">{row.label.slice(0, 3)}</span>
                        <span className="dow-value">{formatCurrency(row.realizedPnL)}</span>
                      </div>
                    );
                  })}
                </div>
              </section>

              <section className="panel panel-large">
                <SectionHeader title="Holding period" subtitle="Days held vs P&L" />
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
            </div>
          )}

          {activeSection === 'breakdowns' && (
            <div className="dashboard-layout">
              <section className="panel panel-large">
                <SectionHeader title="Strategy ranking" subtitle="Grouped by side and strategy type" />
                <TableShell empty={topStrategies.length === 0}>
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
                      {topStrategies.map((row) => (
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
                </TableShell>
              </section>

              <section className="panel">
                <SectionHeader title="Stock breakdown" subtitle="Ticker-level realized performance" />
                <TableShell empty={topStocks.length === 0}>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Stock</th>
                        <th>Trades</th>
                        <th>Realized P&L</th>
                      </tr>
                    </thead>
                    <tbody>
                      {topStocks.map((row) => (
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
                </TableShell>
              </section>

              <section className="panel">
                <SectionHeader title="Bot vs manual" subtitle="Source comparison" />
                <TableShell empty={analytics.botManualBreakdown.length === 0}>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Source</th>
                        <th>Trades</th>
                        <th>Win Rate</th>
                        <th>P&L</th>
                      </tr>
                    </thead>
                    <tbody>
                      {analytics.botManualBreakdown.map((row) => (
                        <tr key={row.source}>
                          <td>{row.source}</td>
                          <td>{row.trades}</td>
                          <td>{formatPercent(row.winRate)}</td>
                          <td>{formatCurrency(row.realizedPnL)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </TableShell>
              </section>
            </div>
          )}

          {activeSection === 'calendar' && (
            <div className="dashboard-layout">
              <section className="panel panel-large">
                <SectionHeader title="Calendar heatmap" subtitle="Daily realized P&L, latest 90 trading days" />
                {analytics.calendarHeatmap.length === 0 ? (
                  <div className="empty-state compact-empty">No calendar data for the current filter.</div>
                ) : (
                  <div className="calendar-grid spacious-calendar">
                    {analytics.calendarHeatmap.slice(-90).map((day) => (
                      <button
                        className={day.realizedPnL >= 0 ? 'calendar-day calendar-day-positive' : 'calendar-day calendar-day-negative'}
                        key={day.date}
                        onClick={() => onDaySelect(day.date)}
                        title={`${day.date}: ${formatCurrency(day.realizedPnL)} across ${day.trades} trades`}
                        type="button"
                      >
                        <span>{new Date(`${day.date}T00:00:00`).getDate()}</span>
                        <small>{formatCurrency(day.realizedPnL)}</small>
                      </button>
                    ))}
                  </div>
                )}
              </section>
            </div>
          )}

          {activeSection === 'risk' && (
            <div className="dashboard-layout">
              <section className="panel">
                <SectionHeader title="Streaks" subtitle="Filtered closed trades" />
                <div className="mini-stat-grid">
                  <div>
                    <span>Current</span>
                    <strong>{analytics.streaks.currentType === 'None' ? '-' : `${analytics.streaks.currentLength} ${analytics.streaks.currentType}`}</strong>
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
                <SectionHeader title="Outlier impact" subtitle={`Best and worst ${analytics.tradeExtremes.limit}`} />
                <CompactMetricList
                  rows={[
                    { label: 'Total P&L', value: formatCurrency(analytics.tradeExtremes.totalPnL) },
                    { label: `Without worst ${analytics.tradeExtremes.limit}`, value: formatCurrency(analytics.tradeExtremes.withoutWorst) },
                    { label: `Without best ${analytics.tradeExtremes.limit}`, value: formatCurrency(analytics.tradeExtremes.withoutBest) }
                  ]}
                />
              </section>

              <section className="panel panel-large">
                <SectionHeader title="Best and worst trades" subtitle="Outliers in the current filter" />
                <div className="extremes-grid">
                  <TableShell empty={analytics.tradeExtremes.winners.length === 0}>
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
                            <td>
                              {trade.stock} {trade.strategyType}
                            </td>
                            <td>{formatCurrency(trade.profit)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </TableShell>
                  <TableShell empty={analytics.tradeExtremes.losers.length === 0}>
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
                            <td>
                              {trade.stock} {trade.strategyType}
                            </td>
                            <td>{formatCurrency(trade.profit)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </TableShell>
                </div>
              </section>
            </div>
          )}
        </>
      )}
    </section>
  );
}
