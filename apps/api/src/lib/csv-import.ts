import { createHash, randomUUID } from 'node:crypto';

import type { ImportResult, TransactionInput } from '@trade-journal/shared';

import { query } from './db.js';

const currentHeaders = [
  'Date',
  'Expiration',
  'Close Date',
  'Stock',
  'Strategy',
  'Strategy',
  'Strikes',
  'Amount',
  'Opening Price',
  'Closing Price',
  'Fees',
  'Profit',
  'Win/Loss',
  'Broker',
  'Bot',
  'Notes'
] as const;

const legacyHeaders = [
  'Date',
  'Expiration',
  'Close Date',
  'Stock',
  'Strategy',
  'Strategy',
  'Strikes',
  'Amount',
  'Opening Price',
  'Closing Price',
  'Fees',
  'Profit',
  'Win/Loss',
  'Broker',
  'Notes'
] as const;

const legacyNoFeesHeaders = [
  'Date',
  'Expiration',
  'Close Date',
  'Stock',
  'Strategy',
  'Strategy',
  'Strikes',
  'Amount',
  'Opening Price',
  'Closing Price',
  'Profit',
  'Win/Loss',
  'Broker',
  'Notes'
] as const;

const brokerActivityHeaders = [
  'Activity Date',
  'Process Date',
  'Settle Date',
  'Instrument',
  'Description',
  'Trans Code',
  'Quantity',
  'Price',
  'Amount'
] as const;

type ImportFormat = 'current' | 'legacy' | 'legacyNoFees' | 'brokerActivity';

type MappedTransaction = {
  transaction: TransactionInput;
  originalRow: unknown;
};

function detectDelimiter(text: string) {
  const firstDataLine = text.split(/\r?\n/).find((line) => line.trim().length > 0) ?? '';
  const tabs = (firstDataLine.match(/\t/g) ?? []).length;
  const commas = (firstDataLine.match(/,/g) ?? []).length;
  return tabs > commas ? '\t' : ',';
}

function parseCsv(text: string) {
  const delimiter = detectDelimiter(text);
  const rows: string[][] = [];
  let currentField = '';
  let currentRow: string[] = [];
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    const nextCharacter = text[index + 1];

    if (character === '"') {
      if (inQuotes && nextCharacter === '"') {
        currentField += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (character === delimiter && !inQuotes) {
      currentRow.push(currentField);
      currentField = '';
      continue;
    }

    if ((character === '\n' || character === '\r') && !inQuotes) {
      if (character === '\r' && nextCharacter === '\n') {
        index += 1;
      }

      currentRow.push(currentField);
      rows.push(currentRow);
      currentField = '';
      currentRow = [];
      continue;
    }

    currentField += character;
  }

  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField);
    rows.push(currentRow);
  }

  return rows;
}

function normalizeCell(value: string | undefined) {
  const trimmed = (value ?? '').replace(/^\uFEFF/, '').trim();
  return trimmed.length > 0 ? trimmed : '';
}

function nullable(value: string | undefined) {
  const normalized = normalizeCell(value);
  return normalized.length > 0 ? normalized : null;
}

function toNumber(value: string | undefined) {
  const normalized = normalizeCell(value);
  if (!normalized) {
    return null;
  }

  const compact = normalized.replace(/\s/g, '');
  const isAccountingNegative = /\(.+\)/.test(compact);
  const safe = normalized.replace(/[$,\s()]/g, '');
  if (safe === '-' || safe === '') {
    return 0;
  }

  const parsed = Number(safe);
  return Number.isFinite(parsed) ? (isAccountingNegative ? -parsed : parsed) : Number.NaN;
}

function toContractAmount(value: string | undefined) {
  const normalized = normalizeCell(value);
  if (normalized.includes('/')) {
    const legs = normalized
      .split('/')
      .map((leg) => Number(leg.trim()))
      .filter((leg) => Number.isFinite(leg));
    const firstLeg = legs.find((leg) => leg !== 0);

    return firstLeg === undefined ? Number.NaN : Math.abs(firstLeg);
  }

  const parsed = toNumber(value);
  return parsed === null || Number.isNaN(parsed) ? parsed : Math.abs(parsed);
}

function toBoolean(value: string | undefined) {
  const normalized = normalizeCell(value).toLowerCase();
  return ['true', 'yes', 'y', '1', 'checked'].includes(normalized);
}

function parseDateCell(value: string | undefined) {
  const normalized = normalizeCell(value);
  if (!normalized || normalized === '-' || normalized.toLowerCase() === 'x') {
    return null;
  }

  const monthDayYear = normalized.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (monthDayYear) {
    const [, month, day, year] = monthDayYear;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }

  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) {
    return 'invalid';
  }

  return parsed.toISOString().slice(0, 10);
}

function isMissingDateMarker(value: string | undefined) {
  const normalized = normalizeCell(value);
  return !normalized || normalized === '-';
}

