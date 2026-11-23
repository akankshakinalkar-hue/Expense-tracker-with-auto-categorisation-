import React, { useMemo, useState } from 'react';
import { AlertCircle, AlertTriangle, CheckCircle2, Pencil } from 'lucide-react';
import {
  BudgetMap,
  CATEGORIES,
  CATEGORY_META,
  Category,
  Transaction,
} from '../types';
import { formatCurrency } from '../utils/storage';

interface BudgetsViewProps {
  transactions: Transaction[];
  budgets: BudgetMap;
  selectedMonth: string;
  availableMonths: string[];
  onMonthChange: (month: string) => void;
  onUpdateBudget: (category: Category, limit: number) => void;
}

function formatMonthLabel(ym: string): string {
  const [y, m] = ym.split('-').map(Number);
  if (!y || !m) return ym;
  return new Date(y, m - 1, 1).toLocaleDateString('en-US', {
    month: 'short',
    year: 'numeric',
  });
}

export const BudgetsView: React.FC<BudgetsViewProps> = ({
  transactions,
  budgets,
  selectedMonth,
  availableMonths,
  onMonthChange,
  onUpdateBudget,
}) => {
  const [editingCat, setEditingCat] = useState<Category | null>(null);
  const [draftValue, setDraftValue] = useState('');

  const spendByCategory = useMemo(() => {
    const map: Record<Category, number> = {
      'Food & Dining': 0,
      Groceries: 0,
      Transport: 0,
      Utilities: 0,
      Shopping: 0,
      Housing: 0,
      Health: 0,
      Entertainment: 0,
      Transfers: 0,
    };
    for (const tx of transactions) {
      if (tx.type === 'debit' && tx.date.startsWith(selectedMonth)) {
        map[tx.category] += tx.amount;
      }
    }
    return map;
  }, [transactions, selectedMonth]);

  const totals = useMemo(() => {
    const totalBudget = CATEGORIES.reduce((s, c) => s + (budgets[c] ?? 0), 0);
    const totalSpent = CATEGORIES.reduce((s, c) => s + spendByCategory[c], 0);
    const utilization =
      totalBudget > 0 ? Math.round((totalSpent / totalBudget) * 100) : 0;
    return { totalBudget, totalSpent, utilization };
  }, [budgets, spendByCategory]);

  const startEditing = (cat: Category) => {
    setEditingCat(cat);
    setDraftValue(String(budgets[cat] ?? 0));
  };

  const commitEdit = (cat: Category) => {
    const parsed = Math.max(0, Math.round(Number(draftValue) || 0));
    onUpdateBudget(cat, parsed);
    setEditingCat(null);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">
            Category Budgets &amp; Threshold Alerts
          </h2>
          <p className="text-xs text-slate-500">
            Monthly spending caps automatically highlight 80% warnings and
            budget overruns.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <label
            htmlFor="budget-month-select"
            className="text-xs font-medium text-slate-600 whitespace-nowrap"
          >
            Period
          </label>
          <select
            id="budget-month-select"
            value={selectedMonth}
            onChange={(e) => onMonthChange(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-900 focus:border-teal-600 focus:outline-none"
          >
            {availableMonths.map((ym) => (
              <option key={ym} value={ym}>
                {formatMonthLabel(ym)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Overall Summary Strip */}
      <div className="grid grid-cols-1 gap-4 rounded-xl border border-slate-200 bg-white p-5 sm:grid-cols-3">
        <div>
          <p className="text-xs font-medium text-slate-500">
            Combined Monthly Cap
          </p>
          <p className="mt-1 font-mono text-xl font-semibold text-slate-900 tabular-nums">
            {formatCurrency(totals.totalBudget)}
          </p>
        </div>
        <div>
          <p className="text-xs font-medium text-slate-500">
            Spent in {formatMonthLabel(selectedMonth)}
          </p>
          <p className="mt-1 font-mono text-xl font-semibold text-slate-900 tabular-nums">
            {formatCurrency(totals.totalSpent)}
          </p>
        </div>
        <div>
          <p className="text-xs font-medium text-slate-500">
            Overall Utilization
          </p>
          <p
            className={`mt-1 font-mono text-xl font-semibold tabular-nums ${
              totals.utilization >= 100
                ? 'text-red-600'
                : totals.utilization >= 80
                  ? 'text-amber-700'
                  : 'text-emerald-700'
            }`}
          >
            {totals.utilization}%
          </p>
        </div>
      </div>

      {/* Category Cards Grid */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {CATEGORIES.map((cat) => {
          const spent = spendByCategory[cat];
          const limit = budgets[cat] ?? 0;
          const pct = limit > 0 ? Math.round((spent / limit) * 100) : 0;
          const barWidth = Math.min(100, Math.max(0, pct));
          const meta = CATEGORY_META[cat];

          const state: 'normal' | 'warning' | 'exceeded' =
            limit > 0 && pct >= 100
              ? 'exceeded'
              : limit > 0 && pct >= 80
                ? 'warning'
                : 'normal';

          const barColor =
            state === 'exceeded'
              ? 'bg-red-600'
              : state === 'warning'
                ? 'bg-amber-500'
                : 'bg-emerald-600';

          return (
            <div
              key={cat}
              className={`flex flex-col justify-between rounded-xl border bg-white p-5 ${
                state === 'exceeded'
                  ? 'border-red-200'
                  : state === 'warning'
                    ? 'border-amber-200'
                    : 'border-slate-200'
              }`}
            >
              <div>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span
                      className={`h-2.5 w-2.5 shrink-0 rounded-sm ${meta.dotColor}`}
                      aria-hidden="true"
                    />
                    <h3 className="text-sm font-semibold text-slate-900">
                      {cat}
                    </h3>
                  </div>

                  {editingCat === cat ? (
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        commitEdit(cat);
                      }}
                      className="flex items-center gap-1.5"
                    >
                      <input
                        type="number"
                        min={0}
                        step={500}
                        value={draftValue}
                        onChange={(e) => setDraftValue(e.target.value)}
                        onBlur={() => commitEdit(cat)}
                        autoFocus
                        aria-label={`Monthly budget for ${cat}`}
                        className="w-24 rounded-md border border-teal-600 px-2 py-1 text-right font-mono text-xs text-slate-900 focus:outline-none"
                      />
                    </form>
                  ) : (
                    <button
                      type="button"
                      onClick={() => startEditing(cat)}
                      className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
                      aria-label={`Edit monthly limit for ${cat}`}
                    >
                      <span className="font-mono tabular-nums">
                        Cap {formatCurrency(limit)}
                      </span>
                      <Pencil className="h-3 w-3" />
                    </button>
                  )}
                </div>

                <div className="mt-4 flex items-baseline justify-between">
                  <span className="font-mono text-xl font-semibold text-slate-900 tabular-nums">
                    {formatCurrency(spent)}
                  </span>
                  <span className="font-mono text-xs font-medium text-slate-500 tabular-nums">
                    {pct}% used
                  </span>
                </div>

                {/* Progress Bar */}
                <div className="mt-2.5 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                  <div
                    className={`h-full rounded-full transition-all duration-200 ${barColor}`}
                    style={{ width: `${barWidth}%` }}
                  />
                </div>
              </div>

              {/* Explicit Status Message (Never Hue-Only) */}
              <div className="mt-4 border-t border-slate-100 pt-3">
                {state === 'exceeded' ? (
                  <p className="flex items-center gap-1.5 text-xs font-medium text-red-700">
                    <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                    <span>
                      Budget exceeded by{' '}
                      <span className="font-mono tabular-nums">
                        {formatCurrency(spent - limit)}
                      </span>
                    </span>
                  </p>
                ) : state === 'warning' ? (
                  <p className="flex items-center gap-1.5 text-xs font-medium text-amber-700">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                    <span>
                      Approaching monthly limit (
                      <span className="font-mono tabular-nums">
                        {formatCurrency(limit - spent)}
                      </span>{' '}
                      left)
                    </span>
                  </p>
                ) : (
                  <p className="flex items-center gap-1.5 text-xs text-emerald-700">
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                    <span>
                      On track ·{' '}
                      <span className="font-mono tabular-nums">
                        {formatCurrency(Math.max(0, limit - spent))}
                      </span>{' '}
                      remaining
                    </span>
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
