import { useState } from 'react';

import type { StrategyBreakdownRow, TransactionRecord } from '@trade-journal/shared';

import { defaultFilters, FilterBar } from './components/FilterBar';
import { BotManualPage } from './pages/BotManualPage';
import { CleanupPage } from './pages/CleanupPage';
import { DailyReviewPage } from './pages/DailyReviewPage';
import { DashboardPage } from './pages/DashboardPage';
import { ImportsPage } from './pages/ImportsPage';
import { OpenPositionsPage } from './pages/OpenPositionsPage';
import { PositionsPage } from './pages/PositionsPage';
import { StockDetailPage } from './pages/StockDetailPage';
import { StrategyDetailPage } from './pages/StrategyDetailPage';
import { TradeDetailPage } from './pages/TradeDetailPage';
import { TransactionsPage } from './pages/TransactionsPage';

const tabs = ['Dashboard', 'Positions', 'Transactions', 'Open Positions', 'Bot vs Manual', 'Imports', 'Cleanup'] as const;

export function App() {
  const [activeTab, setActiveTab] = useState<(typeof tabs)[number]>('Dashboard');
  const [filters, setFilters] = useState(defaultFilters);
  const [selectedStock, setSelectedStock] = useState<string | null>(null);
  const [selectedStrategy, setSelectedStrategy] = useState<StrategyBreakdownRow | null>(null);
  const [selectedTrade, setSelectedTrade] = useState<TransactionRecord | null>(null);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const isDetailPage = Boolean(selectedStock || selectedStrategy || selectedTrade || selectedDay);

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div>
          <p className="eyebrow">Single-user trading journal</p>
          <h1>Trade Journal</h1>
          <p className="sidebar-copy">
            Track stocks and options, separate open positions from realized performance,
            and compare bot-driven trades with manual ones.
          </p>
        </div>

        <nav className="nav-list" aria-label="Primary">
          {tabs.map((tab) => (
            <button
              key={tab}
              className={tab === activeTab && !isDetailPage ? 'nav-button nav-button-active' : 'nav-button'}
              onClick={() => {
                setSelectedStock(null);
                setSelectedStrategy(null);
                setSelectedTrade(null);
                setSelectedDay(null);
                setActiveTab(tab);
              }}
              type="button"
            >
              {tab}
            </button>
          ))}
        </nav>
      </aside>

      <main className="content">
        {!isDetailPage && activeTab !== 'Imports' && activeTab !== 'Cleanup' && <FilterBar filters={filters} onChange={setFilters} />}

        {selectedTrade ? (
          <TradeDetailPage trade={selectedTrade} onBack={() => setSelectedTrade(null)} />
        ) : selectedDay ? (
          <DailyReviewPage date={selectedDay} onBack={() => setSelectedDay(null)} onTradeSelect={setSelectedTrade} />
        ) : selectedStock ? (
          <StockDetailPage stock={selectedStock} onBack={() => setSelectedStock(null)} onTradeSelect={setSelectedTrade} />
        ) : selectedStrategy ? (
          <StrategyDetailPage
            positionSide={selectedStrategy.positionSide}
            strategyType={selectedStrategy.strategyType}
            onBack={() => setSelectedStrategy(null)}
            onTradeSelect={setSelectedTrade}
          />
        ) : (
          <>
            {activeTab === 'Dashboard' && (
              <DashboardPage
                filters={filters}
                onDaySelect={setSelectedDay}
                onStockSelect={setSelectedStock}
                onStrategySelect={setSelectedStrategy}
              />
            )}
            {activeTab === 'Positions' && <PositionsPage onTradeSelect={setSelectedTrade} />}
            {activeTab === 'Transactions' && <TransactionsPage filters={filters} onTradeSelect={setSelectedTrade} />}
            {activeTab === 'Open Positions' && <OpenPositionsPage filters={filters} />}
            {activeTab === 'Bot vs Manual' && <BotManualPage filters={filters} />}
            {activeTab === 'Imports' && <ImportsPage />}
            {activeTab === 'Cleanup' && <CleanupPage />}
          </>
        )}
      </main>
    </div>
  );
}
