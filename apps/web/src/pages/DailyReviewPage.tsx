import { useEffect, useState } from 'react';

import type { DailyReviewResponse, TransactionRecord } from '@trade-journal/shared';

import { getDailyReview, saveDailyReview } from '../lib/api';
import { emptyText, formatCurrency, formatPercent } from '../lib/format';

interface DailyReviewPageProps {
  date: string;
  onBack: () => void;
  onTradeSelect: (trade: TransactionRecord) => void;
}

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read chart image.'));
    reader.readAsDataURL(file);
  });
}

export function DailyReviewPage({ date, onBack, onTradeSelect }: DailyReviewPageProps) {
  const [payload, setPayload] = useState<DailyReviewResponse | null>(null);
  const [notes, setNotes] = useState('');
  const [chartImageDataUrl, setChartImageDataUrl] = useState<string | null>(null);
  const [whatWentWell, setWhatWentWell] = useState('');
  const [whatWentPoorly, setWhatWentPoorly] = useState('');
  const [lessonLearned, setLessonLearned] = useState('');
  const [mood, setMood] = useState('');
  const [disciplineScore, setDisciplineScore] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    getDailyReview(date)
      .then((response) => {
        setPayload(response);
        setNotes(response.review?.notes ?? '');
        setChartImageDataUrl(response.review?.chartImageDataUrl ?? null);
        setWhatWentWell(response.review?.whatWentWell ?? '');
        setWhatWentPoorly(response.review?.whatWentPoorly ?? '');
        setLessonLearned(response.review?.lessonLearned ?? '');
        setMood(response.review?.mood ?? '');
        setDisciplineScore(response.review?.disciplineScore ?? null);
        setError(null);
      })
      .catch((requestError: Error) => setError(requestError.message));
  }, [date]);

  async function saveReview() {
    try {
      const review = await saveDailyReview(date, {
        notes: notes.trim() || null,
        chartImageDataUrl,
        whatWentWell: whatWentWell.trim() || null,
        whatWentPoorly: whatWentPoorly.trim() || null,
        lessonLearned: lessonLearned.trim() || null,
        mood: mood.trim() || null,
        disciplineScore
      });
      setPayload((current) => (current ? { ...current, review } : current));
      setMessage('Daily review saved.');
      setError(null);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Failed to save daily review.');
    }
  }

  return (
    <section className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Calendar drilldown</p>
          <h2>{date}</h2>
        </div>
        <button className="ghost-button" onClick={onBack} type="button">
          Back to dashboard
        </button>
      </header>

      {error && <div className="error-banner">{error}</div>}
      {message && <div className="empty-state compact-empty">{message}</div>}
      {!payload && !error && <div className="empty-state">Loading daily review...</div>}

      {payload && (
        <>
          <div className="card-grid">
            <article className={payload.summary.realizedPnL >= 0 ? 'stat-card stat-card-positive' : 'stat-card stat-card-negative'}>
              <span>Daily P&L</span>
              <strong>{formatCurrency(payload.summary.realizedPnL)}</strong>
            </article>
            <article className="stat-card">
              <span>Trades</span>
              <strong>{payload.summary.totalClosedTrades}</strong>
            </article>
            <article className="stat-card">
              <span>Win Rate</span>
              <strong>{formatPercent(payload.summary.winRate)}</strong>
            </article>
            <article className="stat-card">
              <span>Fees</span>
              <strong>{formatCurrency(payload.summary.totalFees)}</strong>
            </article>
          </div>

          <div className="panel-grid">
            <section className="panel">
              <div className="panel-header">
                <h3>Daily chart</h3>
                <span className="muted">End-of-day reference</span>
              </div>
              {chartImageDataUrl ? (
                <img className="daily-chart-preview" src={chartImageDataUrl} alt={`Chart for ${date}`} />
              ) : (
                <div className="empty-state compact-empty">No chart attached.</div>
              )}
              <div className="toolbar split-toolbar">
                <label className="ghost-button file-button">
                  Add chart
                  <input
                    accept="image/*"
                    type="file"
                    onChange={async (event) => {
                      const file = event.target.files?.[0];
                      if (file) {
                        setChartImageDataUrl(await fileToDataUrl(file));
                      }
                    }}
                  />
                </label>
                <button className="ghost-button danger-button" onClick={() => setChartImageDataUrl(null)} type="button">
                  Remove
                </button>
              </div>
            </section>

            <section className="panel">
              <div className="panel-header">
                <h3>Review workflow</h3>
                <span className="muted">Process, mistakes, discipline, and lessons</span>
              </div>
              <div className="form-grid compact-form-grid">
                <label>
                  <span>Mood</span>
                  <input value={mood} onChange={(event) => setMood(event.target.value)} placeholder="Calm, rushed, patient" />
                </label>
                <label>
                  <span>Discipline</span>
                  <input
                    max={10}
                    min={1}
                    type="number"
                    value={disciplineScore ?? ''}
                    onChange={(event) => setDisciplineScore(event.target.value ? Number(event.target.value) : null)}
                  />
                </label>
              </div>
              <label className="stacked-field">
                <span>What went well</span>
                <textarea
                  className="review-textarea compact-textarea"
                  rows={4}
                  value={whatWentWell}
                  onChange={(event) => setWhatWentWell(event.target.value)}
                />
              </label>
              <label className="stacked-field">
                <span>What went poorly</span>
                <textarea
                  className="review-textarea compact-textarea"
                  rows={4}
                  value={whatWentPoorly}
                  onChange={(event) => setWhatWentPoorly(event.target.value)}
                />
              </label>
              <label className="stacked-field">
                <span>Lesson</span>
                <textarea
                  className="review-textarea compact-textarea"
                  rows={3}
                  value={lessonLearned}
                  onChange={(event) => setLessonLearned(event.target.value)}
                />
              </label>
              <label className="stacked-field">
                <span>Notes</span>
              <textarea
                className="review-textarea"
                  rows={5}
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
              />
              </label>
              <div className="toolbar">
                <button className="primary-button" onClick={saveReview} type="button">
                  Save Review
                </button>
              </div>
            </section>

            <section className="panel">
              <div className="panel-header">
                <h3>Strategy ranking</h3>
                <span className="muted">Closed trades for this day</span>
              </div>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Side</th>
                    <th>Strategy</th>
                    <th>Trades</th>
                    <th>P&L</th>
                  </tr>
                </thead>
                <tbody>
                  {payload.strategyBreakdown.map((row) => (
                    <tr key={`${row.positionSide}-${row.strategyType}`}>
                      <td>{row.positionSide}</td>
                      <td>{row.strategyType}</td>
                      <td>{row.trades}</td>
                      <td>{formatCurrency(row.realizedPnL)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>

            <section className="panel">
              <div className="panel-header">
                <h3>Stock ranking</h3>
                <span className="muted">Ticker contribution</span>
              </div>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Stock</th>
                    <th>Trades</th>
                    <th>P&L</th>
                  </tr>
                </thead>
                <tbody>
                  {payload.stockBreakdown.map((row) => (
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
                <span className="muted">{payload.trades.length} closed positions</span>
              </div>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Opened</th>
                    <th>Stock</th>
                    <th>Strategy</th>
                    <th>Strikes</th>
                    <th>Profit</th>
                    <th>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {payload.trades.map((trade) => (
                    <tr key={trade.id}>
                      <td>
                        <button className="table-link" onClick={() => onTradeSelect(trade)} type="button">
                          {trade.dateOpened}
                        </button>
                      </td>
                      <td>{trade.stock}</td>
                      <td>{trade.strategyType}</td>
                      <td>{emptyText(trade.strikes)}</td>
                      <td>{formatCurrency(trade.profit ?? 0)}</td>
                      <td>{emptyText(trade.notes)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          </div>
        </>
      )}
    </section>
  );
}
