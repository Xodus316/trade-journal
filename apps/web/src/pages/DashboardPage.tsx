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

type DashboardSection = 'overview' | 'performance' | 'options' | 'breakdowns' | 'calendar' | 'risk' | 'review';

const dashboardSections: Array<{ id: DashboardSection; label: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'performance', label: 'Performance' },
  { id: 'options', label: 'Options' },
  { id: 'breakdowns', label: 'Breakdowns' },
  { id: 'calendar', label: 'Calendar' },
  { id: 'risk', label: 'Risk' },
  { id: 'review', label: 'Review' }
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

function PerformanceRowsTable({
  rows,
  labelHeader = 'Group'
}: {
  rows: Array<{ label: string; trades: number; winRate: number; expectancy: number; realizedPnL: number }>;
  labelHeader?: string;
}) {
  return (
    <TableShell empty={rows.length === 0}>
      <table className="data-table">
        <thead>
          <tr>
            <th>{labelHeader}</th>
            <th>Trades</th>
            <th>Win Rate</th>
            <th>Expectancy</th>
            <th>P&L</th>
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, 10).map((row) => (
            <tr key={row.label}>
              <td>{row.label}</td>
              <td>{row.trades}</td>
              <td>{formatPercent(row.winRate)}</td>
              <td>{formatCurrency(row.expectancy)}</td>
              <td>{formatCurrency(row.realizedPnL)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </TableShell>
  );
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

              <section className="panel">
                <SectionHeader title="Rolling expectancy" subtitle="Last 20 closed trades" />
                {analytics.rollingExpectancy.filter((point) => point.expectancy20 !== null).length === 0 ? (
                  <div className="empty-state compact-empty">At least 20 closed trades are needed.</div>
                ) : (
                  <LineChart
                    points={analytics.rollingExpectancy
                      .filter((point) => point.expectancy20 !== null)
                      .slice(-160)
                      .map((point) => ({ x: point.date, y: point.expectancy20 ?? 0 }))}
                    formatY={formatCurrency}
                  />
                )}
              </section>
            </div>
          )}

          {activeSection === 'options' && (
            <div className="dashboard-layout">
              <section className="panel">
                <SectionHeader title="DTE analysis" subtitle="Profitability by days to expiration" />
                <PerformanceRowsTable rows={analytics.optionAnalytics.dteBreakdown} labelHeader="DTE" />
              </section>

              <section className="panel">
                <SectionHeader title="Expiration weekday" subtitle="Performance by expiration day" />
                <PerformanceRowsTable rows={analytics.optionAnalytics.expirationWeekdayBreakdown} labelHeader="Weekday" />
              </section>

              <section className="panel">
                <SectionHeader title="Spread width" subtitle="Strike distance analysis" />
                <PerformanceRowsTable rows={analytics.optionAnalytics.spreadWidthBreakdown} labelHeader="Width" />
              </section>

              <section className="panel">
                <SectionHeader title="Credit vs debit" subtitle="Open premium efficiency" />
                <PerformanceRowsTable rows={analytics.optionAnalytics.creditDebitBreakdown} labelHeader="Open Type" />
              </section>

              <section className="panel panel-large">
                <SectionHeader title="Leg count" subtitle="Single-leg vs multi-leg performance" />
                <PerformanceRowsTable rows={analytics.optionAnalytics.legCountBreakdown} labelHeader="Legs" />
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

              <section className="panel">
                <SectionHeader title="Broker P&L" subtitle="Realized performance by broker" />
                <PerformanceRowsTable rows={analytics.brokerBreakdown} labelHeader="Broker" />
              </section>

              <section className="panel panel-large">
                <SectionHeader title="Strategy decay" subtitle="Recent expectancy versus prior expectancy" />
                <TableShell empty={analytics.strategyDecay.length === 0}>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Strategy</th>
                        <th>Recent</th>
                        <th>Prior</th>
                        <th>Delta</th>
                        <th>Trend</th>
                      </tr>
                    </thead>
                    <tbody>
                      {analytics.strategyDecay.slice(0, 12).map((row) => (
                        <tr key={`${row.positionSide}-${row.strategyType}`}>
                          <td>
                            {row.positionSide} {row.strategyType}
                          </td>
                          <td>{formatCurrency(row.recentExpectancy)}</td>
                          <td>{formatCurrency(row.priorExpectancy)}</td>
                          <td>{formatCurrency(row.delta)}</td>
                          <td>{row.trend}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </TableShell>
              </section>

              <section className="panel panel-large">
                <SectionHeader title="Best setup combinations" subtitle="Stock + strategy + side + DTE + source" />
                <TableShell empty={analytics.bestSetupCombinations.length === 0}>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Setup</th>
                        <th>Trades</th>
                        <th>Expectancy</th>
                        <th>Win Rate</th>
                        <th>P&L</th>
                      </tr>
                    </thead>
                    <tbody>
                      {analytics.bestSetupCombinations.slice(0, 12).map((row) => (
                        <tr key={row.label}>
                          <td>
                            {row.stock} {row.positionSide} {row.strategyType} · {row.dteBucket} · {row.source}
                          </td>
                          <td>{row.trades}</td>
                          <td>{formatCurrency(row.expectancy)}</td>
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
                <SectionHeader title="Consistency score" subtitle="Win rate, expectancy, drawdown, and profit factor" />
                <div className="mini-stat-grid">
                  <div>
                    <span>Score</span>
                    <strong>{analytics.consistency.score}/100</strong>
                  </div>
                  <div>
                    <span>Volatility</span>
                    <strong>{formatCurrency(analytics.consistency.returnVolatility)}</strong>
                  </div>
                  <div>
                    <span>Drawdown Score</span>
                    <strong>{analytics.consistency.drawdownScore}</strong>
                  </div>
                  <div>
                    <span>Expectancy Score</span>
                    <strong>{analytics.consistency.expectancyScore}</strong>
                  </div>
                </div>
              </section>

              <section className="panel full-panel">
                <SectionHeader title="Sizing review" subtitle="Performance by contract/share size" />
                <TableShell empty={analytics.positionSizing.length === 0}>
                  <table className="data-table sizing-table">
                    <thead>
                      <tr>
                        <th>Size</th>
                        <th>Trades</th>
                        <th>Avg Qty</th>
                        <th>Expectancy</th>
                        <th>P&L</th>
                      </tr>
                    </thead>
                    <tbody>
                      {analytics.positionSizing.map((row) => (
                        <tr key={row.label}>
                          <td>{row.label}</td>
                          <td>{row.trades}</td>
                          <td>{row.averageContracts}</td>
                          <td>{formatCurrency(row.expectancy)}</td>
                          <td>{formatCurrency(row.realizedPnL)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </TableShell>
              </section>

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
                <SectionHeader title="Risk simulator" subtitle="Based on historical win rate and average win/loss" />
                <CompactMetricList
                  rows={[
                    { label: 'Breakeven win rate', value: formatPercent(analytics.riskSimulator.breakevenWinRate) },
                    { label: 'Chance of 3 losses', value: formatPercent(analytics.riskSimulator.probabilityThreeLosses) },
                    { label: 'Chance of 5 losses', value: formatPercent(analytics.riskSimulator.probabilityFiveLosses) },
                    { label: 'Chance of 10 losses', value: formatPercent(analytics.riskSimulator.probabilityTenLosses) },
                    { label: 'Expected 20-trade P&L', value: formatCurrency(analytics.riskSimulator.expectedTwentyTradePnL) }
                  ]}
                />
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
                <SectionHeader title="Rolling drawdown" subtitle="Current equity below prior peak" />
                {analytics.drawdownCurve.length === 0 ? (
                  <div className="empty-state compact-empty">No drawdown data yet.</div>
                ) : (
                  <LineChart
                    points={analytics.drawdownCurve.map((point) => ({ x: point.date, y: point.drawdown }))}
                    formatY={formatCurrency}
                  />
                )}
              </section>

              <section className="panel panel-large">
                <SectionHeader title="What-if simulator" subtitle="Projected total P&L if selected weak areas were skipped" />
                <TableShell empty={analytics.whatIfScenarios.length === 0}>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Scenario</th>
                        <th>Trades Removed</th>
                        <th>New P&L</th>
                        <th>Impact</th>
                      </tr>
                    </thead>
                    <tbody>
                      {analytics.whatIfScenarios.map((row) => (
                        <tr key={row.label}>
                          <td>{row.label}</td>
                          <td>{row.tradesRemoved}</td>
                          <td>{formatCurrency(row.realizedPnL)}</td>
                          <td>{formatCurrency(row.delta)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </TableShell>
              </section>

              <section className="panel">
                <SectionHeader title="Monthly pace" subtitle="Latest month projection using observed trading days" />
                <CompactMetricList
                  rows={[
                    { label: 'Month', value: analytics.monthlyPace.month ?? '-' },
                    { label: 'Current P&L', value: formatCurrency(analytics.monthlyPace.currentPnL) },
                    { label: 'Avg daily P&L', value: formatCurrency(analytics.monthlyPace.averageDailyPnL) },
                    { label: 'Projected month', value: formatCurrency(analytics.monthlyPace.projectedMonthlyPnL) }
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

          {activeSection === 'review' && (
            <div className="dashboard-layout">
              <section className="panel">
                <SectionHeader title="Review completeness" subtitle="Notes, lessons, exit reasons, and tags" />
                <div className="mini-stat-grid">
                  <div>
                    <span>Reviewed</span>
                    <strong>{analytics.reviewAnalytics.reviewedTrades}</strong>
                  </div>
                  <div>
                    <span>Completion</span>
                    <strong>{formatPercent(analytics.reviewAnalytics.reviewCompletionRate)}</strong>
                  </div>
                  <div>
                    <span>Missing</span>
                    <strong>{analytics.reviewAnalytics.missingReviewTrades}</strong>
                  </div>
                  <div>
                    <span>No Review Note</span>
                    <strong>{analytics.reviewAnalytics.missingChartOrReviewNote}</strong>
                  </div>
                </div>
              </section>

              <section className="panel">
                <SectionHeader title="Mistake and tag analytics" subtitle="Performance by trade tags" />
                <PerformanceRowsTable rows={analytics.reviewAnalytics.tagBreakdown} labelHeader="Tag" />
              </section>

              <section className="panel">
                <SectionHeader title="Exit reasons" subtitle="How outcomes cluster by exit reason" />
                <PerformanceRowsTable rows={analytics.reviewAnalytics.exitReasonBreakdown} labelHeader="Reason" />
              </section>

              <section className="panel">
                <SectionHeader title="Lesson keywords" subtitle="Repeated words from lessons learned" />
                <PerformanceRowsTable rows={analytics.reviewAnalytics.lessonKeywordBreakdown} labelHeader="Keyword" />
              </section>

              <section className="panel panel-large">
                <SectionHeader title="Needs more data" subtitle="Analysis ideas that require additional imports or fields" />
                <TableShell empty={analytics.unsupportedAnalyses.length === 0}>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Analysis</th>
                        <th>Missing Data</th>
                      </tr>
                    </thead>
                    <tbody>
                      {analytics.unsupportedAnalyses.map((row) => (
                        <tr key={row.label}>
                          <td>{row.label}</td>
                          <td>{row.reason}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </TableShell>
              </section>
            </div>
          )}
        </>
      )}
    </section>
  );
}
