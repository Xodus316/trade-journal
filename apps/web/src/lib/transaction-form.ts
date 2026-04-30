import type { TransactionInput, TransactionRecord } from '@trade-journal/shared';

export const emptyTransaction: TransactionInput = {
  positionGroup: null,
  dateOpened: new Date().toISOString().slice(0, 10),
  expiration: null,
  closeDate: null,
  stock: '',
  positionSide: 'Short',
  strategyType: '',
  strikes: null,
  contracts: 1,
  openingPrice: null,
  closingPrice: null,
  fees: 0,
  profit: null,
  winLoss: null,
  broker: null,
  botOpened: false,
  tags: [],
  reviewNotes: null,
  lessonLearned: null,
  exitReason: null,
  profitTarget: null,
  stopLoss: null,
  maxRisk: null,
  notes: null
};

export function toTransactionInput(record: TransactionRecord): TransactionInput {
  return {
    positionGroup: record.positionGroup,
    dateOpened: record.dateOpened,
    expiration: record.expiration,
    closeDate: record.closeDate,
    stock: record.stock,
    positionSide: record.positionSide,
    strategyType: record.strategyType,
    strikes: record.strikes,
    contracts: record.contracts,
    openingPrice: record.openingPrice,
    closingPrice: record.closingPrice,
    fees: record.fees,
    profit: record.profit,
    winLoss: record.winLoss,
    broker: record.broker,
    botOpened: record.botOpened,
    tags: record.tags,
    reviewNotes: record.reviewNotes,
    lessonLearned: record.lessonLearned,
    exitReason: record.exitReason,
    profitTarget: record.profitTarget,
    stopLoss: record.stopLoss,
    maxRisk: record.maxRisk,
    notes: record.notes
  };
}
