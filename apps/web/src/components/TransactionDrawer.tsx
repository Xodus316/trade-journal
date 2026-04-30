import { useEffect, useState } from 'react';

import type { TransactionInput } from '@trade-journal/shared';

import { emptyTransaction } from '../lib/transaction-form';

interface TransactionDrawerProps {
  initialValue: TransactionInput;
  isOpen: boolean;
  isSaving: boolean;
  title: string;
  onClose: () => void;
  onSave: (value: TransactionInput) => Promise<void>;
}

const commonStrategies = [
  '0dte IC',
  '0dte Flat Fly',
  '0dte Put Vertical',
  '0dte Call Vertical',
  'Put Vertical',
  'Call Vertical',
  'Iron Condor',
  'Iron Fly',
  'Calendar',
  'Butterfly',
  'Call',
  'Put',
  'Future'
];

function toNumberOrNull(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

function toTextOrNull(value: string) {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function tagsToText(tags: string[]) {
  return tags.join(', ');
}

function textToTags(value: string) {
  return value
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);
}

export function TransactionDrawer({
  initialValue,
  isOpen,
  isSaving,
  title,
  onClose,
  onSave
}: TransactionDrawerProps) {
  const [form, setForm] = useState<TransactionInput>(emptyTransaction);

  useEffect(() => {
    setForm(initialValue);
  }, [initialValue]);

  if (!isOpen) {
    return null;
  }

  return (
    <div className="drawer-backdrop" role="presentation" onClick={onClose}>
      <aside className="drawer" onClick={(event) => event.stopPropagation()}>
        <div className="drawer-header">
          <div>
            <p className="eyebrow">Transaction editor</p>
            <h3>{title}</h3>
          </div>
          <button className="ghost-button" onClick={onClose} type="button">
            Close
          </button>
        </div>

        <form
          className="form-grid"
          onSubmit={async (event) => {
            event.preventDefault();
            await onSave(form);
          }}
        >
          <label>
            <span>Open date</span>
            <input
              type="date"
              value={form.dateOpened}
              onChange={(event) => setForm((current) => ({ ...current, dateOpened: event.target.value }))}
            />
          </label>

          <label>
            <span>Expiration</span>
            <input
              type="date"
              value={form.expiration ?? ''}
              onChange={(event) => setForm((current) => ({ ...current, expiration: toTextOrNull(event.target.value) }))}
            />
          </label>

          <label>
            <span>Close date</span>
            <input
              type="date"
              value={form.closeDate ?? ''}
              onChange={(event) => setForm((current) => ({ ...current, closeDate: toTextOrNull(event.target.value) }))}
            />
          </label>

          <label>
            <span>Stock</span>
            <input
              type="text"
              value={form.stock}
              onChange={(event) => setForm((current) => ({ ...current, stock: event.target.value.toUpperCase() }))}
            />
          </label>

          <label>
            <span>Position group</span>
            <input
              type="text"
              value={form.positionGroup ?? ''}
              onChange={(event) => setForm((current) => ({ ...current, positionGroup: toTextOrNull(event.target.value) }))}
              placeholder="SPX 0DTE roll 2026-04-24"
            />
          </label>

          <label>
            <span>Side</span>
            <select
              value={form.positionSide}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  positionSide: event.target.value as TransactionInput['positionSide']
                }))
              }
            >
              <option value="Short">Short</option>
              <option value="Long">Long</option>
            </select>
          </label>

          <label>
            <span>Strategy type</span>
            <input
              list="strategy-options"
              type="text"
              value={form.strategyType}
              onChange={(event) => setForm((current) => ({ ...current, strategyType: event.target.value }))}
            />
            <datalist id="strategy-options">
              {commonStrategies.map((strategy) => (
                <option key={strategy} value={strategy} />
              ))}
            </datalist>
          </label>

          <label>
            <span>Strikes</span>
            <input
              type="text"
              value={form.strikes ?? ''}
              onChange={(event) => setForm((current) => ({ ...current, strikes: toTextOrNull(event.target.value) }))}
            />
          </label>

          <label>
            <span>Contracts</span>
            <input
              type="number"
              min="0.01"
              step="0.01"
              value={form.contracts}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  contracts: Number(event.target.value || current.contracts)
                }))
              }
            />
          </label>

          <label>
            <span>Opening price</span>
            <input
              type="number"
              step="0.01"
              value={form.openingPrice ?? ''}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  openingPrice: toNumberOrNull(event.target.value)
                }))
              }
            />
          </label>

          <label>
            <span>Closing price</span>
            <input
              type="number"
              step="0.01"
              value={form.closingPrice ?? ''}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  closingPrice: toNumberOrNull(event.target.value)
                }))
              }
            />
          </label>

          <label>
            <span>Fees</span>
            <input
              type="number"
              step="0.01"
              value={form.fees}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  fees: Number(event.target.value || 0)
                }))
              }
            />
          </label>

          <label>
            <span>Profit</span>
            <input
              type="number"
              step="0.01"
              value={form.profit ?? ''}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  profit: toNumberOrNull(event.target.value),
                  winLoss:
                    toNumberOrNull(event.target.value) === null
                      ? null
                      : (toNumberOrNull(event.target.value) ?? 0) >= 0
                        ? 'Win'
                        : 'Loss'
                }))
              }
            />
          </label>

          <label>
            <span>Win/Loss</span>
            <select
              value={form.winLoss ?? ''}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  winLoss: event.target.value ? (event.target.value as 'Win' | 'Loss') : null
                }))
              }
            >
              <option value="">Auto / blank</option>
              <option value="Win">Win</option>
              <option value="Loss">Loss</option>
            </select>
          </label>

          <label>
            <span>Broker</span>
            <input
              type="text"
              value={form.broker ?? ''}
              onChange={(event) => setForm((current) => ({ ...current, broker: toTextOrNull(event.target.value) }))}
            />
          </label>

          <label>
            <span>Tags</span>
            <input
              type="text"
              value={tagsToText(form.tags)}
              onChange={(event) => setForm((current) => ({ ...current, tags: textToTags(event.target.value) }))}
              placeholder="Rolled, Closed Early, Plan Followed"
            />
          </label>

          <label>
            <span>Exit reason</span>
            <input
              type="text"
              value={form.exitReason ?? ''}
              onChange={(event) => setForm((current) => ({ ...current, exitReason: toTextOrNull(event.target.value) }))}
              placeholder="Target hit, stop loss, thesis invalidated"
            />
          </label>

          <label>
            <span>Profit target</span>
            <input
              type="number"
              step="0.01"
              value={form.profitTarget ?? ''}
              onChange={(event) => setForm((current) => ({ ...current, profitTarget: toNumberOrNull(event.target.value) }))}
            />
          </label>

          <label>
            <span>Stop loss</span>
            <input
              type="number"
              step="0.01"
              value={form.stopLoss ?? ''}
              onChange={(event) => setForm((current) => ({ ...current, stopLoss: toNumberOrNull(event.target.value) }))}
            />
          </label>

          <label>
            <span>Max risk</span>
            <input
              type="number"
              step="0.01"
              value={form.maxRisk ?? ''}
              onChange={(event) => setForm((current) => ({ ...current, maxRisk: toNumberOrNull(event.target.value) }))}
            />
          </label>

          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={form.botOpened}
              onChange={(event) => setForm((current) => ({ ...current, botOpened: event.target.checked }))}
            />
            <span>Opened by bot</span>
          </label>

          <label className="full-width">
            <span>Notes</span>
            <textarea
              rows={5}
              value={form.notes ?? ''}
              onChange={(event) => setForm((current) => ({ ...current, notes: toTextOrNull(event.target.value) }))}
            />
          </label>

          <label className="full-width">
            <span>Review notes</span>
            <textarea
              rows={4}
              value={form.reviewNotes ?? ''}
              onChange={(event) => setForm((current) => ({ ...current, reviewNotes: toTextOrNull(event.target.value) }))}
              placeholder="Thesis, exit quality, what worked, what failed"
            />
          </label>

          <label className="full-width">
            <span>Lesson learned</span>
            <textarea
              rows={3}
              value={form.lessonLearned ?? ''}
              onChange={(event) => setForm((current) => ({ ...current, lessonLearned: toTextOrNull(event.target.value) }))}
              placeholder="One concrete rule or adjustment for next time"
            />
          </label>

          <div className="drawer-actions full-width">
            <button className="ghost-button" onClick={onClose} type="button">
              Cancel
            </button>
            <button className="primary-button" disabled={isSaving} type="submit">
              {isSaving ? 'Saving…' : 'Save transaction'}
            </button>
          </div>
        </form>
      </aside>
    </div>
  );
}
