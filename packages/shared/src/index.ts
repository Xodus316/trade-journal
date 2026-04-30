export type PositionSide = 'Long' | 'Short';

export type WinLossValue = 'Win' | 'Loss' | null;
export type RealizedTimeframe = 'daily' | 'weekly' | 'monthly' | 'yearly';

export interface AnalyticsFilters {
  dateFrom: string | null;
  dateTo: string | null;
  stock: string;
  strategyType: string;
  positionSide: PositionSide | '';
  botOpened: 'all' | 'bot' | 'manual';
  status: 'all' | 'open' | 'closed';
}

export interface TransactionRecord {
  id: string;
  positionGroup: string | null;
  dateOpened: string;
  expiration: string | null;
  closeDate: string | null;
  stock: string;
  positionSide: PositionSide;
  strategyType: string;
  strikes: string | null;
  contracts: number;
  openingPrice: number | null;
  closingPrice: number | null;
  fees: number;
  profit: number | null;
  winLoss: WinLossValue;
  broker: string | null;
  botOpened: boolean;
  tags: string[];
  reviewNotes: string | null;
  lessonLearned: string | null;
  exitReason: string | null;
  profitTarget: number | null;
  stopLoss: number | null;
  maxRisk: number | null;
  percentMaxProfit: number | null;
  returnOnRisk: number | null;
  notes: string | null;
  manuallyEdited: boolean;
  manuallyEditedAt: string | null;
  sourceFileName: string | null;
  importBatchId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TransactionInput {
  positionGroup: string | null;
  dateOpened: string;
  expiration: string | null;
  closeDate: string | null;
  stock: string;
  positionSide: PositionSide;
  strategyType: string;
  strikes: string | null;
  contracts: number;
  openingPrice: number | null;
  closingPrice: number | null;
  fees: number;
  profit: number | null;
  winLoss: WinLossValue;
  broker: string | null;
  botOpened: boolean;
  tags: string[];
  reviewNotes: string | null;
  lessonLearned: string | null;
  exitReason: string | null;
  profitTarget: number | null;
  stopLoss: number | null;
  maxRisk: number | null;
  notes: string | null;
}

export interface TransactionListResponse {
  items: TransactionRecord[];
  meta: {
    total: number;
    openPositions: number;
    closedPositions: number;
  };
}

export interface TimeBucket {
  bucket: string;
  realizedPnL: number;
  trades: number;
  wins: number;
  losses: number;
}

export interface StrategyBreakdownRow {
  positionSide: PositionSide;
  strategyType: string;
  trades: number;
  wins: number;
  losses: number;
  realizedPnL: number;
}

export interface StockBreakdownRow {
  stock: string;
  trades: number;
  realizedPnL: number;
}

export interface BotManualRow {
  source: 'Bot' | 'Manual';
  trades: number;
  wins: number;
  losses: number;
  realizedPnL: number;
  winRate: number;
  profitFactor: number;
  expectancy: number;
}

export interface EquityPoint {
  date: string;
  dailyPnL: number;
  cumulativePnL: number;
}

export interface DrawdownSummary {
  maxDrawdown: number;
  maxDrawdownStart: string | null;
  maxDrawdownEnd: string | null;
  currentDrawdown: number;
  bestWinningStreak: number;
  worstLosingStreak: number;
}

export interface CalendarDay {
  date: string;
  realizedPnL: number;
  trades: number;
}

export interface DayOfWeekBreakdownRow {
  day: number;
  label: string;
  trades: number;
  wins: number;
  losses: number;
  winRate: number;
  realizedPnL: number;
}

export interface HoldingPeriodPoint {
  daysHeld: number;
  profit: number;
  closeDate: string;
  stock: string;
  positionSide: PositionSide;
  strategyType: string;
  winLoss: WinLossValue;
}

export interface StreakSummary {
  currentType: 'Win' | 'Loss' | 'None';
  currentLength: number;
  longestWin: number;
  longestLoss: number;
  averageWinStreak: number;
  averageLossStreak: number;
}

export interface TradeExtremes {
  limit: number;
  totalPnL: number;
  tradeCount: number;
  withoutWorst: number;
  withoutBest: number;
  winners: TransactionRecord[];
  losers: TransactionRecord[];
}

export interface SummaryMetric {
  realizedPnL: number;
  totalFees: number;
  totalClosedTrades: number;
  totalOpenPositions: number;
  wins: number;
  losses: number;
  winRate: number;
  averageWinner: number;
  averageLoser: number;
  largestWinner: number;
  largestLoser: number;
  profitFactor: number;
  expectancy: number;
  botRealizedPnL: number;
  manualRealizedPnL: number;
  longRealizedPnL: number;
  shortRealizedPnL: number;
}

export interface AnalyticsResponse {
  summary: SummaryMetric;
  filters: AnalyticsFilters;
  realizedViews: Record<RealizedTimeframe, TimeBucket[]>;
  equityCurve: EquityPoint[];
  drawdown: DrawdownSummary;
  calendarHeatmap: CalendarDay[];
  dayOfWeekBreakdown: DayOfWeekBreakdownRow[];
  holdingPeriodPoints: HoldingPeriodPoint[];
  streaks: StreakSummary;
  tradeExtremes: TradeExtremes;
  botManualBreakdown: BotManualRow[];
  strategyBreakdown: StrategyBreakdownRow[];
  stockBreakdown: StockBreakdownRow[];
  openPositions: TransactionRecord[];
}

export interface StockAnalyticsResponse {
  stock: string;
  summary: SummaryMetric;
  dailyPnL: TimeBucket[];
  equityCurve: EquityPoint[];
  drawdown: DrawdownSummary;
  strategyBreakdown: StrategyBreakdownRow[];
  trades: TransactionRecord[];
}

export interface StrategyAnalyticsResponse {
  positionSide: PositionSide;
  strategyType: string;
  summary: SummaryMetric;
  dailyPnL: TimeBucket[];
  equityCurve: EquityPoint[];
  drawdown: DrawdownSummary;
  stockBreakdown: StockBreakdownRow[];
  trades: TransactionRecord[];
}

export interface ImportBatchRecord {
  id: string;
  sourceFileName: string;
  importedAt: string;
  rowCount: number;
  errorCount: number;
}

export interface ImportHistoryResponse {
  items: ImportBatchRecord[];
}

export interface DailyReview {
  reviewDate: string;
  notes: string | null;
  chartImageDataUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DailyReviewInput {
  notes: string | null;
  chartImageDataUrl: string | null;
}

export interface DailyReviewResponse {
  review: DailyReview | null;
  summary: SummaryMetric;
  strategyBreakdown: StrategyBreakdownRow[];
  stockBreakdown: StockBreakdownRow[];
  trades: TransactionRecord[];
}

export interface PositionGroupRow {
  groupKey: string;
  label: string;
  stock: string;
  positionSide: PositionSide;
  strategyType: string;
  openedAt: string;
  closedAt: string | null;
  trades: number;
  realizedPnL: number;
  totalFees: number;
  tags: string[];
  isOpen: boolean;
}

export interface PositionGroupDetail extends PositionGroupRow {
  summary: SummaryMetric;
  lifecycle: TransactionRecord[];
}

export interface PositionGroupsResponse {
  items: PositionGroupRow[];
}

export interface CleanupRenameResult {
  updated: number;
}

export interface BackupTransactionRecord extends TransactionRecord {
  sourceRowHash: string;
  originalRowJson: unknown;
}

export interface BackupPayload {
  version: 1;
  exportedAt: string;
  importBatches: ImportBatchRecord[];
  transactions: BackupTransactionRecord[];
  dailyReviews: DailyReview[];
}

export interface BackupRestoreResult {
  importedBatches: number;
  importedTransactions: number;
  importedDailyReviews: number;
}

export interface ImportRowError {
  rowNumber: number;
  message: string;
}

export interface ImportResult {
  batchId: string;
  sourceFileName: string;
  imported: number;
  updated: number;
  skippedDuplicates: number;
  errors: ImportRowError[];
}
