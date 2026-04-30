import type { AnalyticsFilters } from '@trade-journal/shared';
import { useEffect, useState } from 'react';

interface FilterBarProps {
  filters: AnalyticsFilters;
  onChange: (filters: AnalyticsFilters) => void;
}

export const defaultFilters: AnalyticsFilters = {
  dateFrom: null,
  dateTo: null,
  stock: '',
  strategyType: '',
  positionSide: '',
  botOpened: 'all',
  status: 'all'
};

export const savedViewsStorageKey = 'trade-journal:saved-views';

function patchFilter(filters: AnalyticsFilters, patch: Partial<AnalyticsFilters>) {
  return {
    ...filters,
    ...patch
  };
}

function toDateInput(date: Date) {
  return date.toISOString().slice(0, 10);
}

function startOfWeek(date: Date) {
  const next = new Date(date);
  const day = next.getDay() || 7;
  next.setDate(next.getDate() - day + 1);
  return next;
}

function startOfYear(date: Date) {
  return new Date(date.getFullYear(), 0, 1);
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

const datePresets = [
  { label: 'All', range: () => ({ dateFrom: null, dateTo: null }) },
  { label: 'Today', range: () => ({ dateFrom: toDateInput(new Date()), dateTo: toDateInput(new Date()) }) },
  {
    label: 'This Week',
    range: () => {
      const start = startOfWeek(new Date());
      return { dateFrom: toDateInput(start), dateTo: toDateInput(addDays(start, 6)) };
    }
  },
  {
    label: 'MTD',
    range: () => ({ dateFrom: toDateInput(startOfMonth(new Date())), dateTo: toDateInput(new Date()) })
  },
  {
    label: 'Last 30',
    range: () => ({ dateFrom: toDateInput(addDays(new Date(), -29)), dateTo: toDateInput(new Date()) })
  },
  {
    label: 'Last 90',
    range: () => ({ dateFrom: toDateInput(addDays(new Date(), -89)), dateTo: toDateInput(new Date()) })
  },
  {
    label: 'YTD',
    range: () => ({ dateFrom: toDateInput(startOfYear(new Date())), dateTo: toDateInput(new Date()) })
  }
];

export function FilterBar({ filters, onChange }: FilterBarProps) {
  const [viewName, setViewName] = useState('');
  const [savedViews, setSavedViews] = useState<Record<string, AnalyticsFilters>>({});

  useEffect(() => {
    const raw = window.localStorage.getItem(savedViewsStorageKey);
    if (raw) {
      setSavedViews(JSON.parse(raw));
    }
  }, []);

  function saveViews(nextViews: Record<string, AnalyticsFilters>) {
    setSavedViews(nextViews);
    window.localStorage.setItem(savedViewsStorageKey, JSON.stringify(nextViews));
  }

  return (
    <section className="filter-shell" aria-label="Filters">
      <div className="preset-row">
        {datePresets.map((preset) => (
          <button
            className="pill"
            key={preset.label}
            onClick={() => onChange(patchFilter(filters, preset.range()))}
            type="button"
          >
            {preset.label}
          </button>
        ))}
      </div>
      <div className="filter-bar">
        <label>
          <span>Saved view</span>
          <select
            value=""
            onChange={(event) => {
              const view = savedViews[event.target.value];
              if (view) {
                onChange(view);
              }
            }}
          >
            <option value="">Load view</option>
            {Object.keys(savedViews).map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>From</span>
          <input
            type="date"
            value={filters.dateFrom ?? ''}
            onChange={(event) => onChange(patchFilter(filters, { dateFrom: event.target.value || null }))}
          />
        </label>
        <label>
          <span>To</span>
          <input
            type="date"
            value={filters.dateTo ?? ''}
            onChange={(event) => onChange(patchFilter(filters, { dateTo: event.target.value || null }))}
          />
        </label>
        <label>
          <span>Stock</span>
          <input
            type="search"
            value={filters.stock}
            onChange={(event) => onChange(patchFilter(filters, { stock: event.target.value }))}
            placeholder="/ES, SPX..."
          />
        </label>
        <label>
          <span>Strategy</span>
          <input
            type="search"
            value={filters.strategyType}
            onChange={(event) => onChange(patchFilter(filters, { strategyType: event.target.value }))}
            placeholder="Put Vertical..."
          />
        </label>
        <label>
          <span>Side</span>
          <select
            value={filters.positionSide}
            onChange={(event) =>
              onChange(patchFilter(filters, { positionSide: event.target.value as AnalyticsFilters['positionSide'] }))
            }
          >
            <option value="">All</option>
            <option value="Long">Long</option>
            <option value="Short">Short</option>
          </select>
        </label>
        <label>
          <span>Source</span>
          <select
            value={filters.botOpened}
            onChange={(event) =>
              onChange(patchFilter(filters, { botOpened: event.target.value as AnalyticsFilters['botOpened'] }))
            }
          >
            <option value="all">All</option>
            <option value="bot">Bot</option>
            <option value="manual">Manual</option>
          </select>
        </label>
        <label>
          <span>Status</span>
          <select
            value={filters.status}
            onChange={(event) =>
              onChange(patchFilter(filters, { status: event.target.value as AnalyticsFilters['status'] }))
            }
          >
            <option value="all">All</option>
            <option value="closed">Closed</option>
            <option value="open">Open</option>
          </select>
        </label>
        <button className="ghost-button" onClick={() => onChange(defaultFilters)} type="button">
          Reset
        </button>
        <label>
          <span>View name</span>
          <input value={viewName} onChange={(event) => setViewName(event.target.value)} placeholder="0DTE Bot" />
        </label>
        <button
          className="ghost-button"
          onClick={() => {
            if (!viewName.trim()) {
              return;
            }

            saveViews({
              ...savedViews,
              [viewName.trim()]: filters
            });
            setViewName('');
          }}
          type="button"
        >
          Save View
        </button>
      </div>
    </section>
  );
}