function matchesHeaders(headers: string[], expectedHeaders: readonly string[]) {
  return expectedHeaders.every((header, index) => {
    const actual = normalizeCell(headers[index]);

    if (expectedHeaders.length === currentHeaders.length && index === 14) {
      return actual === header || actual === '';
    }

    return actual === header;
  });
}

function getImportFormat(headers: string[]): ImportFormat | null {
  if (matchesHeaders(headers, currentHeaders)) {
    return 'current';
  }

  if (matchesHeaders(headers, legacyHeaders)) {
    return 'legacy';
  }

  if (matchesHeaders(headers, legacyNoFeesHeaders)) {
    return 'legacyNoFees';
  }

  if (matchesHeaders(headers, brokerActivityHeaders)) {
    return 'brokerActivity';
  }

  return null;
}

function validateHeaders(headers: string[]) {
  return getImportFormat(headers) !== null;
}

function findHeaderRowIndex(rows: string[][]) {
  return rows.findIndex((row) => validateHeaders(row));
}

function isNonTransactionRow(cells: string[]) {
  const hasDataShape =
    normalizeCell(cells[0]) ||
    normalizeCell(cells[1]) ||
    normalizeCell(cells[2]) ||
    normalizeCell(cells[3]) ||
    normalizeCell(cells[4]) ||
    normalizeCell(cells[5]) ||
    normalizeCell(cells[6]) ||
    normalizeCell(cells[7]) ||
    normalizeCell(cells[8]) ||
    normalizeCell(cells[9]) ||
    normalizeCell(cells[10]) ||
    normalizeCell(cells[11]) ||
    normalizeCell(cells[12]) ||
    normalizeCell(cells[13]) ||
    normalizeCell(cells[14]) ||
    normalizeCell(cells[15]);

  if (!hasDataShape) {
    return true;
  }

  if (validateHeaders(cells)) {
    return true;
  }

  if (isMissingDateMarker(cells[0]) && !normalizeCell(cells[12])) {
    return true;
  }

  const dateOpened = parseDateCell(cells[0]);
  const stock = normalizeCell(cells[3]);
  const side = normalizeCell(cells[4]);
  const strategy = normalizeCell(cells[5]);

  return dateOpened === 'invalid' && !stock && !side && !strategy;
}

function hashRow(row: TransactionInput) {
  return createHash('sha256').update(JSON.stringify(row)).digest('hex');
}

function stableTradeIdentity(row: TransactionInput) {
  return {
    stock: row.stock.trim().toUpperCase(),
    strategyType: row.strategyType.trim().toLowerCase(),
    strikes: row.strikes?.trim().toLowerCase() ?? null,
    broker: row.broker?.trim().toLowerCase() ?? null
  };
}

function inferWinLoss(profit: number | null) {
  if (profit === null) {
    return null;
  }

  return profit >= 0 ? 'Win' : 'Loss';
}

function parseWinLoss(value: string | null, profit: number | null) {
  const normalized = (value ?? '').trim().toLowerCase();

  if (['win', 'w', '1', 'true', 'yes'].includes(normalized)) {
    return 'Win';
  }

  if (['loss', 'l', '0', 'false', 'no'].includes(normalized)) {
    return 'Loss';
  }

  return inferWinLoss(profit);
}

function roundCurrency(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function formatStrike(value: number) {
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(4)));
}

function minDate(values: string[]) {
  return values.reduce((minimum, value) => (value < minimum ? value : minimum));
}

function maxDate(values: string[]) {
  return values.reduce((maximum, value) => (value > maximum ? value : maximum));
}

function parseBrokerQuantity(value: string | undefined) {
  const normalized = normalizeCell(value);
  if (!normalized) {
    return null;
  }

  const expirationSide: BrokerLotSide = normalized.toUpperCase().endsWith('S') ? 'Short' : 'Long';
  const parsed = Number(normalized.replace(/[^\d.-]/g, ''));
  if (!Number.isFinite(parsed)) {
    return {
      quantity: Number.NaN,
      expirationSide
    };
  }

  return {
    quantity: Math.abs(parsed),
    expirationSide
  };
}

type BrokerOptionType = 'Call' | 'Put';
type BrokerLotSide = 'Long' | 'Short';

type BrokerOptionContract = {
  stock: string;
  expiration: string;
  optionType: BrokerOptionType;
  strike: number;
};

type BrokerActivityRow = {
  rowNumber: number;
  activityDate: string;
  stock: string;
  description: string;
  code: string;
  quantity: number;
  expirationSide: BrokerLotSide;
  amount: number;
  raw: string[];
};

type BrokerOptionLot = BrokerOptionContract & {
  side: BrokerLotSide;
  openDate: string;
  quantity: number;
  remainingQuantity: number;
  amount: number;
  rowNumber: number;
  openGroupKey: string;
};

