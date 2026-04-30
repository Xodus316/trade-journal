import { useState } from 'react';

import { assignPositionGroup, renameStock, renameStrategy } from '../lib/api';

export function CleanupPage() {
  const [message, setMessage] = useState<string | null>(null);
  const [strategyFrom, setStrategyFrom] = useState('');
  const [strategyTo, setStrategyTo] = useState('');
  const [stockFrom, setStockFrom] = useState('');
  const [stockTo, setStockTo] = useState('');
  const [groupIds, setGroupIds] = useState('');
  const [positionGroup, setPositionGroup] = useState('');

  return (
    <section className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Data normalization</p>
          <h2>Cleanup Tools</h2>
        </div>
      </header>

      {message && <div className="empty-state">{message}</div>}

      <div className="panel-grid">
        <section className="panel">
          <div className="panel-header">
            <h3>Rename strategy</h3>
            <span className="muted">Normalize imported strategy names</span>
          </div>
          <div className="form-grid single-column-form">
            <label>
              <span>From</span>
              <input value={strategyFrom} onChange={(event) => setStrategyFrom(event.target.value)} />
            </label>
            <label>
              <span>To</span>
              <input value={strategyTo} onChange={(event) => setStrategyTo(event.target.value)} />
            </label>
            <button
              className="primary-button"
              onClick={async () => {
                const result = await renameStrategy(strategyFrom, strategyTo);
                setMessage(`Updated ${result.updated} strategy rows.`);
              }}
              type="button"
            >
              Rename strategy
            </button>
          </div>
        </section>

        <section className="panel">
          <div className="panel-header">
            <h3>Rename stock</h3>
            <span className="muted">Normalize tickers and futures symbols</span>
          </div>
          <div className="form-grid single-column-form">
            <label>
              <span>From</span>
              <input value={stockFrom} onChange={(event) => setStockFrom(event.target.value)} />
            </label>
            <label>
              <span>To</span>
              <input value={stockTo} onChange={(event) => setStockTo(event.target.value)} />
            </label>
            <button
              className="primary-button"
              onClick={async () => {
                const result = await renameStock(stockFrom, stockTo);
                setMessage(`Updated ${result.updated} stock rows.`);
              }}
              type="button"
            >
              Rename stock
            </button>
          </div>
        </section>

        <section className="panel full-panel">
          <div className="panel-header">
            <h3>Assign position group</h3>
            <span className="muted">Paste transaction IDs separated by commas</span>
          </div>
          <div className="form-grid single-column-form">
            <label>
              <span>Transaction IDs</span>
              <textarea rows={4} value={groupIds} onChange={(event) => setGroupIds(event.target.value)} />
            </label>
            <label>
              <span>Position group</span>
              <input value={positionGroup} onChange={(event) => setPositionGroup(event.target.value)} />
            </label>
            <button
              className="primary-button"
              onClick={async () => {
                const ids = groupIds.split(',').map((id) => id.trim()).filter(Boolean);
                const result = await assignPositionGroup(ids, positionGroup);
                setMessage(`Assigned ${result.updated} trades to ${positionGroup}.`);
              }}
              type="button"
            >
              Assign group
            </button>
          </div>
        </section>
      </div>
    </section>
  );
}
