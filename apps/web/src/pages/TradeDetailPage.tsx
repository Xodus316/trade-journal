import type { TransactionRecord } from '@trade-journal/shared';

import { emptyText, formatCurrency } from '../lib/format';

interface TradeDetailPageProps {
  trade: TransactionRecord;
  onBack: () => void;
}

export function TradeDetailPage({ trade, onBack }: TradeDetailPageProps) {
  return (
    <section className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Trade detail</p>
          <h2>
            {trade.stock} {trade.positionSide} {trade.strategyType}
          </h2>
        </div>
        <button className="ghost-button" onClick={onBack} type="button">
          Back
        </button>
      </header>

      <div className="card-grid">
        <article className={`stat-card ${trade.profit && trade.profit >= 0 ? 'stat-card-positive' : 'stat-card-negative'}`}>
          <span>Profit</span>
          <strong>{trade.closeDate ? formatCurrency(trade.profit) : 'Open'}</strong>
        </article>
        <article className="stat-card">
          <span>Status</span>
          <strong>{trade.closeDate ? 'Closed' : 'Open'}</strong>
        </article>
        <article className="stat-card">
          <span>Contracts</span>
          <strong>{trade.contracts}</strong>
        </article>
        <article className="stat-card">
          <span>Source</span>
          <strong>{trade.botOpened ? 'Bot' : 'Manual'}</strong>
        </article>
      </div>

      <section className="panel full-panel">
        <div className="panel-header">
          <h3>Lifecycle</h3>
          <span className="muted">{trade.positionGroup ?? (trade.manuallyEdited ? 'Edited after import' : 'Original import values')}</span>
        </div>
        <dl className="detail-list">
          <div>
            <dt>Open date</dt>
            <dd>{trade.dateOpened}</dd>
          </div>
          <div>
            <dt>Expiration</dt>
            <dd>{emptyText(trade.expiration)}</dd>
          </div>
          <div>
            <dt>Close date</dt>
            <dd>{trade.closeDate ?? 'Open'}</dd>
          </div>
          <div>
            <dt>Strikes</dt>
            <dd>{emptyText(trade.strikes)}</dd>
          </div>
          <div>
            <dt>Opening price</dt>
            <dd>{formatCurrency(trade.openingPrice)}</dd>
          </div>
          <div>
            <dt>Closing price</dt>
            <dd>{formatCurrency(trade.closingPrice)}</dd>
          </div>
          <div>
            <dt>Fees</dt>
            <dd>{formatCurrency(Math.abs(trade.fees))}</dd>
          </div>
          <div>
            <dt>Max risk</dt>
            <dd>{formatCurrency(trade.maxRisk)}</dd>
          </div>
          <div>
            <dt>Return on risk</dt>
            <dd>{trade.returnOnRisk === null ? '—' : `${trade.returnOnRisk.toFixed(2)}%`}</dd>
          </div>
          <div>
            <dt>Profit target</dt>
            <dd>{formatCurrency(trade.profitTarget)}</dd>
          </div>
          <div>
            <dt>Percent of target</dt>
            <dd>{trade.percentMaxProfit === null ? '—' : `${trade.percentMaxProfit.toFixed(2)}%`}</dd>
          </div>
          <div>
            <dt>Stop loss</dt>
            <dd>{formatCurrency(trade.stopLoss)}</dd>
          </div>
          <div>
            <dt>Exit reason</dt>
            <dd>{emptyText(trade.exitReason)}</dd>
          </div>
          <div>
            <dt>Tags</dt>
            <dd>{trade.tags.length ? trade.tags.join(', ') : '—'}</dd>
          </div>
          <div>
            <dt>Import file</dt>
            <dd>{emptyText(trade.sourceFileName)}</dd>
          </div>
          <div>
            <dt>Notes</dt>
            <dd>{emptyText(trade.notes)}</dd>
          </div>
          <div>
            <dt>Review</dt>
            <dd>{emptyText(trade.reviewNotes)}</dd>
          </div>
          <div>
            <dt>Lesson learned</dt>
            <dd>{emptyText(trade.lessonLearned)}</dd>
          </div>
        </dl>
      </section>
    </section>
  );
}