type BrokerOptionMatch = BrokerOptionContract & {
  side: BrokerLotSide;
  openDate: string;
  closeDate: string;
  quantity: number;
  openAmount: number;
  closeAmount: number;
  openRowNumber: number;
  closeRowNumber: number;
  openGroupKey: string;
  closeGroupKey: string;
};

type BrokerStockLot = {
  stock: string;
  side: BrokerLotSide;
  openDate: string;
  quantity: number;
  remainingQuantity: number;
  amount: number;
  rowNumber: number;
  openGroupKey: string;
};

type BrokerStockMatch = {
  stock: string;
  side: BrokerLotSide;
  openDate: string;
  closeDate: string;
  quantity: number;
  openAmount: number;
  closeAmount: number;
  openRowNumber: number;
  closeRowNumber: number;
  openGroupKey: string;
  closeGroupKey: string;
};

class UnionFind {
  private readonly parents: number[];

  constructor(size: number) {
    this.parents = Array.from({ length: size }, (_, index) => index);
  }

  find(index: number): number {
    const parent = this.parents[index];
    if (parent === index) {
      return index;
    }

    const root = this.find(parent);
    this.parents[index] = root;
    return root;
  }

  union(first: number, second: number) {
    const firstRoot = this.find(first);
    const secondRoot = this.find(second);
    if (firstRoot !== secondRoot) {
      this.parents[secondRoot] = firstRoot;
    }
  }
}

function parseBrokerOptionDescription(description: string, stockCell: string): BrokerOptionContract | null {
  const normalized = description.replace(/\s+/g, ' ').trim();
  const match = normalized.match(/^(?:Option Expiration for )?(.+?) (\d{1,2}\/\d{1,2}\/\d{4}) (Call|Put) \$([\d,]+(?:\.\d+)?)$/i);
  if (!match) {
    return null;
  }

  const [, descriptionStock, expirationCell, optionType, strikeCell] = match;
  const expiration = parseDateCell(expirationCell);
  const strike = Number(strikeCell.replace(/,/g, ''));
  if (!expiration || expiration === 'invalid' || !Number.isFinite(strike)) {
    return null;
  }

  return {
    stock: normalizeCell(stockCell) || descriptionStock.trim().toUpperCase(),
    expiration,
    optionType: optionType.toLowerCase() === 'call' ? 'Call' : 'Put',
    strike
  };
}

function brokerOptionKey(contract: BrokerOptionContract) {
  return `${contract.stock.toUpperCase()}|${contract.expiration}|${contract.optionType}|${formatStrike(contract.strike)}`;
}

function brokerOptionGroupKey(prefix: string, date: string, contract: BrokerOptionContract) {
  return `${prefix}|${date}|${contract.stock.toUpperCase()}|${contract.expiration}`;
}

function brokerStockGroupKey(prefix: string, date: string, stock: string, side: BrokerLotSide) {
  return `${prefix}|${date}|${stock.toUpperCase()}|${side}`;
}

function allocateAmount(totalAmount: number, matchedQuantity: number, totalQuantity: number) {
  return totalQuantity === 0 ? 0 : (totalAmount * matchedQuantity) / totalQuantity;
}

function groupMatches<T extends { openGroupKey: string; closeGroupKey: string }>(matches: T[]) {
  const unionFind = new UnionFind(matches.length);
  const byOpenGroup = new Map<string, number>();
  const byCloseGroup = new Map<string, number>();

  matches.forEach((match, index) => {
    const openIndex = byOpenGroup.get(match.openGroupKey);
    if (openIndex === undefined) {
      byOpenGroup.set(match.openGroupKey, index);
    } else {
      unionFind.union(openIndex, index);
    }

    const closeIndex = byCloseGroup.get(match.closeGroupKey);
    if (closeIndex === undefined) {
      byCloseGroup.set(match.closeGroupKey, index);
    } else {
      unionFind.union(closeIndex, index);
    }
  });

  const groups = new Map<number, T[]>();
  matches.forEach((match, index) => {
    const root = unionFind.find(index);
    groups.set(root, [...(groups.get(root) ?? []), match]);
  });

  return [...groups.values()];
}

function inferOptionStrategy(matches: BrokerOptionMatch[]) {
  const uniqueLegs = new Map<string, BrokerOptionMatch>();
  for (const match of matches) {
    uniqueLegs.set(`${match.optionType}|${formatStrike(match.strike)}|${match.side}`, match);
  }

  const legs = [...uniqueLegs.values()];
  const optionTypes = new Set(legs.map((leg) => leg.optionType));
  const strikes = new Set(legs.map((leg) => formatStrike(leg.strike)));

  if (legs.length === 1) {
    return legs[0].optionType;
  }

  if (legs.length === 2) {
    if (optionTypes.size === 1) {
      return `${legs[0].optionType} Vertical`;
    }

    return strikes.size === 1 ? 'Straddle' : 'Strangle';
  }

  if (legs.length === 3 && optionTypes.size === 1) {
    return 'Butterfly';
  }

  if (legs.length === 4 && optionTypes.size === 2) {
    return strikes.size === 3 ? 'Iron Fly' : 'Iron Condor';
  }

  return 'Option Combo';
}

