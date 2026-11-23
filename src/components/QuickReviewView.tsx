import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  Check,
  CheckCircle2,
  RotateCcw,
} from 'lucide-react';
import { CATEGORIES, CATEGORY_META, Category, NavView, Transaction } from '../types';
import { formatCurrency } from '../utils/storage';

interface QuickReviewViewProps {
  transactions: Transaction[];
  onApproveTransaction: (
    txId: string,
    category: Category,
    saveRule: boolean
  ) => void;
  onNavigate: (view: NavView) => void;
}

export const QuickReviewView: React.FC<QuickReviewViewProps> = ({
  transactions,
  onApproveTransaction,
  onNavigate,
}) => {
  const [saveRuleChecked, setSaveRuleChecked] = useState(true);
  const [dragOffsetX, setDragOffsetX] = useState(0);
  const [dragStartX, setDragStartX] = useState<number | null>(null);
  const [lastReviewed, setLastReviewed] = useState<{
    merchant: string;
    category: Category;
    amount: number;
  } | null>(null);

  const reviewQueue = useMemo(
    () =>
      transactions
        .filter((t) => !t.reviewed && t.confidence < 0.7)
        .sort((a, b) => b.date.localeCompare(a.date)),
    [transactions]
  );

  const currentTx = reviewQueue[0] ?? null;

  const handleConfirm = useCallback(
    (category: Category) => {
      if (!currentTx) return;
      setLastReviewed({
        merchant: currentTx.normalizedMerchant,
        category,
        amount: currentTx.amount,
      });
      setDragOffsetX(0);
      setDragStartX(null);
      onApproveTransaction(currentTx.id, category, saveRuleChecked);
    },
    [currentTx, onApproveTransaction, saveRuleChecked]
  );

  // Keyboard shortcuts: Enter confirms suggested category, 1-9 picks category
  useEffect(() => {
    if (!currentTx) return;
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        handleConfirm(currentTx.category);
        return;
      }
      const num = parseInt(e.key, 10);
      if (num >= 1 && num <= 9 && CATEGORIES[num - 1]) {
        e.preventDefault();
        handleConfirm(CATEGORIES[num - 1]);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [currentTx, handleConfirm]);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    // Don't start drag on buttons/inputs
    if ((e.target as HTMLElement).closest('button, input, label')) return;
    setDragStartX(e.clientX);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (dragStartX === null) return;
    const delta = e.clientX - dragStartX;
    setDragOffsetX(Math.max(-140, Math.min(140, delta)));
  };

  const handlePointerUp = () => {
    if (dragStartX === null) return;
    if (dragOffsetX >= 90 && currentTx) {
      handleConfirm(currentTx.category);
    } else {
      setDragOffsetX(0);
    }
    setDragStartX(null);
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">
            Quick Swipe Review Queue
          </h2>
          <p className="text-xs text-slate-500">
            Transactions below 0.70 classification confidence are queued here
            for 1-tap verification.
          </p>
        </div>
        <div className="font-mono text-xs font-medium text-slate-600 tabular-nums whitespace-nowrap">
          {reviewQueue.length} remaining in queue
        </div>
      </div>

      {lastReviewed && (
        <div className="flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50/70 px-4 py-2.5 text-xs text-emerald-800">
          <span>
            Tagged <strong className="font-semibold">{lastReviewed.merchant}</strong>{' '}
            (<span className="font-mono tabular-nums">{formatCurrency(lastReviewed.amount)}</span>) as{' '}
            <strong className="font-semibold">{lastReviewed.category}</strong>
            {saveRuleChecked ? ' · Rule saved for future imports' : ''}
          </span>
        </div>
      )}

      {!currentTx ? (
        <div className="rounded-xl border border-slate-200 bg-white p-10 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700">
            <CheckCircle2 className="h-6 w-6" />
          </div>
          <h3 className="mt-4 text-lg font-semibold text-slate-900">
            Review queue cleared
          </h3>
          <p className="mx-auto mt-1.5 max-w-md text-sm text-slate-600">
            Every transaction in your local ledger now meets the 0.70+
            confidence threshold or has been verified by you.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <button
              type="button"
              onClick={() => onNavigate('transactions')}
              className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-800 whitespace-nowrap"
            >
              <span>Inspect All Transactions</span>
              <ArrowRight className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => onNavigate('dashboard')}
              className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 whitespace-nowrap"
            >
              Back to Dashboard
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Interactive Swipe / Review Card */}
          <div
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            style={{
              transform: `translateX(${dragOffsetX}px) rotate(${dragOffsetX * 0.03}deg)`,
            }}
            className="select-none rounded-xl border border-slate-200 bg-white p-6 transition-transform duration-150 ease-out"
          >
            <div className="flex flex-col justify-between gap-4 border-b border-slate-100 pb-5 sm:flex-row sm:items-start">
              <div className="min-w-0">
                <p className="text-xs text-slate-500">
                  <span className="font-mono tabular-nums">{currentTx.date}</span>
                  <span aria-hidden="true"> · </span>
                  <span>{currentTx.account}</span>
                  <span aria-hidden="true"> · </span>
                  <span className="font-mono font-medium text-amber-700 tabular-nums">
                    {Math.round(currentTx.confidence * 100)}% confidence
                  </span>
                </p>
                <h3 className="mt-1.5 text-xl font-semibold text-slate-900">
                  {currentTx.normalizedMerchant}
                </h3>
                <p className="mt-1 break-all font-mono text-xs text-slate-500">
                  {currentTx.rawDescription}
                </p>
              </div>

              <div className="shrink-0 sm:text-right">
                <p
                  className={`font-mono text-2xl font-semibold tabular-nums ${
                    currentTx.type === 'credit'
                      ? 'text-emerald-700'
                      : 'text-slate-900'
                  }`}
                >
                  {currentTx.type === 'credit' ? '+' : '-'}
                  {formatCurrency(currentTx.amount)}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Suggested: <span className="font-medium text-slate-800">{currentTx.category}</span>
                </p>
              </div>
            </div>

            {/* Merchant Memory Toggle */}
            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <label className="inline-flex cursor-pointer items-center gap-2.5 text-xs text-slate-700">
                <input
                  type="checkbox"
                  checked={saveRuleChecked}
                  onChange={(e) => setSaveRuleChecked(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-teal-700 focus:ring-teal-600"
                />
                <span>
                  Save rule for all past &amp; future{' '}
                  <strong className="font-medium text-slate-900">
                    {currentTx.normalizedMerchant}
                  </strong>
                </span>
              </label>

              <button
                type="button"
                onClick={() => handleConfirm(currentTx.category)}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-800 whitespace-nowrap"
              >
                <Check className="h-4 w-4" />
                <span>Confirm {currentTx.category}</span>
              </button>
            </div>

            {/* 9-Category 1-Tap Re-Tag Grid */}
            <div className="mt-6 border-t border-slate-100 pt-5">
              <div className="mb-2.5 flex items-center justify-between text-xs text-slate-500">
                <span>Or re-tag in one tap (keys 1–9, Enter to confirm)</span>
                {dragOffsetX > 20 && (
                  <span className="font-medium text-emerald-700">
                    Release to confirm {currentTx.category}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                {CATEGORIES.map((cat, idx) => {
                  const meta = CATEGORY_META[cat];
                  const isSuggested = currentTx.category === cat;
                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => handleConfirm(cat)}
                      className={`flex items-center justify-between rounded-lg border px-3 py-2.5 text-left text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-teal-600 ${
                        isSuggested
                          ? 'border-teal-600 bg-teal-50/70 text-slate-900'
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
                      <span className="ml-2 font-mono text-[11px] text-slate-400">
                        {idx + 1}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <p className="flex items-center justify-center gap-1.5 text-xs text-slate-400">
            <RotateCcw className="h-3.5 w-3.5" />
            <span>
              Tip: Drag card right or press Enter to accept the suggested category.
            </span>
          </p>
        </div>
      )}
    </div>
  );
};
