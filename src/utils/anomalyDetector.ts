import { AnomalyAlert, CATEGORIES, Category, Transaction } from '../types';
import { normalizeMerchantKey } from './classifier';

/**
 * Identify fixed-amount, periodic recurring bills (e.g., monthly rent, Netflix, broadband)
 * so they are excluded from anomaly spike alerts.
 */
export function detectRecurringTransactionIds(transactions: Transaction[]): Set<string> {
  const recurringIds = new Set<string>();
  const groups = new Map<string, Transaction[]>();

  for (const tx of transactions) {
    if (tx.type !== 'debit') continue;
    const key = `${normalizeMerchantKey(tx.normalizedMerchant)}|${tx.category}`;
    const list = groups.get(key) ?? [];
    list.push(tx);
    groups.set(key, list);
  }

  for (const [, list] of groups) {
    if (list.length < 2) continue;
    const sorted = [...list].sort((a, b) => a.date.localeCompare(b.date));

    // Check pairs for monthly (~25-35 days) or annual (~355-375 days) periodicity with <= 5% variance
    for (let i = 0; i < sorted.length; i += 1) {
      for (let j = i + 1; j < sorted.length; j += 1) {
        const t1 = new Date(sorted[i].date).getTime();
        const t2 = new Date(sorted[j].date).getTime();
        const diffDays = Math.abs(t2 - t1) / (1000 * 60 * 60 * 24);

        const maxAmt = Math.max(sorted[i].amount, sorted[j].amount);
        const minAmt = Math.min(sorted[i].amount, sorted[j].amount);
        const variance = maxAmt > 0 ? (maxAmt - minAmt) / maxAmt : 0;

        const isMonthly = diffDays >= 24 && diffDays <= 36;
        const isAnnual = diffDays >= 355 && diffDays <= 375;

        if ((isMonthly || isAnnual) && variance <= 0.05) {
          recurringIds.add(sorted[i].id);
          recurringIds.add(sorted[j].id);
        }
      }
    }
  }

  return recurringIds;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

function stdDev(values: number[], avg: number): number {
  if (values.length < 2) return 0;
  const variance =
    values.reduce((sum, val) => sum + (val - avg) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

function formatINR(amount: number): string {
  return `₹${Math.round(amount).toLocaleString('en-IN')}`;
}

/**
 * Isolation Forest-inspired anomaly & spending spike detector.
 * Evaluates non-recurring debit transactions against rolling 90-day category distributions
 * (mean, median, IQR, z-score, and 30-day velocity).
 */
export function detectAnomalies(
  transactions: Transaction[],
  dismissedIds: Set<string>,
  targetMonth?: string
): {
  alerts: AnomalyAlert[];
  recurringIds: Set<string>;
} {
  const recurringIds = detectRecurringTransactionIds(transactions);
  const debits = transactions.filter((t) => t.type === 'debit');

  if (debits.length === 0) {
    return { alerts: [], recurringIds };
  }

  // Determine latest month in dataset if not provided
  const latestDate = debits
    .map((t) => t.date)
    .sort()
    .pop()!;
  const activeMonth = targetMonth ?? latestDate.slice(0, 7);

  // Rolling 90-day window ending at latestDate
  const latestMs = new Date(latestDate).getTime();
  const ninetyDaysMs = 90 * 24 * 60 * 60 * 1000;

  const alerts: AnomalyAlert[] = [];

  for (const category of CATEGORIES) {
    // Non-recurring historical baseline in this category within 90-day window
    const categoryHistory = debits.filter((t) => {
      if (t.category !== category) return false;
      if (recurringIds.has(t.id)) return false;
      const ms = new Date(t.date).getTime();
      return latestMs - ms <= ninetyDaysMs;
    });

    if (categoryHistory.length < 3) continue;

    // Evaluate non-recurring debits in the active month
    const monthCandidates = categoryHistory.filter((t) =>
      t.date.startsWith(activeMonth)
    );

    for (const tx of monthCandidates) {
      // Leave-one-out baseline so the spike itself doesn't distort its own reference mean
      const baseline = categoryHistory
        .filter((other) => other.id !== tx.id)
        .map((other) => other.amount);

      if (baseline.length < 2) continue;

      const avg = baseline.reduce((s, v) => s + v, 0) / baseline.length;
      const med = median(baseline);
      const sd = stdDev(baseline, avg);

      const sortedBase = [...baseline].sort((a, b) => a - b);
      const q1 = sortedBase[Math.floor(sortedBase.length * 0.25)];
      const q3 = sortedBase[Math.floor(sortedBase.length * 0.75)];
      const iqr = Math.max(q3 - q1, med * 0.25);
      const upperFence = q3 + 1.5 * iqr;

      const ratio = avg > 0 ? tx.amount / avg : 1;
      const zScore = sd > 0 ? (tx.amount - avg) / sd : ratio;

      // Normalized isolation-style path length proxy (0..1, higher = more isolated)
      const isolationScore = Math.min(
        0.99,
        Number((1 - 1 / (1 + Math.max(0, ratio - 1) * 0.55)).toFixed(2))
      );

      // Trigger if clear statistical outlier (significant magnitude + ratio + IQR/z-score)
      const isOutlier =
        tx.amount >= 1500 &&
        ratio >= 2.2 &&
        (tx.amount > upperFence || zScore >= 1.8);

      if (isOutlier) {
        const roundedRatio = ratio.toFixed(1);
        const severity: 'high' | 'medium' = ratio >= 3.2 || zScore >= 2.5 ? 'high' : 'medium';

        alerts.push({
          id: `anom_${tx.id}`,
          transactionId: tx.id,
          transaction: tx,
          categoryAverage: Math.round(avg),
          categoryMedian: Math.round(med),
          ratio: Number(roundedRatio),
          zScore: Number(zScore.toFixed(2)),
          isolationScore,
          reason: `${formatINR(tx.amount)} in ${category} is ${roundedRatio}x higher than your 90-day category average (${formatINR(avg)}).`,
          severity,
          dismissed: dismissedIds.has(tx.id),
        });
      }
    }
  }

  alerts.sort((a, b) => b.ratio - a.ratio);
  return { alerts, recurringIds };
}
