import type {
  AnalyticsResponse,
  BackupPayload,
  BackupRestoreResult,
  AnalyticsFilters,
  CleanupRenameResult,
  DailyReview,
  DailyReviewInput,
  DailyReviewResponse,
  ImportHistoryResponse,
  ImportResult,
  PositionGroupDetail,
  PositionGroupsResponse,
  StockAnalyticsResponse,
  StrategyAnalyticsResponse,
  TransactionInput,
  TransactionListResponse,
  TransactionRecord
} from '@trade-journal/shared';

type ViteImportMeta = ImportMeta & {
  env?: {
    VITE_API_URL?: string;
  };
};

function resolveApiUrl() {
  const configuredUrl = (import.meta as ViteImportMeta).env?.VITE_API_URL;
  const browserLocation = typeof window === 'undefined' ? null : window.location;
  const host = browserLocation?.hostname ?? 'localhost';
  const isRemoteBrowser = host !== 'localhost' && host !== '127.0.0.1';

  if (isRemoteBrowser && (!configuredUrl || configuredUrl.includes('localhost') || configuredUrl.includes('127.0.0.1'))) {
    return `${browserLocation?.protocol ?? 'http:'}//${host}:4000`;
  }

  return configuredUrl ?? 'http://localhost:4000';
}

let API_URL = resolveApiUrl();

export function __setApiUrlForTests(url: string) {
  API_URL = url;
}

export function __resetApiUrlForTests() {
  API_URL = resolveApiUrl();
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    headers: {
      'Content-Type': 'application/json'
    },
    ...init
  });

  if (!response.ok) {
    const errorPayload = await response.json().catch(() => null);
    const message = errorPayload?.message ?? `Request failed with status ${response.status}`;
    throw new Error(message);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

export function toQueryString(filters?: Partial<AnalyticsFilters>) {
  const params = new URLSearchParams();

  if (!filters) {
    return '';
  }

  for (const [key, value] of Object.entries(filters)) {
    if (value && value !== 'all') {
      params.set(key, String(value));
    }
  }

  const queryString = params.toString();
  return queryString ? `?${queryString}` : '';
}

export function getAnalytics(filters?: Partial<AnalyticsFilters>) {
  return requestJson<AnalyticsResponse>(`/analytics${toQueryString(filters)}`);
}

export function getStockAnalytics(stock: string) {
  return requestJson<StockAnalyticsResponse>(`/analytics/stocks/${encodeURIComponent(stock)}`);
}

export function getStrategyAnalytics(positionSide: string, strategyType: string) {
  return requestJson<StrategyAnalyticsResponse>(
    `/analytics/strategies/${encodeURIComponent(positionSide)}/${encodeURIComponent(strategyType)}`
  );
}

export function getTransactions() {
  return requestJson<TransactionListResponse>('/transactions');
}

export function getPositionGroups() {
  return requestJson<PositionGroupsResponse>('/positions');
}

export function getPositionGroup(groupKey: string) {
  return requestJson<PositionGroupDetail>(`/positions/${encodeURIComponent(groupKey)}`);
}

export function getDailyReview(date: string) {
  return requestJson<DailyReviewResponse>(`/daily-reviews/${encodeURIComponent(date)}`);
}

export function saveDailyReview(date: string, payload: DailyReviewInput) {
  return requestJson<DailyReview>(`/daily-reviews/${encodeURIComponent(date)}`, {
    method: 'PUT',
    body: JSON.stringify(payload)
  });
}

export function exportBackup() {
  return requestJson<BackupPayload>('/backup');
}

export function restoreBackup(payload: BackupPayload) {
  return requestJson<BackupRestoreResult>('/backup/restore', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export function renameStrategy(from: string, to: string) {
  return requestJson<CleanupRenameResult>('/cleanup/strategy', {
    method: 'POST',
    body: JSON.stringify({ from, to })
  });
}

export function renameStock(from: string, to: string) {
  return requestJson<CleanupRenameResult>('/cleanup/stock', {
    method: 'POST',
    body: JSON.stringify({ from, to })
  });
}

export function assignPositionGroup(ids: string[], positionGroup: string) {
  return requestJson<CleanupRenameResult>('/cleanup/group', {
    method: 'POST',
    body: JSON.stringify({ ids, positionGroup })
  });
}

export function getOpenPositions() {
  return requestJson<{ items: TransactionRecord[] }>('/transactions/open');
}

export function createTransaction(payload: TransactionInput) {
  return requestJson<TransactionRecord>('/transactions', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export function updateTransaction(id: string, payload: TransactionInput) {
  return requestJson<TransactionRecord>(`/transactions/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload)
  });
}

export function deleteTransaction(id: string) {
  return requestJson<void>(`/transactions/${id}`, {
    method: 'DELETE'
  });
}

export function importTransactions(fileName: string, csvText: string) {
  return requestJson<ImportResult>('/imports', {
    method: 'POST',
    body: JSON.stringify({
      fileName,
      csvText
    })
  });
}

export function getImportHistory() {
  return requestJson<ImportHistoryResponse>('/imports');
}
