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
  mistakeTags: string[];
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
  mistakeTags: string[];
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
  latestCloseDate: string | null;
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

export interface NamedPerformanceRow {
  label: string;
  trades: number;
  wins: number;
  losses: number;
  winRate: number;
  realizedPnL: number;
  expectancy: number;
  profitFactor: number;
}

export interface RollingExpectancyPoint {
  date: string;
  tradeNumber: number;
  expectancy20: number | null;
  expectancy50: number | null;
  expectancy100: number | null;
}

export interface StrategyDecayRow {
  positionSide: PositionSide;
  strategyType: string;
  trades: number;
  recentTrades: number;
  priorTrades: number;
  recentExpectancy: number;
  priorExpectancy: number;
  delta: number;
  trend: 'Improving' | 'Declining' | 'Flat' | 'New';
}

export interface SetupCombinationRow extends NamedPerformanceRow {
  stock: string;
  positionSide: PositionSide;
  strategyType: string;
  dteBucket: string;
  source: 'Bot' | 'Manual';
}

export interface OptionAnalytics {
  dteBreakdown: NamedPerformanceRow[];
  expirationWeekdayBreakdown: NamedPerformanceRow[];
  spreadWidthBreakdown: NamedPerformanceRow[];
  creditDebitBreakdown: NamedPerformanceRow[];
  legCountBreakdown: NamedPerformanceRow[];
}

export interface PositionSizingRow extends NamedPerformanceRow {
  averageContracts: number;
  averageOpeningNotional: number;
}

export interface ConsistencyScore {
  score: number;
  winRateScore: number;
  expectancyScore: number;
  drawdownScore: number;
  profitFactorScore: number;
  returnVolatility: number;
}

export interface RiskSimulator {
  winRate: number;
  averageWin: number;
  averageLoss: number;
  breakevenWinRate: number;
  probabilityThreeLosses: number;
  probabilityFiveLosses: number;
  probabilityTenLosses: number;
  expectedTenTradePnL: number;
  expectedTwentyTradePnL: number;
  expectedFiftyTradePnL: number;
}

export interface DrawdownPoint {
  date: string;
  drawdown: number;
}

export interface MonthlyPace {
  month: string | null;
  elapsedTradingDays: number;
  currentPnL: number;
  averageDailyPnL: number;
  projectedMonthlyPnL: number;
}

export interface WhatIfScenario {
  label: string;
  tradesRemoved: number;
  realizedPnL: number;
  delta: number;
}

export interface RollingPerformancePoint {
  date: string;
  pnl7: number | null;
  pnl30: number | null;
  pnl90: number | null;
  winRate30: number | null;
  expectancy30: number | null;
  drawdown: number;
}

export interface EquityMilestone {
  date: string;
  label: string;
  realizedPnL: number;
  cumulativePnL: number;
  tradeCount: number;
}

export interface OpenRiskSummary {
  openPositions: number;
  totalEstimatedRisk: number;
  positionsWithRisk: number;
  earliestExpiration: string | null;
  largestRisk: TransactionRecord | null;
  expirationBuckets: NamedPerformanceRow[];
  stockConcentration: NamedPerformanceRow[];
  strategyConcentration: NamedPerformanceRow[];
}

export interface PnlAttribution {
  strategies: NamedPerformanceRow[];
  stocks: NamedPerformanceRow[];
  brokers: NamedPerformanceRow[];
  botManual: NamedPerformanceRow[];
  dayOfWeek: NamedPerformanceRow[];
  expirationDay: NamedPerformanceRow[];
  dte: NamedPerformanceRow[];
  size: NamedPerformanceRow[];
  holdingPeriod: NamedPerformanceRow[];
  side: NamedPerformanceRow[];
}

export interface ReviewAnalytics {
  totalClosedTrades: number;
  reviewedTrades: number;
  reviewCompletionRate: number;
  missingReviewTrades: number;
  tagBreakdown: NamedPerformanceRow[];
  mistakeBreakdown: NamedPerformanceRow[];
  exitReasonBreakdown: NamedPerformanceRow[];
  lessonKeywordBreakdown: NamedPerformanceRow[];
  missingChartOrReviewNote: number;
}

export interface UnsupportedAnalysis {
  label: string;
  reason: string;
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
  rollingExpectancy: RollingExpectancyPoint[];
  strategyDecay: StrategyDecayRow[];
  bestSetupCombinations: SetupCombinationRow[];
  optionAnalytics: OptionAnalytics;
  positionSizing: PositionSizingRow[];
  consistency: ConsistencyScore;
  riskSimulator: RiskSimulator;
  drawdownCurve: DrawdownPoint[];
  monthlyPace: MonthlyPace;
  whatIfScenarios: WhatIfScenario[];
  rollingPerformance: RollingPerformancePoint[];
  equityMilestones: EquityMilestone[];
  openRisk: OpenRiskSummary;
  pnlAttribution: PnlAttribution;
  reviewAnalytics: ReviewAnalytics;
  unsupportedAnalyses: UnsupportedAnalysis[];
  botManualBreakdown: BotManualRow[];
  brokerBreakdown: NamedPerformanceRow[];
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

export interface BrokerAnalyticsResponse {
  broker: string;
  summary: SummaryMetric;
  dailyPnL: TimeBucket[];
  equityCurve: EquityPoint[];
  drawdown: DrawdownSummary;
  strategyBreakdown: StrategyBreakdownRow[];
  stockBreakdown: StockBreakdownRow[];
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
  importedCount: number;
  updatedCount: number;
  skippedDuplicateCount: number;
}

export interface ImportHistoryResponse {
  items: ImportBatchRecord[];
}

export interface DailyReview {
  reviewDate: string;
  notes: string | null;
  chartImageDataUrl: string | null;
  whatWentWell: string | null;
  whatWentPoorly: string | null;
  lessonLearned: string | null;
  mood: string | null;
  disciplineScore: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface DailyReviewInput {
  notes: string | null;
  chartImageDataUrl: string | null;
  whatWentWell: string | null;
  whatWentPoorly: string | null;
  lessonLearned: string | null;
  mood: string | null;
  disciplineScore: number | null;
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

export interface ImportBatchReviewResponse {
  batch: ImportBatchRecord;
  summary: SummaryMetric;
  brokerBreakdown: NamedPerformanceRow[];
  strategyBreakdown: StrategyBreakdownRow[];
  stockBreakdown: StockBreakdownRow[];
  trades: TransactionRecord[];
}

export interface ImportReconciliationRow {
  sourceFileName: string;
  broker: string;
  batches: number;
  importedRows: number;
  updatedRows: number;
  skippedDuplicateRows: number;
  errorRows: number;
  tradeCount: number;
  closedTrades: number;
  openTrades: number;
  realizedPnL: number;
  fees: number;
  firstImportedAt: string | null;
  lastImportedAt: string | null;
}

export interface ImportReconciliationResponse {
  rows: ImportReconciliationRow[];
}