function buildOptionStrikes(matches: BrokerOptionMatch[]) {
  const uniqueLegs = new Map<string, BrokerOptionMatch>();
  for (const match of matches) {
    uniqueLegs.set(`${match.optionType}|${formatStrike(match.strike)}|${match.side}`, match);
  }

  return [...uniqueLegs.values()]
    .sort((first, second) => {
      if (first.optionType !== second.optionType) {
        return first.optionType === 'Call' ? -1 : 1;
      }

      if (first.side !== second.side) {
        return first.side === 'Short' ? -1 : 1;
      }

      return second.strike - first.strike;
    })
    .map((leg) => `${formatStrike(leg.strike)}${leg.optionType === 'Call' ? 'c' : 'p'}`)
    .join('/');
}

function getContractCount(quantities: number[]) {
  const positiveQuantities = quantities.filter((quantity) => Number.isFinite(quantity) && quantity > 0);
  return positiveQuantities.length > 0 ? Math.min(...positiveQuantities) : 1;
}

function makeBaseTransaction(input: {
  positionGroup: string | null;
  dateOpened: string;
  expiration: string | null;
  closeDate: string | null;
  stock: string;
  positionSide: 'Long' | 'Short';
  strategyType: string;
  strikes: string | null;
  contracts: number;
  openingPrice: number;
  closingPrice: number;
  profit: number;
  notes: string;
}): TransactionInput {
  return {
    positionGroup: input.positionGroup,
    dateOpened: input.dateOpened,
    expiration: input.expiration,
    closeDate: input.closeDate,
    stock: input.stock,
    positionSide: input.positionSide,
    strategyType: input.strategyType,
    strikes: input.strikes,
    contracts: input.contracts,
    openingPrice: roundCurrency(input.openingPrice),
    closingPrice: roundCurrency(input.closingPrice),
    fees: 0,
    profit: roundCurrency(input.profit),
    winLoss: inferWinLoss(input.profit),
    broker: 'Robinhood',
    botOpened: false,
    tags: [],
    reviewNotes: null,
    lessonLearned: null,
    exitReason: null,
    profitTarget: null,
    stopLoss: null,
    maxRisk: null,
    notes: input.notes
  };
}

function parseBrokerActivityRows(rows: string[][], headerRowIndex: number, errors: ImportResult['errors']) {
  const activityRows: BrokerActivityRow[] = [];
  const ignoredCodes = new Set(['ACH', 'CDIV', 'GOLD', 'MINT', 'MRGS', 'OASGN', 'OCA', 'REC', 'REORG', 'SPL']);
  const supportedCodes = new Set(['BTO', 'STC', 'STO', 'BTC', 'OEXP', 'Buy', 'Sell']);

  for (const [rowIndex, row] of rows.entries()) {
    const rowNumber = headerRowIndex + rowIndex + 2;
    const code = normalizeCell(row[5]);
    if (!code || ignoredCodes.has(code)) {
      continue;
    }

    if (!supportedCodes.has(code)) {
      continue;
    }

    const activityDate = parseDateCell(row[0]);
    const quantity = parseBrokerQuantity(row[6]);
    const amount = code === 'OEXP' ? 0 : toNumber(row[8]);

    const problems: string[] = [];
    if (!activityDate || activityDate === 'invalid') {
      problems.push('invalid activity date');
    }
    if (!quantity || Number.isNaN(quantity.quantity) || quantity.quantity <= 0) {
      problems.push('invalid quantity');
    }
    if (amount === null || Number.isNaN(amount)) {
      problems.push('invalid amount');
    }

    if (problems.length > 0) {
      errors.push({ rowNumber, message: problems.join(', ') });
      continue;
    }

    const parsedQuantity = quantity as { quantity: number; expirationSide: BrokerLotSide };

    activityRows.push({
      rowNumber,
      activityDate: activityDate as string,
      stock: normalizeCell(row[3]),
      description: normalizeCell(row[4]),
      code,
      quantity: parsedQuantity.quantity,
      expirationSide: parsedQuantity.expirationSide,
      amount: amount as number,
      raw: row
    });
  }

  return activityRows.sort((first, second) => {
    const dateCompare = first.activityDate.localeCompare(second.activityDate);
    if (dateCompare !== 0) {
      return dateCompare;
    }

    return second.rowNumber - first.rowNumber;
  });
}

