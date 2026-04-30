import { useEffect, useState } from 'react';

import type { PositionGroupDetail, PositionGroupRow, TransactionRecord } from '@trade-journal/shared';

import { getPositionGroup, getPositionGroups } from '../lib/api';
import { emptyText, formatCurrency, formatPercent } from '../lib/format';

interface PositionsPageProps {
  onTradeSelect: (trade: TransactionRecord) => void;
}

export function PositionsPage({ onTradeSelect }: PositionsPageProps) {
  const [groups, setGroups] = useState<PositionGroupRow[]>([]);
  const [selected, setSelected] = useState<PositionGroupDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getPositionGroups()
      .then((response) => {
        setGroups(response.items);
        setError(null);
      })
      .catch((requestError: Error) => setError(requestError.message));
  }, []);

  async function loadGroup(groupKey: string) {
    try {
      const response = await getPositionGroup(groupKey);
      setSelected(response);
      setError(null);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Failed to load position.');
    }
  }

  if (selected) {
    return (
      <section className="page">
        <header className="page-header">
          <div>
            <p className="eyebrow">Position lifecycle</p>
            <h2>{selected.label}</h2>
          </div>
          <button className="ghost-button" onClick={() => setSelected(null)} type="button">
            Back to positions
          </button>
        </header>

        <div className="card-grid">
          <article className={selected.summary.realizedPnL >= 0 ? 'stat-card stat-card-positive' : 'stat-card stat-card-negative'}>
            <span>Total P&L</span>
            <strong>{formatCurrency(selected.summary.realizedPnL)}</strong>
          </article>
          <article className="stat-card">
            <span>Trades</span>
            <strong>{selected.lifecycle.length}</strong>
          </article>
          <article className="stat-card">
            <span>Win Rate</span>
            <strong>{formatPercent(selected.summary.winRate)}</strong>
          </article>
          <article className="stat-card">
            <span>Fees</span>
            <strong>{formatCurrency(selected.summary.totalFees)}</strong>
          </article>
        </div>

        <section className="panel full-panel">
          <div className="panel-header">
            <h3>Lifecycle</h3>
            <span className="muted">{selected.isOpen ? 'Open' : `Closed ${selected.closedAt}`}</span>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Close</th>
                <th>Strategy</th>
                <th>Strikes</th>
                <th>Profit</th>
                <th>Tags</th>
                <th>Exit</th>
              </tr>
            </thead>
            <tbody>
              {selected.lifecycle.map((trade) => (
                <tr key={trade.id}>
                  <td>
                    <button className="table-link" onClick={() => onTradeSelect(trade)} type="button">
                      {trade.dateOpened}
                    </button>
                  </td>
                  <td>{trade.closeDate ?? 'Open'}</td>
                  <td>{trade.strategyType}</td>
                  <td>{emptyText(trade.strikes)}</td>
                  <td>{trade.closeDate ? formatCurrency(trade.profit) : 'Excluded'}</td>
                  <td>{trade.tags.length ? trade.tags.join(', ') : '—'}</td>
                  <td>{emptyText(trade.exitReason)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </section>
    );
  }

  return (
    <section className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Grouped trades</p>
          <h2>Positions</h2>
        </div>
      </header>

      {error && <div className="error-banner">{error}</div>}

      <section className="panel full-panel">
        <table className="data-table">
          <thead>
            <tr>
              <th>Position</th>
              <th>Opened</th>
              <th>Closed</th>
              <th>Trades</th>
              <th>P&L</th>
              <th>Tags</th>
            </tr>
          </thead>
          <tbody>
            {groups.map((group) => (
              <tr key={group.groupKey}>
                <td>
                  <button className="table-link" onClick={() => loadGroup(group.groupKey)} type="button">
                    {group.label}
                  </button>
                </td>
                <td>{group.openedAt}</td>
                <td>{group.closedAt ?? 'Open'}</td>
                <td>{group.trades}</td>
                <td>{formatCurrency(group.realizedPnL)}</td>
                <td>{group.tags.length ? group.tags.join(', ') : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </section>
  );
}
