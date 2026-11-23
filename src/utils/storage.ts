import { BudgetMap, MerchantRule, Transaction } from '../types';
import { DEFAULT_BUDGETS } from './sampleData';

const STORAGE_KEYS = {
  transactions: 'spendsense_transactions_v1',
  rules: 'spendsense_rules_v1',
  budgets: 'spendsense_budgets_v1',
  dismissedAnomalies: 'spendsense_dismissed_anomalies_v1',
  initialized: 'spendsense_initialized_v1',
};

export interface PersistedState {
  transactions: Transaction[];
  rules: MerchantRule[];
  budgets: BudgetMap;
  dismissedAnomalyIds: string[];
  hasInitialized: boolean;
}

export function loadLocalState(): PersistedState {
  try {
    const rawTx = localStorage.getItem(STORAGE_KEYS.transactions);
    const rawRules = localStorage.getItem(STORAGE_KEYS.rules);
    const rawBudgets = localStorage.getItem(STORAGE_KEYS.budgets);
    const rawDismissed = localStorage.getItem(STORAGE_KEYS.dismissedAnomalies);
    const hasInitialized = localStorage.getItem(STORAGE_KEYS.initialized) === 'true';

    return {
      transactions: rawTx ? (JSON.parse(rawTx) as Transaction[]) : [],
      rules: rawRules ? (JSON.parse(rawRules) as MerchantRule[]) : [],
      budgets: rawBudgets
        ? { ...DEFAULT_BUDGETS, ...(JSON.parse(rawBudgets) as Partial<BudgetMap>) }
        : { ...DEFAULT_BUDGETS },
      dismissedAnomalyIds: rawDismissed ? (JSON.parse(rawDismissed) as string[]) : [],
      hasInitialized,
    };
  } catch {
    return {
      transactions: [],
      rules: [],
      budgets: { ...DEFAULT_BUDGETS },
      dismissedAnomalyIds: [],
      hasInitialized: false,
    };
  }
}

export function saveTransactions(transactions: Transaction[]): void {
  localStorage.setItem(STORAGE_KEYS.transactions, JSON.stringify(transactions));
  localStorage.setItem(STORAGE_KEYS.initialized, 'true');
}

export function saveRules(rules: MerchantRule[]): void {
  localStorage.setItem(STORAGE_KEYS.rules, JSON.stringify(rules));
}

export function saveBudgets(budgets: BudgetMap): void {
  localStorage.setItem(STORAGE_KEYS.budgets, JSON.stringify(budgets));
}

export function saveDismissedAnomalies(ids: string[]): void {
  localStorage.setItem(STORAGE_KEYS.dismissedAnomalies, JSON.stringify(ids));
}

export function clearAllLocalData(): void {
  localStorage.removeItem(STORAGE_KEYS.transactions);
  localStorage.removeItem(STORAGE_KEYS.rules);
  localStorage.removeItem(STORAGE_KEYS.budgets);
  localStorage.removeItem(STORAGE_KEYS.dismissedAnomalies);
  localStorage.setItem(STORAGE_KEYS.initialized, 'true');
}

export function formatCurrency(amount: number): string {
  return `₹${Math.round(amount).toLocaleString('en-IN')}`;
}

export function exportTransactionsCSV(transactions: Transaction[]): string {
  const header = [
    'Date',
    'Merchant',
    'Category',
    'Type',
    'Amount',
    'Account',
    'Confidence',
    'Source',
    'Redacted Description',
  ].join(',');

  const escape = (val: string | number) => {
    const str = String(val);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const rows = transactions.map((tx) =>
    [
      tx.date,
      escape(tx.normalizedMerchant),
      escape(tx.category),
      tx.type,
      tx.amount.toFixed(2),
      escape(tx.account),
      tx.confidence.toFixed(2),
      tx.categorizedBy,
      escape(tx.rawDescription),
    ].join(',')
  );

  return [header, ...rows].join('\n');
}

export function triggerDownload(filename: string, content: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