function matchBrokerOptionRows(activityRows: BrokerActivityRow[], errors: ImportResult['errors']) {
  const openLots = new Map<string, BrokerOptionLot[]>();
  const matches: BrokerOptionMatch[] = [];

  for (const row of activityRows) {
    if (!['BTO', 'STC', 'STO', 'BTC', 'OEXP'].includes(row.code)) {
      continue;
    }

    const contract = parseBrokerOptionDescription(row.description, row.stock);
    if (!contract) {
      errors.push({ rowNumber: row.rowNumber, message: 'could not parse option description' });
      continue;
    }

    const key = brokerOptionKey(contract);
    const openGroupKey = brokerOptionGroupKey('open', row.activityDate, contract);

    if (row.code === 'BTO' || row.code === 'STO') {
      const lot: BrokerOptionLot = {
        ...contract,
        side: row.code === 'BTO' ? 'Long' : 'Short',
        openDate: row.activityDate,
        quantity: row.quantity,
        remainingQuantity: row.quantity,
        amount: row.amount,
        rowNumber: row.rowNumber,
        openGroupKey
      };
      openLots.set(key, [...(openLots.get(key) ?? []), lot]);
      continue;
    }

    const closingSide: BrokerLotSide =
      row.code === 'OEXP' ? row.expirationSide : row.code === 'STC' ? 'Long' : 'Short';
    const lots = openLots.get(key) ?? [];
    let remainingCloseQuantity = row.quantity;

    for (const lot of lots) {
      if (remainingCloseQuantity <= 0) {
        break;
      }

      if (lot.side !== closingSide || lot.remainingQuantity <= 0) {
        continue;
      }

      const matchedQuantity = Math.min(lot.remainingQuantity, remainingCloseQuantity);
      lot.remainingQuantity -= matchedQuantity;
      remainingCloseQuantity -= matchedQuantity;

      matches.push({
        ...contract,
        side: lot.side,
        openDate: lot.openDate,
        closeDate: row.activityDate,
        quantity: matchedQuantity,
        openAmount: allocateAmount(lot.amount, matchedQuantity, lot.quantity),
        closeAmount: row.code === 'OEXP' ? 0 : allocateAmount(row.amount, matchedQuantity, row.quantity),
        openRowNumber: lot.rowNumber,
        closeRowNumber: row.rowNumber,
        openGroupKey: lot.openGroupKey,
        closeGroupKey: brokerOptionGroupKey('close', row.activityDate, contract)
      });
    }
  }

  return matches;
}

function matchBrokerStockRows(activityRows: BrokerActivityRow[]) {
  const openLots = new Map<string, BrokerStockLot[]>();
  const matches: BrokerStockMatch[] = [];

  for (const row of activityRows) {
    if (row.code !== 'Buy' && row.code !== 'Sell') {
      continue;
    }

    const stock = row.stock.toUpperCase();
    if (!stock) {
      continue;
    }

    const lots = openLots.get(stock) ?? [];
    const closingSide: BrokerLotSide = row.code === 'Sell' ? 'Long' : 'Short';
    const openingSide: BrokerLotSide = row.code === 'Buy' ? 'Long' : 'Short';
    let remainingQuantity = row.quantity;

    for (const lot of lots) {
      if (remainingQuantity <= 0) {
        break;
      }

      if (lot.side !== closingSide || lot.remainingQuantity <= 0) {
        continue;
      }

      const matchedQuantity = Math.min(lot.remainingQuantity, remainingQuantity);
      lot.remainingQuantity -= matchedQuantity;
      remainingQuantity -= matchedQuantity;

      matches.push({
        stock,
        side: lot.side,
        openDate: lot.openDate,
        closeDate: row.activityDate,
        quantity: matchedQuantity,
        openAmount: allocateAmount(lot.amount, matchedQuantity, lot.quantity),
        closeAmount: allocateAmount(row.amount, matchedQuantity, row.quantity),
        openRowNumber: lot.rowNumber,
        closeRowNumber: row.rowNumber,
        openGroupKey: lot.openGroupKey,
        closeGroupKey: brokerStockGroupKey('close', row.activityDate, stock, lot.side)
      });
    }

    if (remainingQuantity > 0) {
      const lot: BrokerStockLot = {
        stock,
        side: openingSide,
        openDate: row.activityDate,
        quantity: remainingQuantity,
        remainingQuantity,
        amount: allocateAmount(row.amount, remainingQuantity, row.quantity),
        rowNumber: row.rowNumber,
        openGroupKey: brokerStockGroupKey('open', row.activityDate, stock, openingSide)
      };
      openLots.set(stock, [...lots, lot]);
    }
  }

  return matches;
}

