import { useEffect, useMemo, useState } from 'react';
import {
  CheckSquare,
  LayoutDashboard,
  ListFilter,
  PieChart,
  ShieldCheck,
} from 'lucide-react';
import {
  BudgetMap,
  Category,
  MerchantRule,
  NavView,
  Transaction,
} from './types';
import { detectAnomalies } from './utils/anomalyDetector';
import { classifyTransaction, normalizeMerchantKey } from './utils/classifier';
import { DEFAULT_BUDGETS, generateSampleTransactions } from './utils/sampleData';
import {
  clearAllLocalData,
  loadLocalState,
  saveBudgets,
  saveDismissedAnomalies,
  saveRules,
  saveTransactions,
} from './utils/storage';
import { BudgetsView } from './components/BudgetsView';
import { DashboardView } from './components/DashboardView';
import { ImportPrivacyView } from './components/ImportPrivacyView';
import { QuickReviewView } from './components/QuickReviewView';
import { TransactionsView } from './components/TransactionsView';

export default function App() {
  const [activeView, setActiveView] = useState<NavView>('dashboard');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [rules, setRules] = useState<MerchantRule[]>([]);
  const [budgets, setBudgets] = useState<BudgetMap>({ ...DEFAULT_BUDGETS });
  const [dismissedAnomalyIds, setDismissedAnomalyIds] = useState<string[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<string>('2026-11');

  // Hydrate local-first state; pre-load sample multi-account data on very first visit
  useEffect(() => {
    const state = loadLocalState();
    if (!state.hasInitialized) {
      const sample = generateSampleTransactions([]);
      setTransactions(sample);
      setRules([]);
      setBudgets({ ...DEFAULT_BUDGETS });
      setDismissedAnomalyIds([]);
      saveTransactions(sample);
      saveBudgets({ ...DEFAULT_BUDGETS });
    } else {
      setTransactions(state.transactions);
      setRules(state.rules);
      setBudgets(state.budgets);
      setDismissedAnomalyIds(state.dismissedAnomalyIds);
    }
  }, []);

  const availableMonths = useMemo(() => {
    const set = new Set(transactions.map((t) => t.date.slice(0, 7)));
    const list = Array.from(set).sort();
    return list.length > 0 ? list : ['2026-11'];
  }, [transactions]);

  // Keep selectedMonth aligned with available months
  useEffect(() => {
    if (availableMonths.length > 0 && !availableMonths.includes(selectedMonth)) {
      setSelectedMonth(availableMonths[availableMonths.length - 1]);
    }
  }, [availableMonths, selectedMonth]);

  const { alerts, recurringIds } = useMemo(() => {
    return detectAnomalies(
      transactions,
      new Set(dismissedAnomalyIds),
      selectedMonth
    );
  }, [transactions, dismissedAnomalyIds, selectedMonth]);

  const reviewQueueCount = useMemo(
    () => transactions.filter((t) => !t.reviewed && t.confidence < 0.7).length,
    [transactions]
  );

  const activeAnomalyCount = useMemo(
    () => alerts.filter((a) => !a.dismissed).length,
    [alerts]
  );

  const handleLoadSampleData = () => {
    const sample = generateSampleTransactions(rules);
    setTransactions(sample);
    setBudgets({ ...DEFAULT_BUDGETS });
    setDismissedAnomalyIds([]);
    saveTransactions(sample);
    saveBudgets({ ...DEFAULT_BUDGETS });
    saveDismissedAnomalies([]);
    setSelectedMonth('2026-11');
  };

  const handleClearAllData = () => {
    clearAllLocalData();
    setTransactions([]);
    setRules([]);
    setBudgets({ ...DEFAULT_BUDGETS });
    setDismissedAnomalyIds([]);
  };

  const handleImportTransactions = (newTxs: Transaction[]) => {
    if (newTxs.length === 0) return;
    setTransactions((prev) => {
      const updated = [...newTxs, ...prev];
      saveTransactions(updated);
      return updated;
    });
  };

  const handleUpdateTransactionCategory = (
    txId: string,
    category: Category,
    applyToAllFromMerchant: boolean
  ) => {
    const targetTx = transactions.find((t) => t.id === txId);
    if (!targetTx) return;

    const merchantKey = normalizeMerchantKey(targetTx.normalizedMerchant);

    if (applyToAllFromMerchant && merchantKey) {
      const newRule: MerchantRule = {
        id: `rule_${Date.now()}`,
        merchantKey,
        displayName: targetTx.normalizedMerchant,
        category,
        createdAt: new Date().toISOString(),
      };

      const nextRules = [
        newRule,
        ...rules.filter((r) => r.merchantKey !== merchantKey),
      ];
      setRules(nextRules);
      saveRules(nextRules);

      setTransactions((prev) => {
        const updated = prev.map((tx) => {
          const txKey = normalizeMerchantKey(tx.normalizedMerchant);
          if (tx.id === txId || txKey === merchantKey) {
            return {
              ...tx,
              category,
              confidence: 1.0,
              categorizedBy: 'rule' as const,
              reviewed: true,
              matchedKeywords: [`Rule: ${targetTx.normalizedMerchant}`],
            };
          }
          return tx;
        });
        saveTransactions(updated);
        return updated;
      });
    } else {
      setTransactions((prev) => {
        const updated = prev.map((tx) =>
          tx.id === txId
            ? {
                ...tx,
                category,
                confidence: 1.0,
                categorizedBy: 'manual' as const,
                reviewed: true,
              }
            : tx
        );
        saveTransactions(updated);
        return updated;
      });
    }
  };

  const handleApproveReview = (
    txId: string,
    category: Category,
    saveRule: boolean
  ) => {
    handleUpdateTransactionCategory(txId, category, saveRule);
  };

  const handleDeleteRule = (ruleId: string) => {
    const nextRules = rules.filter((r) => r.id !== ruleId);
    setRules(nextRules);
    saveRules(nextRules);

    // Re-evaluate rule-based transactions cleanly using remaining rules + ML
    setTransactions((prev) => {
      const updated = prev.map((tx) => {
        if (tx.categorizedBy !== 'rule') return tx;
        const result = classifyTransaction(
          tx.rawDescription,
          tx.normalizedMerchant,
          nextRules
        );
        return {
          ...tx,
          category: result.category,
          confidence: result.confidence,
          categorizedBy: result.categorizedBy,
          reviewed: result.confidence >= 0.7 || result.categorizedBy === 'rule',
          matchedKeywords: result.matchedKeywords,
        };
      });
      saveTransactions(updated);
      return updated;
    });
  };

  const handleUpdateBudget = (category: Category, limit: number) => {
    setBudgets((prev) => {
      const next = { ...prev, [category]: limit };
      saveBudgets(next);
      return next;
    });
  };

  const handleDismissAnomaly = (txId: string) => {
    setDismissedAnomalyIds((prev) => {
      const next = Array.from(new Set([...prev, txId]));
      saveDismissedAnomalies(next);
      return next;
    });
  };

  const navItems: {
    id: NavView;
    label: string;
    mobileLabel: string;
    icon: typeof LayoutDashboard;
    count?: number;
  }[] = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      mobileLabel: 'Overview',
      icon: LayoutDashboard,
      count: activeAnomalyCount > 0 ? activeAnomalyCount : undefined,
    },
    {
      id: 'transactions',
      label: 'Transactions',
      mobileLabel: 'Ledger',
      icon: ListFilter,
    },
    {
      id: 'review',
      label: 'Review Queue',
      mobileLabel: 'Review',
      icon: CheckSquare,
      count: reviewQueueCount > 0 ? reviewQueueCount : undefined,
    },
    {
      id: 'budgets',
      label: 'Category Budgets',
      mobileLabel: 'Budgets',
      icon: PieChart,
    },
    {
      id: 'privacy',
      label: 'Import & Privacy',
      mobileLabel: 'Import',
      icon: ShieldCheck,
    },
  ];

  const activeNavTitle =
    navItems.find((item) => item.id === activeView)?.label ?? 'Dashboard';

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 lg:flex">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex lg:w-64 lg:shrink-0 lg:flex-col lg:border-r lg:border-slate-200 lg:bg-white">
        <div className="flex h-16 items-center border-b border-slate-200 px-6">
          <span className="font-display text-lg font-bold tracking-tight text-slate-900">
            SpendSense
          </span>
        </div>

        <nav className="flex-1 space-y-1 p-4" aria-label="Primary navigation">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeView === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveView(item.id)}
                className={`flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium transition-colors whitespace-nowrap ${
                  isActive
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <span className="flex items-center gap-2.5">
                  <Icon className="h-4 w-4 shrink-0" />
                  <span>{item.label}</span>
                </span>
                {item.count !== undefined && (
                  <span
                    className={`font-mono text-xs tabular-nums ${
                      isActive ? 'text-slate-200' : 'text-amber-700 font-semibold'
                    }`}
                  >
                    {item.count}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="border-t border-slate-200 p-4 text-xs text-slate-500">
          <p className="font-medium text-slate-700">Local-Only Storage</p>
          <p className="mt-0.5 leading-relaxed">
            Zero credentials · PII redacted in browser
          </p>
        </div>
      </aside>

      {/* Main Content Shell */}
      <div className="flex min-w-0 flex-1 flex-col pb-20 lg:pb-0">
        {/* Top Bar Contract: Context title left, 1 primary action right */}
        <header className="flex h-16 items-center justify-between gap-4 border-b border-slate-200 bg-white px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3 min-w-0">
            <span className="font-display text-base font-bold tracking-tight text-slate-900 lg:hidden whitespace-nowrap">
              SpendSense
            </span>
            <span className="text-slate-300 lg:hidden" aria-hidden="true">
              /
            </span>
            <h1 className="truncate text-sm font-semibold text-slate-800 sm:text-base">
              {activeNavTitle}
            </h1>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {activeView !== 'privacy' ? (
              <button
                type="button"
                onClick={() => setActiveView('privacy')}
                className="rounded-lg bg-slate-900 px-3.5 py-2 text-xs font-medium text-white transition-colors hover:bg-slate-800 whitespace-nowrap shrink-0"
              >
                Import Statement
              </button>
            ) : (
              <button
                type="button"
                onClick={handleLoadSampleData}
                className="rounded-lg bg-slate-900 px-3.5 py-2 text-xs font-medium text-white transition-colors hover:bg-slate-800 whitespace-nowrap shrink-0"
              >
                Load Sample Demo Data
              </button>
            )}
          </div>
        </header>

        {/* Active View Viewport */}
        <main className="mx-auto w-full max-w-6xl flex-1 p-4 sm:p-6 lg:p-8">
          {activeView === 'dashboard' && (
            <DashboardView
              transactions={transactions}
              budgets={budgets}
              alerts={alerts}
              recurringIds={recurringIds}
              selectedMonth={selectedMonth}
              availableMonths={availableMonths}
              onMonthChange={setSelectedMonth}
              onDismissAnomaly={handleDismissAnomaly}
              onNavigate={setActiveView}
              onLoadSampleData={handleLoadSampleData}
            />
          )}

          {activeView === 'transactions' && (
            <TransactionsView
              transactions={transactions}
              rules={rules}
              recurringIds={recurringIds}
              onUpdateTransactionCategory={handleUpdateTransactionCategory}
              onDeleteRule={handleDeleteRule}
            />
          )}

          {activeView === 'review' && (
            <QuickReviewView
              transactions={transactions}
              onApproveTransaction={handleApproveReview}
              onNavigate={setActiveView}
            />
          )}

          {activeView === 'budgets' && (
            <BudgetsView
              transactions={transactions}
              budgets={budgets}
              selectedMonth={selectedMonth}
              availableMonths={availableMonths}
              onMonthChange={setSelectedMonth}
              onUpdateBudget={handleUpdateBudget}
            />
          )}

          {activeView === 'privacy' && (
            <ImportPrivacyView
              transactions={transactions}
              rules={rules}
              onImportTransactions={handleImportTransactions}
              onLoadSampleData={handleLoadSampleData}
              onClearAllData={handleClearAllData}
            />
          )}
        </main>
      </div>

      {/* Mobile Bottom Navigation Bar (Compact <= 56px, < 15% mobile viewport) */}
      <nav
        aria-label="Mobile navigation"
        className="fixed inset-x-0 bottom-0 z-40 grid h-14 grid-cols-5 border-t border-slate-200 bg-white lg:hidden"
      >
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeView === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveView(item.id)}
              className={`relative flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-colors ${
                isActive ? 'text-slate-900' : 'text-slate-500'
              }`}
            >
              <Icon className="h-4 w-4" />
              <span className="truncate">{item.mobileLabel}</span>
              {item.count !== undefined && (
                <span className="absolute right-2.5 top-1.5 font-mono text-[10px] font-semibold text-amber-700 tabular-nums">
                  {item.count}
                </span>
              )}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
