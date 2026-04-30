import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';

import type { TransactionInput } from '@trade-journal/shared';

import {
  __resetApiUrlForTests,
  __setApiUrlForTests,
  assignPositionGroup,
  createTransaction,
  deleteTransaction,
  exportBackup,
  getAnalytics,
  getDailyReview,
  getImportHistory,
  getOpenPositions,
  getPositionGroup,
  getPositionGroups,
  getStockAnalytics,
  getStrategyAnalytics,
  getTransactions,
  importTransactions,
  renameStock,
  renameStrategy,
  restoreBackup,
  saveDailyReview,
  toQueryString,
  updateTransaction
} from '../src/lib/api';

type FetchCall = {
  url: string;
  init: RequestInit | undefined;
};

const calls: FetchCall[] = [];

const transactionInput: TransactionInput = {
  positionGroup: 'April SPX income',
  dateOpened: '2026-04-20',
  expiration: '2026-04-20',
  closeDate: '2026-04-20',
  stock: 'SPX',
  positionSide: 'Short',
  strategyType: 'Put Vertical',
  strikes: '710p/705p',
  contracts: 1,
  openingPrice: 1.2,
  closingPrice: 0.3,
  fees: -2.1,
  profit: 87.9,
  winLoss: 'Win',
  broker: null,
  botOpened: false,
  tags: ['followed-plan'],
  reviewNotes: 'Good entry.',
  lessonLearned: 'Scale out earlier.',
  exitReason: 'Target',
  profitTarget: 100,
  stopLoss: -150,
  maxRisk: 400,
  notes: 'Manual test payload.'
};