function optionMatchesToTransactions(matches: BrokerOptionMatch[]): MappedTransaction[] {
  return groupMatches(matches).map((group) => {
    const openingPrice = group.reduce((sum, match) => sum + match.openAmount, 0);
    const closingPrice = group.reduce((sum, match) => sum + match.closeAmount, 0);
    const profit = openingPrice + closingPrice;
    const uniqueExpirations = new Set(group.map((match) => match.expiration));
    const openDates = group.map((match) => match.openDate);
    const closeDates = group.map((match) => match.closeDate);
    const legQuantities = new Map<string, number>();

    for (const match of group) {
      const key = `${match.optionType}|${formatStrike(match.strike)}|${match.side}`;
      legQuantities.set(key, (legQuantities.get(key) ?? 0) + match.quantity);
    }

    const first = group[0];
    const rowNumbers = [...new Set(group.flatMap((match) => [match.openRowNumber, match.closeRowNumber]))].sort(
      (firstRow, secondRow) => firstRow - secondRow
    );

    const transaction = makeBaseTransaction({
      positionGroup: `broker:${first.stock}:${minDate(openDates)}:${maxDate(closeDates)}:${buildOptionStrikes(group)}`,
      dateOpened: minDate(openDates),
      expiration: uniqueExpirations.size === 1 ? first.expiration : null,
      closeDate: maxDate(closeDates),
      stock: first.stock,
      positionSide: openingPrice >= 0 ? 'Short' : 'Long',
      strategyType: inferOptionStrategy(group),
      strikes: buildOptionStrikes(group),
      contracts: getContractCount([...legQuantities.values()]),
      openingPrice,
      closingPrice,
      profit,
      notes: `Generated from broker activity rows ${rowNumbers.join(', ')}`
    });

    return {
      transaction,
      originalRow: {
        type: 'broker-option-match',
        rowNumbers,
        legs: group
      }
    };
  });
}

function stockMatchesToTransactions(matches: BrokerStockMatch[]): MappedTransaction[] {
  return groupMatches(matches).map((group) => {
    const openingPrice = group.reduce((sum, match) => sum + match.openAmount, 0);
    const closingPrice = group.reduce((sum, match) => sum + match.closeAmount, 0);
    const profit = openingPrice + closingPrice;
    const openDates = group.map((match) => match.openDate);
    const closeDates = group.map((match) => match.closeDate);
    const first = group[0];
    const rowNumbers = [...new Set(group.flatMap((match) => [match.openRowNumber, match.closeRowNumber]))].sort(
      (firstRow, secondRow) => firstRow - secondRow
    );

    const transaction = makeBaseTransaction({
      positionGroup: `broker:${first.stock}:${minDate(openDates)}:${maxDate(closeDates)}:stock`,
      dateOpened: minDate(openDates),
      expiration: null,
      closeDate: maxDate(closeDates),
      stock: first.stock,
      positionSide: first.side,
      strategyType: 'Stock',
      strikes: null,
      contracts: group.reduce((sum, match) => sum + match.quantity, 0),
      openingPrice,
      closingPrice,
      profit,
      notes: `Generated from broker stock activity rows ${rowNumbers.join(', ')}`
    });

    return {
      transaction,
      originalRow: {
        type: 'broker-stock-match',
        rowNumbers,
        legs: group
      }
    };
  });
}

function mapBrokerActivityToTransactions(rows: string[][], headerRowIndex: number, errors: ImportResult['errors']) {
  const activityRows = parseBrokerActivityRows(rows, headerRowIndex, errors);
  const optionMatches = matchBrokerOptionRows(activityRows, errors);
  const stockMatches = matchBrokerStockRows(activityRows);

  return [...optionMatchesToTransactions(optionMatches), ...stockMatchesToTransactions(stockMatches)].filter(
    (mapped) => mapped.transaction.closeDate && mapped.transaction.profit !== null
  );
}

async function removeExactDuplicateTransactions() {
  await query(`
    WITH ranked AS (
      SELECT
        id,
        ROW_NUMBER() OVER (
          PARTITION BY
            date_opened,
            expiration,
            close_date,
            stock,
            position_side,
            strategy_type,
            strikes,
            contracts,
            opening_price,
            closing_price,
            fees,
            profit,
            win_loss,
            broker,
            bot_opened,
            notes
          ORDER BY manually_edited DESC, updated_at DESC, created_at DESC
        ) AS row_rank
      FROM transactions
      WHERE source_file_name IS NOT NULL
    )
    DELETE FROM transactions t
    USING ranked
    WHERE t.id = ranked.id
      AND ranked.row_rank > 1
  `);
}

