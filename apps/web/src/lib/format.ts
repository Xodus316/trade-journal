export function formatCurrency(value: number | null | undefined) {
  if (value === null || value === undefined) {
    return 'Open';
  }

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(value);
}

export function formatPercent(value: number) {
  return `${value.toFixed(1)}%`;
}

export function emptyText(value: string | null | undefined) {
  return value && value.trim().length > 0 ? value : '—';
}
