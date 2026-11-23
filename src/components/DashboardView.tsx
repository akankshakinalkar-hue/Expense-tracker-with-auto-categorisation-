import React, { useMemo } from 'react';
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  CheckCircle2,
  ShieldCheck,
  Upload,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  AnomalyAlert,
  BudgetMap,
  CATEGORIES,
  CATEGORY_META,
  NavView,
  Transaction,
} from '../types';
import { formatCurrency } from '../utils/storage';

interface DashboardViewProps {
  transactions: Transaction[];
  budgets: BudgetMap;
  alerts: AnomalyAlert[];
  recurringIds: Set<string>;
  selectedMonth: string;
  availableMonths: string[];
  onMonthChange: (month: string) => void;
  onDismissAnomaly: (txId: string) => void;
  onNavigate: (view: NavView) => void;
  onLoadSampleData: () => void;
}

function formatMonthLabel(ym: string): string {
  const [y, m] = ym.split('-').map(Number);
  if (!y || !m) return ym;
  const date = new Date(y, m - 1, 1);
  return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  transactions,
  budgets,
  alerts,
  recurringIds,
  selectedMonth,
  availableMonths,
  onMonthChange,
  onDismissAnomaly,
  onNavigate,
  onLoadSampleData,
}) => {
  const activeAlerts = useMemo(
    () => alerts.filter((a) => !a.dismissed),
    [alerts]
  );

  const monthTransactions = useMemo(
    () => transactions.filter((t) => t.date.startsWith(selectedMonth)),
    [transactions, selectedMonth]
  );

  const kpis = useMemo(() => {
    let inflow = 0;
    let burn = 0;
    let creditCount = 0;
    let debitCount = 0;

    for (const tx of monthTransactions) {
      if (tx.type === 'credit') {
        inflow += tx.amount;
        creditCount += 1;
      } else {
        burn += tx.amount;
        debitCount += 1;
      }
    }

    const netSavings = inflow - burn;
    const savingsRate = inflow > 0 ? Math.round((netSavings / inflow) * 100) : 0;

    // Previous month comparison
    const idx = availableMonths.indexOf(selectedMonth);
    const prevMonth = idx > 0 ? availableMonths[idx - 1] : null;
    let prevBurn = 0;
    if (prevMonth) {
      prevBurn = transactions
        .filter((t) => t.date.startsWith(prevMonth) && t.type === 'debit')
        .reduce((s, t) => s + t.amount, 0);
    }
    const burnDeltaPct =
      prevBurn > 0 ? Math.round(((burn - prevBurn) / prevBurn) * 100) : null;

    return {
      inflow,
      burn,
      netSavings,
      savingsRate,
      creditCount,
      debitCount,
      burnDeltaPct,
      prevMonth,
    };
  }, [monthTransactions, availableMonths, selectedMonth, transactions]);

  const categoryBreakdown = useMemo(() => {
    const totals: Record<string, number> = {};
    for (const cat of CATEGORIES) totals[cat] = 0;
    for (const tx of monthTransactions) {
      if (tx.type === 'debit') {
        totals[tx.category] = (totals[tx.category] ?? 0) + tx.amount;
      }
    }
    const totalBurn = Object.values(totals).reduce((s, v) => s + v, 0);
    return CATEGORIES.map((cat) => ({
      name: cat,
      value: Math.round(totals[cat] ?? 0),
      color: CATEGORY_META[cat].color,
      share: totalBurn > 0 ? Math.round(((totals[cat] ?? 0) / totalBurn) * 100) : 0,
    }))
      .filter((item) => item.value > 0)
      .sort((a, b) => b.value - a.value);
  }, [monthTransactions]);

  const momTrendData = useMemo(() => {
    const recentMonths = availableMonths.slice(-6);
    return recentMonths.map((ym) => {
      let inflow = 0;
      let burn = 0;
      for (const tx of transactions) {
        if (!tx.date.startsWith(ym)) continue;
        if (tx.type === 'credit') inflow += tx.amount;
        else burn += tx.amount;
      }
      return {
        month: formatMonthLabel(ym),
        Inflow: Math.round(inflow),
        Burn: Math.round(burn),
        Savings: Math.round(Math.max(0, inflow - burn)),
      };
    });
  }, [availableMonths, transactions]);

  const budgetAlerts = useMemo(() => {
    const spentByCat: Record<string, number> = {};
    for (const tx of monthTransactions) {
      if (tx.type === 'debit') {
        spentByCat[tx.category] = (spentByCat[tx.category] ?? 0) + tx.amount;
      }
    }
    return CATEGORIES.map((cat) => {
      const limit = budgets[cat] ?? 0;
      const spent = spentByCat[cat] ?? 0;
      const pct = limit > 0 ? (spent / limit) * 100 : 0;
      return { category: cat, limit, spent, pct };
    })
      .filter((b) => b.limit > 0 && b.pct >= 80)
      .sort((a, b) => b.pct - a.pct);
  }, [monthTransactions, budgets]);

  const recurringCount = useMemo(
    () => monthTransactions.filter((t) => recurringIds.has(t.id)).length,
    [monthTransactions, recurringIds]
  );

  if (transactions.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-10 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-teal-700">
          <ShieldCheck className="h-6 w-6" />
        </div>
        <h2 className="mt-4 text-xl font-semibold text-slate-900">
          Your local ledger is ready
        </h2>
        <p className="mx-auto mt-2 max-w-lg text-sm text-slate-600">
          SpendSense processes bank CSV statements and payment SMS alerts
          entirely inside your browser. No bank passwords or external servers
          involved.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={onLoadSampleData}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-800 whitespace-nowrap"
          >
            Load Sample Demo Data
          </button>
          <button
            type="button"
            onClick={() => onNavigate('privacy')}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 whitespace-nowrap"
          >
            <Upload className="h-4 w-4" />
            Import CSV or SMS
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Month filter toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">
            Cash-Flow &amp; Variance Overview
          </h2>
          <p className="text-xs text-slate-500">
            {monthTransactions.length} transactions in{' '}
            {formatMonthLabel(selectedMonth)}
            <span aria-hidden="true"> · </span>
            <span>{recurringCount} recurring bills suppressed from alerts</span>
          </p>
        </div>

        <div className="flex items-center gap-2">
          <label
            htmlFor="dashboard-month-select"
            className="text-xs font-medium text-slate-600 whitespace-nowrap"
          >
            Statement Period
          </label>
          <select
            id="dashboard-month-select"
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

      {/* 4 KPI Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Total Monthly Inflow</span>
            <ArrowUpRight className="h-4 w-4 text-emerald-600" />
          </div>
          <p className="mt-2 font-mono text-2xl font-semibold text-slate-900 tabular-nums">
            {formatCurrency(kpis.inflow)}
          </p>
          <p className="mt-1.5 text-xs text-emerald-700">
            {kpis.creditCount} credit {kpis.creditCount === 1 ? 'entry' : 'entries'}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Total Monthly Burn</span>
            <ArrowDownRight className="h-4 w-4 text-slate-600" />
          </div>
          <p className="mt-2 font-mono text-2xl font-semibold text-slate-900 tabular-nums">
            {formatCurrency(kpis.burn)}
          </p>
          <p className="mt-1.5 text-xs text-slate-500">
            {kpis.debitCount} debits
            {kpis.burnDeltaPct !== null && kpis.prevMonth && (
              <>
                <span aria-hidden="true"> · </span>
                <span
                  className={
                    kpis.burnDeltaPct > 10
                      ? 'font-medium text-amber-700'
                      : 'text-slate-600'
                  }
                >
                  {kpis.burnDeltaPct > 0 ? '+' : ''}
                  {kpis.burnDeltaPct}% vs {formatMonthLabel(kpis.prevMonth)}
                </span>
              </>
            )}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Net Savings</span>
            <span className="font-mono text-xs text-slate-500 tabular-nums">
              {kpis.savingsRate}%
            </span>
          </div>
          <p
            className={`mt-2 font-mono text-2xl font-semibold tabular-nums ${
              kpis.netSavings >= 0 ? 'text-emerald-700' : 'text-red-600'
            }`}
          >
            {kpis.netSavings >= 0 ? '' : '-'}
            {formatCurrency(Math.abs(kpis.netSavings))}
          </p>
          <p className="mt-1.5 text-xs text-slate-500">
            {kpis.netSavings >= 0
              ? `Retained ${kpis.savingsRate}% of inflow`
              : 'Outflows exceed monthly inflow'}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Active Anomaly Count</span>
            <AlertTriangle
              className={`h-4 w-4 ${
                activeAlerts.length > 0 ? 'text-red-600' : 'text-emerald-600'
              }`}
            />
          </div>
          <p
            className={`mt-2 font-mono text-2xl font-semibold tabular-nums ${
              activeAlerts.length > 0 ? 'text-red-600' : 'text-slate-900'
            }`}
          >
            {activeAlerts.length}
          </p>
          <p className="mt-1.5 text-xs text-slate-500">
            {activeAlerts.length > 0
              ? 'Non-recurring spikes flagged'
              : 'All expenses within normal range'}
          </p>
        </div>
      </div>

      {/* Proactive Anomaly & Spike Alerts */}
      <section aria-labelledby="anomaly-alerts-heading">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h3
              id="anomaly-alerts-heading"
              className="text-base font-semibold text-slate-900"
            >
              Proactive Anomaly &amp; Spike Alerts
            </h3>
            <p className="text-xs text-slate-500">
              Evaluated against your rolling 90-day non-recurring category baseline
            </p>
          </div>
          {budgetAlerts.length > 0 && (
            <button
              type="button"
              onClick={() => onNavigate('budgets')}
              className="text-xs font-medium text-teal-700 hover:text-teal-800 hover:underline whitespace-nowrap"
            >
              View {budgetAlerts.length} budget warning
              {budgetAlerts.length > 1 ? 's' : ''}
            </button>
          )}
        </div>

        {activeAlerts.length === 0 ? (
          <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-5 py-4 text-sm text-slate-600">
            <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
            <span>
              No active spending spikes in {formatMonthLabel(selectedMonth)}.
              Recurring bills are automatically suppressed.
            </span>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {activeAlerts.map((alert) => (
              <div
                key={alert.id}
                className="flex flex-col justify-between gap-4 rounded-xl border border-red-200 bg-white p-5"
              >
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 text-xs font-medium text-red-700">
                        <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                        <span>
                          {alert.severity === 'high'
                            ? 'High Variance Spike'
                            : 'Moderate Spending Spike'}
                        </span>
                      </div>
                      <h4 className="mt-1 text-base font-semibold text-slate-900">
                        {alert.transaction.normalizedMerchant}
                      </h4>
                    </div>
                    <span className="font-mono text-base font-semibold text-red-600 tabular-nums">
                      {formatCurrency(alert.transaction.amount)}
                    </span>
                  </div>

                  <p className="mt-2 text-sm text-slate-700">{alert.reason}</p>

                  <p className="mt-2 text-xs text-slate-500">
                    {alert.transaction.date}
                    <span aria-hidden="true"> · </span>
                    <span>{alert.transaction.account}</span>
                    <span aria-hidden="true"> · </span>
                    <span className="font-mono tabular-nums">
                      z-score {alert.zScore}
                    </span>
                    <span aria-hidden="true"> · </span>
                    <span className="font-mono tabular-nums">
                      isolation {alert.isolationScore}
                    </span>
                  </p>
                </div>

                <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-3">
                  <button
                    type="button"
                    onClick={() => onDismissAnomaly(alert.transactionId)}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 whitespace-nowrap"
                  >
                    Dismiss &amp; Mark as Expected
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Interactive Charts Row */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Month-over-Month Cash-Flow Trend */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 lg:col-span-7">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-base font-semibold text-slate-900">
                Month-over-Month Cash Flow
              </h3>
              <p className="text-xs text-slate-500">
                Monthly inflow vs. total burn across linked local statements
              </p>
            </div>
          </div>

          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={momTrendData}
                margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                <XAxis
                  dataKey="month"
                  tick={{ fill: '#64748B', fontSize: 12 }}
                  axisLine={{ stroke: '#E2E8F0' }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: '#64748B', fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v: number) =>
                    v >= 1000 ? `₹${Math.round(v / 1000)}k` : `₹${v}`
                  }
                />
                <Tooltip
                  formatter={(value) => formatCurrency(Number(value ?? 0))}
                  contentStyle={{
                    borderRadius: '8px',
                    border: '1px solid #E2E8F0',
                    boxShadow: '0 4px 12px rgba(15, 23, 42, 0.08)',
                    fontSize: '12px',
                  }}
                />
                <Bar
                  dataKey="Inflow"
                  fill="#16A34A"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={36}
                />
                <Bar
                  dataKey="Burn"
                  fill="#0F172A"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={36}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Category Spend Donut & Breakdown */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 lg:col-span-5">
          <div className="mb-4">
            <h3 className="text-base font-semibold text-slate-900">
              Category Spend Breakdown
            </h3>
            <p className="text-xs text-slate-500">
              {formatMonthLabel(selectedMonth)} debit distribution
            </p>
          </div>

          {categoryBreakdown.length === 0 ? (
            <div className="flex h-64 items-center justify-center text-sm text-slate-500">
              No expense debits recorded in this period.
            </div>
          ) : (
            <div className="space-y-4">
              <div className="h-48 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={categoryBreakdown}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={52}
                      outerRadius={80}
                      paddingAngle={2}
                    >
                      {categoryBreakdown.map((entry) => (
                        <Cell key={entry.name} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value) => formatCurrency(Number(value ?? 0))}
                      contentStyle={{
                        borderRadius: '8px',
                        border: '1px solid #E2E8F0',
                        fontSize: '12px',
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="divide-y divide-slate-100 border-t border-slate-100">
                {categoryBreakdown.slice(0, 6).map((item) => (
                  <div
                    key={item.name}
                    className="flex items-center justify-between py-2 text-xs"
                  >
                    <div className="flex items-center gap-2 text-slate-700">
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-sm"
                        style={{ backgroundColor: item.color }}
                        aria-hidden="true"
                      />
                      <span>{item.name}</span>
                    </div>
                    <div className="flex items-center gap-3 font-mono tabular-nums">
                      <span className="text-slate-400">{item.share}%</span>
                      <span className="font-medium text-slate-900">
                        {formatCurrency(item.value)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