function mapRowToTransaction(cells: string[], rowNumber: number, format: ImportFormat) {
  const dateOpened = parseDateCell(cells[0]);
  const expiration = parseDateCell(cells[1]);
  const closeDate = parseDateCell(cells[2]);
  const contracts = toContractAmount(cells[7]);
  const openingPrice = toNumber(cells[8]);
  const closingPrice = toNumber(cells[9]);
  const fees = format === 'legacyNoFees' ? 0 : toNumber(cells[10]);
  const profit = format === 'legacyNoFees' ? toNumber(cells[10]) : toNumber(cells[11]);
  const winLossCell = nullable(format === 'legacyNoFees' ? cells[11] : cells[12]);
  const side = normalizeCell(cells[4]);
  const problems: string[] = [];
  const effectiveDateOpened = dateOpened ?? closeDate ?? expiration;

  if (dateOpened === 'invalid') {
    problems.push('invalid open date');
  } else if (!effectiveDateOpened) {
    problems.push('missing open date');
  }
  if (expiration === 'invalid') {
    problems.push('invalid expiration date');
  }
  if (closeDate === 'invalid') {
    problems.push('invalid close date');
  }
  if (!normalizeCell(cells[3])) {
    problems.push('missing stock');
  }
  if (!side) {
    problems.push('missing long/short strategy side');
  }
  if (side && side !== 'Long' && side !== 'Short') {
    problems.push('strategy side must be Long or Short');
  }
  if (!normalizeCell(cells[5])) {
    problems.push('missing strategy type');
  }
  if (!Number.isFinite(contracts) || contracts === null || contracts <= 0) {
    problems.push('invalid contract amount');
  }
  if (fees !== null && Number.isNaN(fees)) {
    problems.push('invalid fees');
  }
  if (profit !== null && Number.isNaN(profit)) {
    problems.push('invalid profit');
  }
  if (openingPrice !== null && Number.isNaN(openingPrice)) {
    problems.push('invalid opening price');
  }
  if (closingPrice !== null && Number.isNaN(closingPrice)) {
    problems.push('invalid closing price');
  }

  if (problems.length > 0 || dateOpened === 'invalid' || expiration === 'invalid' || closeDate === 'invalid') {
    return {
      error: {
        rowNumber,
        message: problems.join(', ')
      }
    };
  }

  const profitValue = Number.isNaN(profit) ? null : profit;
  const winLoss = parseWinLoss(winLossCell, profitValue);
  const botOpened = format === 'current' ? toBoolean(cells[14]) : false;
  const broker = format === 'legacyNoFees' ? nullable(cells[12]) : nullable(cells[13]);
  const notes = format === 'current' ? nullable(cells[15]) : nullable(format === 'legacyNoFees' ? cells[13] : cells[14]);

  return {
    transaction: {
      positionGroup: null,
      dateOpened: effectiveDateOpened as string,
      expiration: expiration as string | null,
      closeDate: closeDate as string | null,
      stock: normalizeCell(cells[3]),
      positionSide: side as 'Long' | 'Short',
      strategyType: normalizeCell(cells[5]),
      strikes: nullable(cells[6]),
      contracts: contracts as number,
      openingPrice: Number.isNaN(openingPrice) ? null : openingPrice,
      closingPrice: Number.isNaN(closingPrice) ? null : closingPrice,
      fees: Number.isNaN(fees) || fees === null ? 0 : fees,
      profit: profitValue,
      winLoss,
      broker,
      botOpened,
      tags: [],
      reviewNotes: null,
      lessonLearned: null,
      exitReason: null,
      profitTarget: null,
      stopLoss: null,
      maxRisk: null,
      notes
    } satisfies TransactionInput
  };
}

type ImportCounters = {
  imported: number;
  updated: number;
  skippedDuplicates: number;
};

