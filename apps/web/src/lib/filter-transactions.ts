import type { AnalyticsFilters, TransactionRecord } from '@trade-journal/shared';

export function filterTransactions(items: TransactionRecord[], filters: AnalyticsFilters) {
  return items.filter((item) => {
    const reportingDate = item.closeDate ?? item.dateOpened;

    if (filters.dateFrom && reportingDate < filters.dateFrom) {
      return false;
    }

    if (filters.dateTo && reportingDate > filters.dateTo) {
      return false;
    }

    if (filters.stock && !item.stock.toLowerCase().includes(filters.stock.toLowerCase())) {
      return false;
    }

    if (filters.strategyType && !item.strategyType.toLowerCase().includes(filters.strategyType.toLowerCase())) {
      return false;
    }

    if (filters.positionSide && item.positionSide !== filters.positionSide) {
      return false;
    }

    if (filters.botOpened === 'bot' && !item.botOpened) {
      return false;
    }

    if (filters.botOpened === 'manual' && item.botOpened) {
      return false;
    }

    if (filters.status === 'open' && item.closeDate) {
      return false;
    }

    if (filters.status === 'closed' && !item.closeDate) {
      return false;
    }

    return true;
  });
}
