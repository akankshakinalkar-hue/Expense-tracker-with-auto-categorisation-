export const CATEGORIES = [
  'Food & Dining',
  'Groceries',
  'Transport',
  'Utilities',
  'Shopping',
  'Housing',
  'Health',
  'Entertainment',
  'Transfers',
] as const;

export type Category = (typeof CATEGORIES)[number];

export type TransactionType = 'debit' | 'credit';

export type CategorizationSource = 'rule' | 'ml' | 'manual';

export interface Transaction {
  id: string;
  date: string; // YYYY-MM-DD
  rawDescription: string; // PII-redacted raw description
  normalizedMerchant: string;
  amount: number;
  type: TransactionType;
  account: string;
  category: Category;
  confidence: number; // 0.00 to 1.00
  categorizedBy: CategorizationSource;
  reviewed: boolean;
  compositeKey: string;
  redactedCount: number;
  matchedKeywords?: string[];
}

export interface MerchantRule {
  id: string;
  merchantKey: string; // Uppercase/normalized key used for exact/substring match
  displayName: string;
  category: Category;
  createdAt: string;
}

export type BudgetMap = Record<Category, number>;

export interface AnomalyAlert {
  id: string;
  transactionId: string;
  transaction: Transaction;
  categoryAverage: number;
  categoryMedian: number;
  ratio: number;
  zScore: number;
  isolationScore: number;
  reason: string;
  severity: 'high' | 'medium';
  dismissed: boolean;
}

export type NavView =
  | 'dashboard'
  | 'transactions'
  | 'review'
  | 'budgets'
  | 'privacy';

export interface CategoryMeta {
  color: string;
  mutedBg: string;
  dotColor: string;
  description: string;
}

export const CATEGORY_META: Record<Category, CategoryMeta> = {
  'Food & Dining': {
    color: '#0D9488',
    mutedBg: '#F0FDFA',
    dotColor: 'bg-teal-600',
    description: 'Restaurants, food delivery, cafes, and quick bites',
  },
  Groceries: {
    color: '#16A34A',
    mutedBg: '#F0FDF4',
    dotColor: 'bg-emerald-600',
    description: 'Supermarkets, instant grocery apps, dairy, and produce',
  },
  Transport: {
    color: '#0284C7',
    mutedBg: '#F0F9FF',
    dotColor: 'bg-sky-600',
    description: 'Cabs, metro, fuel, flights, rail, and FASTag tolls',
  },
  Utilities: {
    color: '#4F46E5',
    mutedBg: '#EEF2FF',
    dotColor: 'bg-indigo-600',
    description: 'Electricity, broadband, mobile recharges, water, and gas',
  },
  Shopping: {
    color: '#D97706',
    mutedBg: '#FFFBEB',
    dotColor: 'bg-amber-600',
    description: 'Retail, electronics, apparel, and online marketplaces',
  },
  Housing: {
    color: '#475569',
    mutedBg: '#F8FAFC',
    dotColor: 'bg-slate-600',
    description: 'Monthly rent, society maintenance, and home repairs',
  },
  Health: {
    color: '#DC2626',
    mutedBg: '#FEF2F2',
    dotColor: 'bg-red-600',
    description: 'Pharmacies, diagnostics, doctor visits, and fitness',
  },
  Entertainment: {
    color: '#9333EA',
    mutedBg: '#FAF5FF',
    dotColor: 'bg-purple-600',
    description: 'Streaming subscriptions, cinema, concerts, and gaming',
  },
  Transfers: {
    color: '#64748B',
    mutedBg: '#F1F5F9',
    dotColor: 'bg-slate-500',
    description: 'P2P UPI transfers, NEFT/IMPS, investments, and payroll',
  },
};

export interface CSVColumnMapping {
  dateCol: string;
  descriptionCol: string;
  debitCol: string;
  creditCol: string;
  amountCol: string;
  typeCol: string;
  accountCol: string;
}

export interface ParseImportResult {
  transactions: Transaction[];
  duplicatesSkipped: number;
  redactedPIIItems: number;
  errors: string[];
}