async function saveMappedTransaction(input: {
  batchId: string;
  sourceFileName: string;
  mapped: MappedTransaction;
  counters: ImportCounters;
}) {
  const { batchId, sourceFileName, mapped, counters } = input;
  const sourceHash = hashRow(mapped.transaction);
  const identity = stableTradeIdentity(mapped.transaction);
  const existing = await query<{ id: string; source_row_hash: string }>(
    `
      SELECT id, source_row_hash
      FROM transactions
      WHERE
        source_row_hash = $1
        OR (
          date_opened = $2
          AND expiration IS NOT DISTINCT FROM $3::date
          AND UPPER(stock) = $4
          AND position_side = $5
          AND LOWER(strategy_type) = $6
          AND LOWER(COALESCE(strikes, '')) = COALESCE($7, '')
          AND contracts = $8
          AND opening_price IS NOT DISTINCT FROM $9::numeric
          AND LOWER(COALESCE(broker, '')) = COALESCE($10, '')
          AND bot_opened = $11
          AND source_file_name IS NOT NULL
        )
      ORDER BY (source_row_hash = $1) DESC, manually_edited DESC, updated_at DESC, created_at DESC
      LIMIT 1
    `,
    [
      sourceHash,
      mapped.transaction.dateOpened,
      mapped.transaction.expiration,
      identity.stock,
      mapped.transaction.positionSide,
      identity.strategyType,
      identity.strikes,
      mapped.transaction.contracts,
      mapped.transaction.openingPrice,
      identity.broker,
      mapped.transaction.botOpened
    ]
  );

  if (existing.rows[0]) {
    const existingRow = existing.rows[0];
    if (existingRow.source_row_hash === sourceHash) {
      counters.skippedDuplicates += 1;
      return;
    }

    await query(
      `
        UPDATE transactions
        SET
          import_batch_id = $2,
          source_row_hash = $3,
          source_file_name = $4,
          original_row_json = $5::jsonb,
          expiration = $6,
          close_date = $7,
          closing_price = $8,
          fees = $9,
          profit = $10,
          win_loss = $11,
          broker = $12,
          bot_opened = $13,
          notes = $14,
          updated_at = NOW()
        WHERE id = $1
      `,
      [
        existingRow.id,
        batchId,
        sourceHash,
        sourceFileName,
        JSON.stringify(mapped.originalRow),
        mapped.transaction.expiration,
        mapped.transaction.closeDate,
        mapped.transaction.closingPrice,
        mapped.transaction.fees,
        mapped.transaction.profit,
        mapped.transaction.winLoss,
        mapped.transaction.broker,
        mapped.transaction.botOpened,
        mapped.transaction.notes
      ]
    );
    counters.updated += 1;
    return;
  }

  const result = await query(
    `
      INSERT INTO transactions (
        id,
        import_batch_id,
        source_row_hash,
        source_file_name,
        original_row_json,
        date_opened,
        expiration,
        close_date,
        stock,
        position_side,
        strategy_type,
        strikes,
        contracts,
        opening_price,
        closing_price,
        fees,
        profit,
        win_loss,
        broker,
        bot_opened,
        notes
      )
      VALUES (
        $1, $2, $3, $4, $5::jsonb, $6, $7, $8, $9, $10, $11, $12, $13,
        $14, $15, $16, $17, $18, $19, $20, $21
      )
      ON CONFLICT (source_row_hash) DO NOTHING
      RETURNING id
    `,
    [
      randomUUID(),
      batchId,
      sourceHash,
      sourceFileName,
      JSON.stringify(mapped.originalRow),
      mapped.transaction.dateOpened,
      mapped.transaction.expiration,
      mapped.transaction.closeDate,
      mapped.transaction.stock,
      mapped.transaction.positionSide,
      mapped.transaction.strategyType,
      mapped.transaction.strikes,
      mapped.transaction.contracts,
      mapped.transaction.openingPrice,
      mapped.transaction.closingPrice,
      mapped.transaction.fees,
      mapped.transaction.profit,
      mapped.transaction.winLoss,
      mapped.transaction.broker,
      mapped.transaction.botOpened,
      mapped.transaction.notes
    ]
  );

  if (result.rowCount === 0) {
    counters.skippedDuplicates += 1;
  } else {
    counters.imported += 1;
  }
}

export async function importTransactionsCsv(sourceFileName: string, csvText: string): Promise<ImportResult> {
  const rows = parseCsv(csvText).filter((row) => row.some((cell) => normalizeCell(cell).length > 0));

  if (rows.length === 0) {
    throw new Error('The CSV file is empty.');
  }

  const headerRowIndex = findHeaderRowIndex(rows);
  if (headerRowIndex === -1) {
    throw new Error('The CSV headers do not match the expected Google Sheets export format.');
  }

  const importFormat = getImportFormat(rows[headerRowIndex]);
  if (!importFormat) {
    throw new Error('The CSV headers do not match the expected Google Sheets export format.');
  }

  const dataRows = rows.slice(headerRowIndex + 1);
  const batchId = randomUUID();
  const errors: ImportResult['errors'] = [];
  const counters: ImportCounters = {
    imported: 0,
    updated: 0,
    skippedDuplicates: 0
  };

  await query(
    `
      INSERT INTO import_batches (id, source_file_name, row_count, error_count)
      VALUES ($1, $2, 0, 0)
    `,
    [batchId, sourceFileName]
  );

  if (importFormat === 'brokerActivity') {
    const mappedTransactions = mapBrokerActivityToTransactions(dataRows, headerRowIndex, errors);
    for (const mapped of mappedTransactions) {
      await saveMappedTransaction({ batchId, sourceFileName, mapped, counters });
    }
  } else {
    for (const [rowIndex, row] of dataRows.entries()) {
      const rowNumber = headerRowIndex + rowIndex + 2;
      if (isNonTransactionRow(row)) {
        continue;
      }

      const mapped = mapRowToTransaction(row, rowNumber, importFormat);

      if ('error' in mapped) {
        if (mapped.error) {
          errors.push(mapped.error);
        }
        continue;
      }

      await saveMappedTransaction({
        batchId,
        sourceFileName,
        mapped: {
          transaction: mapped.transaction,
          originalRow: row
        },
        counters
      });
    }
  }

  await query(
    `
      UPDATE import_batches
      SET row_count = $2, error_count = $3
      WHERE id = $1
    `,
    [batchId, counters.imported + counters.updated + counters.skippedDuplicates, errors.length]
  );

  await removeExactDuplicateTransactions();

  return {
    batchId,
    sourceFileName,
    imported: counters.imported,
    updated: counters.updated,
    skippedDuplicates: counters.skippedDuplicates,
    errors
  };
}
