import React from 'react';
import { Check, X } from 'lucide-react';
import { CATEGORIES, CATEGORY_META, Category, Transaction } from '../types';
import { formatCurrency } from '../utils/storage';

interface CategoryRuleModalProps {
  transaction: Transaction;
  selectedCategory: Category | null;
  onSelectCategory: (cat: Category) => void;
  onConfirmSingle: (cat: Category) => void;
  onConfirmRule: (cat: Category) => void;
  onClose: () => void;
  matchingCount: number;
}

export const CategoryRuleModal: React.FC<CategoryRuleModalProps> = ({
  transaction,
  selectedCategory,
  onSelectCategory,
  onConfirmSingle,
  onConfirmRule,
  onClose,
  matchingCount,
}) => {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="rule-modal-title"
    >
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-lg">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2
              id="rule-modal-title"
              className="text-base font-semibold text-slate-900"
            >
              {selectedCategory ? 'Save Merchant Rule?' : 'Assign Category'}
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              {transaction.normalizedMerchant}
              <span aria-hidden="true"> · </span>
              <span className="font-mono tabular-nums">
                {formatCurrency(transaction.amount)}
              </span>
              <span aria-hidden="true"> · </span>
              <span>{transaction.date}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-2 focus-visible:outline-teal-600"
            aria-label="Close modal"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {!selectedCategory ? (
          <div className="mt-4 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
            {CATEGORIES.map((cat) => {
              const isCurrent = transaction.category === cat;
              const meta = CATEGORY_META[cat];
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => onSelectCategory(cat)}
                  className={`flex items-center justify-between rounded-lg border px-3 py-2.5 text-left text-sm transition-colors focus-visible:outline-2 focus-visible:outline-teal-600 ${
                    isCurrent
                      ? 'border-teal-600 bg-teal-50/60 font-medium text-slate-900'
                      : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <span className="flex items-center gap-2 truncate">
                    <span
                      className={`h-2 w-2 shrink-0 rounded-full ${meta.dotColor}`}
                      aria-hidden="true"
                    />
                    <span className="truncate">{cat}</span>
                  </span>
                  {isCurrent && (
                    <Check className="h-3.5 w-3.5 shrink-0 text-teal-700" />
                  )}
                </button>
              );
            })}
          </div>
        ) : (
          <div className="mt-4 space-y-4">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
              Apply rule to all past &amp; future transactions from{' '}
              <span className="font-semibold text-slate-900">
                {transaction.normalizedMerchant}
              </span>{' '}
              as{' '}
              <span className="font-semibold text-teal-700">
                {selectedCategory}
              </span>
              ?
              {matchingCount > 1 && (
                <p className="mt-1.5 text-xs text-slate-500">
                  {matchingCount} matching transactions found in your local
                  ledger will be updated immediately.
                </p>
              )}
            </div>

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => onConfirmSingle(selectedCategory)}
                className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-teal-600 whitespace-nowrap"
              >
                Only This Transaction
              </button>
              <button
                type="button"
                onClick={() => onConfirmRule(selectedCategory)}
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-teal-600 whitespace-nowrap"
              >
                Apply to Past &amp; Future
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
