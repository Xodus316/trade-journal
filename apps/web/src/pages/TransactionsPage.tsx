import { useEffect, useMemo, useState } from 'react';

import type { AnalyticsFilters, TransactionInput, TransactionRecord } from '@trade-journal/shared';

import { TransactionDrawer } from '../components/TransactionDrawer';
import { createTransaction, deleteTransaction, getTransactions, updateTransaction } from '../lib/api';
import { filterTransactions } from '../lib/filter-transactions';
import { emptyText, formatCurrency } from '../lib/format';
import { emptyTransaction, toTransactionInput } from '../lib/transaction-form';

interface TransactionsPageProps {
  filters: AnalyticsFilters;
  onTradeSelect: (trade: TransactionRecord) => void;
}

export function TransactionsPage({ filters, onTradeSelect }: TransactionsPageProps) {
  const [items, setItems] = useState<TransactionRecord[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [drawerState, setDrawerState] = useState<{ mode: 'create' | 'edit'; record: TransactionRecord | null } | null>(null);

  async function loadTransactions() {
    setLoading(true);
    try {
      const response = await getTransactions();
      setItems(response.items);
      setError(null);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Failed to load transactions.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadTransactions();
  }, []);

  const initialValue = useMemo(() => {
    if (!drawerState) {
      return emptyTransaction;
    }

    return drawerState.record ? toTransactionInput(drawerState.record) : emptyTransaction;
  }, [drawerState]);
  const filteredItems = useMemo(() => filterTransactions(items, filters), [items, filters]);

  return (
    <section className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Editable ledger</p>
          <h2>Transactions</h2>
        </div>
        <button
          className="primary-button"
          onClick={() => setDrawerState({ mode: 'create', record: null })}
          type="button"
        >
          New transaction
        </button>
      </header>

      {error && <div className="error-banner">{error}</div>}

      <section className="panel">
        <div className="panel-header">
          <h3>Ledger</h3>
          <span className="muted">Open positions stay visible here but are excluded from realized totals</span>
        </div>
        {loading ? (
          <div className="empty-state">Loading transactions…</div>
        ) : filteredItems.length === 0 ? (
          <div className="empty-state">No transactions yet. Import a CSV or add one manually.</div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Stock</th>
                <th>Side</th>
                <th>Strategy</th>
                <th>Status</th>
                <th>Close Date</th>
                <th>Profit</th>
                <th>Bot</th>
                <th>Notes</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map((row) => (
                <tr key={row.id}>
                  <td>{row.stock}</td>
                  <td>{row.positionSide}</td>
                  <td>{row.strategyType}</td>
                  <td>
                    <span className={row.closeDate ? 'status-pill status-closed' : 'status-pill status-open'}>
                      {row.closeDate ? 'Closed' : 'Open'}
                    </span>
                  </td>
                  <td>{row.closeDate ?? 'Open'}</td>
                  <td>{row.closeDate ? formatCurrency(row.profit) : 'Excluded'}</td>
                  <td>{row.botOpened ? 'Bot' : 'Manual'}</td>
                  <td>{emptyText(row.notes)}</td>
                  <td className="table-actions">
                    <button className="ghost-button" onClick={() => onTradeSelect(row)} type="button">
                      View
                    </button>
                    <button
                      className="ghost-button"
                      onClick={() => setDrawerState({ mode: 'edit', record: row })}
                      type="button"
                    >
                      Edit
                    </button>
                    <button
                      className="ghost-button danger-button"
                      onClick={async () => {
                        await deleteTransaction(row.id);
                        await loadTransactions();
                      }}
                      type="button"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <TransactionDrawer
        initialValue={initialValue}
        isOpen={drawerState !== null}
        isSaving={saving}
        title={drawerState?.mode === 'edit' ? 'Edit transaction' : 'New transaction'}
        onClose={() => setDrawerState(null)}
        onSave={async (value: TransactionInput) => {
          setSaving(true);
          try {
            if (drawerState?.mode === 'edit' && drawerState.record) {
              await updateTransaction(drawerState.record.id, value);
            } else {
              await createTransaction(value);
            }

            setDrawerState(null);
            await loadTransactions();
          } catch (requestError) {
            setError(requestError instanceof Error ? requestError.message : 'Failed to save transaction.');
          } finally {
            setSaving(false);
          }
        }}
      />
    </section>
  );
}
