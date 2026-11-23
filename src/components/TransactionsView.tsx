import React, { useMemo, useState } from 'react';
import {
  BookMarked,
  ChevronDown,
  Search,
  Trash2,
} from 'lucide-react';
import {
  CATEGORIES,
  CATEGORY_META,
  Category,
  MerchantRule,
  Transaction,
} from '../types';
import { formatCurrency } from '../utils/storage';
import { normalizeMerchantKey } from '../utils/classifier';
import { CategoryRuleModal } from './CategoryRuleModal';

interface TransactionsViewProps {
  transactions: Transaction[];
  rules: MerchantRule[];
  recurringIds: Set<string>;
  onUpdateTransactionCategory: (
    txId: string,
    category: Category,
    applyToAllFromMerchant: boolean
  ) => void;
  onDeleteRule: (ruleId: string) => void;
}

export const TransactionsView: React.FC<TransactionsViewProps> = ({
  transactions,
  rules,
  recurringIds,
  onUpdateTransactionCategory,
  onDeleteRule,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [typeFilter, setTypeFilter] = useState<'all' | 'debit' | 'credit'>('all');
  const [accountFilter, setAccountFilter] = useState<string>('ALL');
  const [showRulesPanel, setShowRulesPanel] = useState(false);

  // Modal state for 1-tap merchant memory
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [pendingCategory, setPendingCategory] = useState<Category | null>(null);

  const accounts = useMemo(() => {
    const set = new Set(transactions.map((t) => t.account));
    return Array.from(set).sort();
  }, [transactions]);

  const filteredTransactions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return [...transactions]
      .sort((a, b) => b.date.localeCompare(a.date))
      .filter((tx) => {
        if (categoryFilter !== 'ALL' && tx.category !== categoryFilter) return false;
        if (typeFilter !== 'all' && tx.type !== typeFilter) return false;
        if (accountFilter !== 'ALL' && tx.account !== accountFilter) return false;
        if (q) {
          const match =
            tx.normalizedMerchant.toLowerCase().includes(q) ||
            tx.rawDescription.toLowerCase().includes(q) ||
            tx.category.toLowerCase().includes(q) ||
            tx.account.toLowerCase().includes(q);
          if (!match) return false;
        }
        return true;
      });
  }, [transactions, searchQuery, categoryFilter, typeFilter, accountFilter]);

  const matchingMerchantCount = useMemo(() => {
    if (!editingTx) return 0;
    const key = normalizeMerchantKey(editingTx.normalizedMerchant);
    if (!key) return 1;
    return transactions.filter(
      (t) => normalizeMerchantKey(t.normalizedMerchant) === key
    ).length;
  }, [editingTx, transactions]);

  const handleOpenCategoryPicker = (tx: Transaction) => {
    setEditingTx(tx);
    setPendingCategory(null);
  };

  const handleCloseModal = () => {
    setEditingTx(null);
    setPendingCategory(null);
  };

  return (
    <div className="space-y-5">
      {/* Header & Rules Toggle */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">
            Transactions &amp; 1-Tap Rules
          </h2>
          <p className="text-xs text-slate-500">
            Click any category button to re-tag and teach your local merchant
            dictionary.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowRulesPanel((v) => !v)}
          className={`inline-flex items-center gap-2 rounded-lg border px-3.5 py-2 text-xs font-medium transition-colors whitespace-nowrap ${
            showRulesPanel
              ? 'border-slate-900 bg-slate-900 text-white'
              : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
          }`}
        >
          <BookMarked className="h-3.5 w-3.5" />
          <span>
            {showRulesPanel ? 'Hide' : 'Manage'} Merchant Rules ({rules.length})
          </span>
        </button>
      </div>

      {/* Saved Merchant Rules Panel */}
      {showRulesPanel && (
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">
                Active User Rule Dictionary (Stage 1 Priority)
              </h3>
              <p className="text-xs text-slate-500">
                Rules override keyword scoring with 1.00 confidence on all past
                and future imports.
              </p>
            </div>
          </div>

          {rules.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-500">
              No custom merchant rules saved yet. Click any transaction&apos;s
              category below to create one in one tap.
            </p>
          ) : (
            <div className="mt-3 divide-y divide-slate-100">
              {rules.map((rule) => (
                <div
                  key={rule.id}
                  className="flex items-center justify-between gap-4 py-2.5 text-sm"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium text-slate-900">
                      {rule.displayName}
                    </p>
                    <p className="text-xs text-slate-500">
                      Matches{' '}
                      <span className="font-mono">{rule.merchantKey}</span>
                      <span aria-hidden="true"> · </span>
                      <span>Assigned to {rule.category}</span>
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onDeleteRule(rule.id)}
                    className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600"
                    aria-label={`Delete rule for ${rule.displayName}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Search & Filters */}
      <div className="grid grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-white p-4 md:grid-cols-12">
        <div className="relative md:col-span-5">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search merchant, narration, or account..."
            className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-teal-600 focus:bg-white focus:outline-none"
          />
        </div>

        <div className="md:col-span-3">
          <select
            aria-label="Filter by category"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-teal-600 focus:outline-none"
          >
            <option value="ALL">All Categories</option>
            {CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>

        <div className="md:col-span-2">
          <select
            aria-label="Filter by account"
            value={accountFilter}
            onChange={(e) => setAccountFilter(e.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-teal-600 focus:outline-none"
          >
            <option value="ALL">All Accounts</option>
            {accounts.map((acct) => (
              <option key={acct} value={acct}>
                {acct}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1 md:col-span-2">
          {(['all', 'debit', 'credit'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTypeFilter(t)}
              className={`flex-1 rounded-md px-2 py-1 text-xs font-medium capitalize transition-colors whitespace-nowrap ${
                typeFilter === t
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Transactions Ledger Table */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        {filteredTransactions.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-500">
            No transactions match your current filters.
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-medium text-slate-500">
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Merchant &amp; Narration</th>
                    <th className="px-4 py-3">Account</th>
                    <th className="px-4 py-3">Category (1-Tap)</th>
                    <th className="px-4 py-3">Confidence</th>
                    <th className="px-4 py-3 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredTransactions.map((tx) => {
                    const meta = CATEGORY_META[tx.category];
                    const isRecurring = recurringIds.has(tx.id);
                    const isLowConfidence = tx.confidence < 0.7;

                    return (
                      <tr
                        key={tx.id}
                        className="transition-colors hover:bg-slate-50/80"
                      >
                        <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-slate-500 tabular-nums">
                          {tx.date}
                        </td>
                        <td className="max-w-xs px-4 py-3">
                          <div className="truncate font-medium text-slate-900">
                            {tx.normalizedMerchant}
                          </div>
                          <div className="truncate text-xs text-slate-500">
                            {tx.rawDescription}
                            {isRecurring && (
                              <>
                                <span aria-hidden="true"> · </span>
                                <span className="text-slate-600">
                                  Recurring bill
                                </span>
                              </>
                            )}
                          </div>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-600">
                          {tx.account}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3">
                          <button
                            type="button"
                            onClick={() => handleOpenCategoryPicker(tx)}
                            className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-800 transition-colors hover:border-slate-300 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-teal-600"
                          >
                            <span
                              className={`h-2 w-2 shrink-0 rounded-full ${meta.dotColor}`}
                              aria-hidden="true"
                            />
                            <span>{tx.category}</span>
                            <ChevronDown className="h-3 w-3 text-slate-400" />
                          </button>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-xs">
                          <span
                            className={`font-mono tabular-nums ${
                              isLowConfidence
                                ? 'font-medium text-amber-700'
                                : 'text-slate-600'
                            }`}
                          >
                            {tx.confidence.toFixed(2)}
                          </span>
                          <span className="text-slate-400" aria-hidden="true">
                            {' '}
                            ·{' '}
                          </span>
                          <span className="text-slate-500">
                            {tx.categorizedBy === 'rule'
                              ? 'User rule'
                              : tx.categorizedBy === 'manual'
                                ? 'Manual'
                                : 'Auto ML'}
                          </span>
                        </td>
                        <td
                          className={`whitespace-nowrap px-4 py-3 text-right font-mono font-medium tabular-nums ${
                            tx.type === 'credit'
                              ? 'text-emerald-700'
                              : 'text-slate-900'
                          }`}
                        >
                          {tx.type === 'credit' ? '+' : '-'}
                          {formatCurrency(tx.amount)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Card List */}
            <div className="divide-y divide-slate-100 md:hidden">
              {filteredTransactions.map((tx) => {
                const meta = CATEGORY_META[tx.category];
                return (
                  <div key={tx.id} className="space-y-2 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-slate-900">
                          {tx.normalizedMerchant}
                        </p>
                        <p className="mt-0.5 text-xs text-slate-500">
                          <span className="font-mono tabular-nums">{tx.date}</span>
                          <span aria-hidden="true"> · </span>
                          <span>{tx.account}</span>
                        </p>
                      </div>
                      <span
                        className={`shrink-0 font-mono text-sm font-semibold tabular-nums ${
                          tx.type === 'credit'
                            ? 'text-emerald-700'
                            : 'text-slate-900'
                        }`}
                      >
                        {tx.type === 'credit' ? '+' : '-'}
                        {formatCurrency(tx.amount)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => handleOpenCategoryPicker(tx)}
                        className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-slate-800"
                      >
                        <span
                          className={`h-2 w-2 rounded-full ${meta.dotColor}`}
                          aria-hidden="true"
                        />
                        <span>{tx.category}</span>
                        <ChevronDown className="h-3 w-3 text-slate-400" />
                      </button>
                      <span className="font-mono text-xs text-slate-500 tabular-nums">
                        {tx.confidence.toFixed(2)} conf
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* 1-Tap Category & Merchant Memory Modal */}
      {editingTx && (
        <CategoryRuleModal
          transaction={editingTx}
          selectedCategory={pendingCategory}
          onSelectCategory={(cat) => setPendingCategory(cat)}
          onConfirmSingle={(cat) => {
            onUpdateTransactionCategory(editingTx.id, cat, false);
            handleCloseModal();
          }}
          onConfirmRule={(cat) => {
            onUpdateTransactionCategory(editingTx.id, cat, true);
            handleCloseModal();
          }}
          onClose={handleCloseModal}
          matchingCount={matchingMerchantCount}
        />
      )}
    </div>
  );
};