function mockFetch(payload: unknown, status = 200) {
  globalThis.fetch = async (input: string | URL | Request, init?: RequestInit) => {
    calls.push({
      url: String(input),
      init
    });

    return new Response(status === 204 ? null : JSON.stringify(payload), {
      status,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  };
}

function latestCall() {
  const call = calls.at(-1);
  assert.ok(call, 'expected fetch to be called');
  return call;
}

function parsedBody(call: FetchCall) {
  assert.equal(typeof call.init?.body, 'string');
  return JSON.parse(call.init.body as string) as unknown;
}

afterEach(() => {
  calls.length = 0;
  __resetApiUrlForTests();
});

describe('toQueryString', () => {
  it('omits empty and all filter values', () => {
    assert.equal(
      toQueryString({
        dateFrom: '2026-04-01',
        dateTo: null,
        stock: '',
        strategyType: 'Put Vertical',
        positionSide: '',
        botOpened: 'all',
        status: 'closed'
      }),
      '?dateFrom=2026-04-01&strategyType=Put+Vertical&status=closed'
    );
  });

  it('returns an empty string when no filter values are active', () => {
    assert.equal(toQueryString(), '');
    assert.equal(toQueryString({ botOpened: 'all', status: 'all' }), '');
  });
});

describe('API client GET calls', () => {
  it('calls analytics with serialized filters', async () => {
    mockFetch({ summary: { realizedPnL: 123 } });

    const result = await getAnalytics({
      dateFrom: '2026-04-01',
      dateTo: '2026-04-30',
      stock: 'SPX',
      strategyType: '',
      positionSide: 'Short',
      botOpened: 'manual',
      status: 'closed'
    });

    assert.deepEqual(result, { summary: { realizedPnL: 123 } });
    assert.equal(
      latestCall().url,
      'http://localhost:4000/analytics?dateFrom=2026-04-01&dateTo=2026-04-30&stock=SPX&positionSide=Short&botOpened=manual&status=closed'
    );
  });

  it('calls stock analytics with encoded symbols', async () => {
    mockFetch({ stock: '/ES' });

    await getStockAnalytics('/ES');

    assert.equal(latestCall().url, 'http://localhost:4000/analytics/stocks/%2FES');
  });

  it('calls strategy analytics with encoded route parts', async () => {
    mockFetch({ strategyType: 'Put Vertical' });

    await getStrategyAnalytics('Short', 'Put Vertical');

    assert.equal(latestCall().url, 'http://localhost:4000/analytics/strategies/Short/Put%20Vertical');
  });

  it('calls transaction, position, open-position, and import history endpoints', async () => {
    const cases: Array<[string, () => Promise<unknown>]> = [
      ['/transactions', getTransactions],
      ['/positions', getPositionGroups],
      ['/transactions/open', getOpenPositions],
      ['/imports', getImportHistory],
      ['/backup', exportBackup]
    ];

    for (const [path, apiCall] of cases) {
      mockFetch({ items: [] });
      await apiCall();
      assert.equal(latestCall().url, `http://localhost:4000${path}`);
    }
  });

  it('calls a position group endpoint with encoded grouping keys', async () => {
    mockFetch({ groupKey: '/ES|Short|IC|2026-04-16|7050c/7030c' });

    await getPositionGroup('/ES|Short|IC|2026-04-16|7050c/7030c');

    assert.equal(
      latestCall().url,
      'http://localhost:4000/positions/%2FES%7CShort%7CIC%7C2026-04-16%7C7050c%2F7030c'
    );
  });

  it('calls daily review endpoints with encoded dates', async () => {
    mockFetch({ trades: [] });

    await getDailyReview('2026-04-20');

    assert.equal(latestCall().url, 'http://localhost:4000/daily-reviews/2026-04-20');
  });
});

describe('API client mutation calls', () => {
  it('creates transactions with POST JSON', async () => {
    mockFetch({ id: 'trade-1' }, 201);

    await createTransaction(transactionInput);

    const call = latestCall();
    assert.equal(call.url, 'http://localhost:4000/transactions');
    assert.equal(call.init?.method, 'POST');
    assert.deepEqual(parsedBody(call), transactionInput);
  });

  it('updates transactions with PATCH JSON', async () => {
    mockFetch({ id: 'trade-1' });

    await updateTransaction('trade-1', transactionInput);

    const call = latestCall();
    assert.equal(call.url, 'http://localhost:4000/transactions/trade-1');
    assert.equal(call.init?.method, 'PATCH');
    assert.deepEqual(parsedBody(call), transactionInput);
  });

  it('deletes transactions and accepts empty 204 responses', async () => {
    mockFetch(null, 204);

    const result = await deleteTransaction('trade-1');

    const call = latestCall();
    assert.equal(call.url, 'http://localhost:4000/transactions/trade-1');
    assert.equal(call.init?.method, 'DELETE');
    assert.equal(result, undefined);
  });

  it('imports CSV text with POST JSON', async () => {
    mockFetch({ imported: 1 }, 201);

    await importTransactions('trades.csv', 'Date,Stock\n2026-04-20,SPX');

    const call = latestCall();
    assert.equal(call.url, 'http://localhost:4000/imports');
    assert.equal(call.init?.method, 'POST');
    assert.deepEqual(parsedBody(call), {
      fileName: 'trades.csv',
      csvText: 'Date,Stock\n2026-04-20,SPX'
    });
  });

  it('renames strategies and stocks with POST JSON', async () => {
    const cases: Array<[string, () => Promise<unknown>, unknown]> = [
      ['/cleanup/strategy', () => renameStrategy('IC', 'Iron Condor'), { from: 'IC', to: 'Iron Condor' }],
      ['/cleanup/stock', () => renameStock('/ES', 'ES'), { from: '/ES', to: 'ES' }]
    ];

    for (const [path, apiCall, body] of cases) {
      mockFetch({ updated: 2 });
      await apiCall();

      const call = latestCall();
      assert.equal(call.url, `http://localhost:4000${path}`);
      assert.equal(call.init?.method, 'POST');
      assert.deepEqual(parsedBody(call), body);
    }
  });

  it('assigns position groups with POST JSON', async () => {
    mockFetch({ updated: 2 });

    await assignPositionGroup(['trade-1', 'trade-2'], 'April SPX income');

    const call = latestCall();
    assert.equal(call.url, 'http://localhost:4000/cleanup/group');
    assert.equal(call.init?.method, 'POST');
    assert.deepEqual(parsedBody(call), {
      ids: ['trade-1', 'trade-2'],
      positionGroup: 'April SPX income'
    });
  });

  it('saves daily reviews with PUT JSON', async () => {
    mockFetch({ reviewDate: '2026-04-20' });

    await saveDailyReview('2026-04-20', {
      notes: 'Range day. Good patience.',
      chartImageDataUrl: 'data:image/png;base64,abc123'
    });

    const call = latestCall();
    assert.equal(call.url, 'http://localhost:4000/daily-reviews/2026-04-20');
    assert.equal(call.init?.method, 'PUT');
    assert.deepEqual(parsedBody(call), {
      notes: 'Range day. Good patience.',
      chartImageDataUrl: 'data:image/png;base64,abc123'
    });
  });

  it('restores backups with POST JSON', async () => {
    const backup = {
      version: 1 as const,
      exportedAt: '2026-04-20T20:00:00.000Z',
      importBatches: [],
      transactions: [],
      dailyReviews: []
    };
    mockFetch({ importedTransactions: 0 });

    await restoreBackup(backup);

    const call = latestCall();
    assert.equal(call.url, 'http://localhost:4000/backup/restore');
    assert.equal(call.init?.method, 'POST');
    assert.deepEqual(parsedBody(call), backup);
  });
});

describe('API client error and base URL behavior', () => {
  it('throws the API error message when a request fails', async () => {
    mockFetch({ message: 'Invalid transaction payload.' }, 400);

    await assert.rejects(() => getTransactions(), /Invalid transaction payload\./);
  });

  it('falls back to a status message when an error response is not JSON', async () => {
    globalThis.fetch = async (input: string | URL | Request, init?: RequestInit) => {
      calls.push({ url: String(input), init });
      return new Response('Internal Server Error', { status: 500 });
    };

    await assert.rejects(() => getTransactions(), /Request failed with status 500/);
  });

  it('allows tests to override the API base URL', async () => {
    __setApiUrlForTests('http://192.168.1.94:4000');
    mockFetch({ items: [] });

    await getTransactions();

    assert.equal(latestCall().url, 'http://192.168.1.94:4000/transactions');
  });
});
