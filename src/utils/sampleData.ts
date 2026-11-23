import { BudgetMap, MerchantRule, Transaction } from '../types';
import { classifyTransaction } from './classifier';
import { buildCompositeKey, normalizeMerchantName, redactPII } from './parser';

interface RawSampleEntry {
  date: string;
  rawDescription: string;
  amount: number;
  type: 'debit' | 'credit';
  account: string;
}

const RAW_SAMPLE_ENTRIES: RawSampleEntry[] = [
  // ================= SEPTEMBER 2026 =================
  { date: '2026-09-01', rawDescription: 'NEFT-CR-ACME TECH PAYROLL SALARY', amount: 145000, type: 'credit', account: 'HDFC ••4821' },
  { date: '2026-09-02', rawDescription: 'NEFT-RENT-LANDLORD VIKRAM RAO', amount: 28000, type: 'debit', account: 'HDFC ••4821' },
  { date: '2026-09-03', rawDescription: 'UPI/41029384/BIGBASKET GROCERIES', amount: 2450, type: 'debit', account: 'ICICI ••9012' },
  { date: '2026-09-04', rawDescription: 'UPI/41029410/SWIGGY ORDER 9281', amount: 540, type: 'debit', account: 'HDFC ••4821' },
  { date: '2026-09-05', rawDescription: 'NETFLIX.COM MUMBAI SUBSCRIPTION', amount: 649, type: 'debit', account: 'SBI Card ••3310' },
  { date: '2026-09-06', rawDescription: 'ACT FIBERNET BROADBAND BILL', amount: 1179, type: 'debit', account: 'HDFC ••4821' },
  { date: '2026-09-07', rawDescription: 'PAYTM*UBER TRIP BANGALORE', amount: 340, type: 'debit', account: 'ICICI ••9012' },
  { date: '2026-09-08', rawDescription: 'UPI/41098212/BLINKIT INSTANT', amount: 690, type: 'debit', account: 'HDFC ••4821' },
  { date: '2026-09-10', rawDescription: 'AMAZON.IN/ECOM HOME ESSENTIALS', amount: 2890, type: 'debit', account: 'SBI Card ••3310' },
  { date: '2026-09-11', rawDescription: 'UPI/41120944/ZOMATO DINING', amount: 720, type: 'debit', account: 'HDFC ••4821' },
  { date: '2026-09-12', rawDescription: 'SPOTIFY INDIA PREMIUM', amount: 119, type: 'debit', account: 'SBI Card ••3310' },
  { date: '2026-09-14', rawDescription: 'UPI/41145520/APOLLO PHARMACY', amount: 890, type: 'debit', account: 'ICICI ••9012' },
  { date: '2026-09-15', rawDescription: 'BPCL FUEL STATION KORAMANGALA', amount: 2200, type: 'debit', account: 'SBI Card ••3310' },
  { date: '2026-09-16', rawDescription: 'BESCOM ELECTRICITY BILL', amount: 1840, type: 'debit', account: 'HDFC ••4821' },
  { date: '2026-09-18', rawDescription: 'UPI/41189201/STARBUCKS COFFEE', amount: 480, type: 'debit', account: 'ICICI ••9012' },
  { date: '2026-09-19', rawDescription: 'UPI/41193822/ZEPTO MARKET', amount: 1120, type: 'debit', account: 'HDFC ••4821' },
  { date: '2026-09-21', rawDescription: 'BOOKMYSHOW PVR CINEMAS', amount: 960, type: 'debit', account: 'SBI Card ••3310' },
  { date: '2026-09-22', rawDescription: 'MYNTRA FASHION APPAREL', amount: 3150, type: 'debit', account: 'SBI Card ••3310' },
  { date: '2026-09-24', rawDescription: 'UPI/41249011/SWIGGY INSTAMART', amount: 840, type: 'debit', account: 'HDFC ••4821' },
  { date: '2026-09-25', rawDescription: 'AIRTEL POSTPAID MOBILE BILL', amount: 799, type: 'debit', account: 'HDFC ••4821' },
  { date: '2026-09-27', rawDescription: 'UPI/41278120/BLUE TOKAI CAFE', amount: 610, type: 'debit', account: 'ICICI ••9012' },
  { date: '2026-09-28', rawDescription: 'DMART SUPERMARKET VALUE', amount: 3180, type: 'debit', account: 'ICICI ••9012' },
  { date: '2026-09-29', rawDescription: 'TATA 1MG DIAGNOSTICS', amount: 1250, type: 'debit', account: 'SBI Card ••3310' },

  // ================= OCTOBER 2026 =================
  { date: '2026-10-01', rawDescription: 'NEFT-CR-ACME TECH PAYROLL SALARY', amount: 145000, type: 'credit', account: 'HDFC ••4821' },
  { date: '2026-10-02', rawDescription: 'NEFT-RENT-LANDLORD VIKRAM RAO', amount: 28000, type: 'debit', account: 'HDFC ••4821' },
  { date: '2026-10-03', rawDescription: 'UPI/42019283/BIGBASKET DAILY', amount: 2640, type: 'debit', account: 'ICICI ••9012' },
  { date: '2026-10-04', rawDescription: 'UPI/42029311/ZOMATO ORDER', amount: 680, type: 'debit', account: 'HDFC ••4821' },
  { date: '2026-10-05', rawDescription: 'NETFLIX.COM MUMBAI SUBSCRIPTION', amount: 649, type: 'debit', account: 'SBI Card ••3310' },
  { date: '2026-10-06', rawDescription: 'ACT FIBERNET BROADBAND BILL', amount: 1179, type: 'debit', account: 'HDFC ••4821' },
  { date: '2026-10-07', rawDescription: 'PAYTM*UBER AIRPORT RIDE', amount: 890, type: 'debit', account: 'ICICI ••9012' },
  { date: '2026-10-09', rawDescription: 'UPI/42091283/SWIGGY DINNER', amount: 520, type: 'debit', account: 'HDFC ••4821' },
  { date: '2026-10-10', rawDescription: 'FLIPKART INTERNET RETAIL', amount: 3420, type: 'debit', account: 'SBI Card ••3310' },
  { date: '2026-10-12', rawDescription: 'SPOTIFY INDIA PREMIUM', amount: 119, type: 'debit', account: 'SBI Card ••3310' },
  { date: '2026-10-13', rawDescription: 'UPI/42130912/BLINKIT GROCERY', amount: 740, type: 'debit', account: 'HDFC ••4821' },
  { date: '2026-10-15', rawDescription: 'BESCOM ELECTRICITY BILL', amount: 2050, type: 'debit', account: 'HDFC ••4821' },
  { date: '2026-10-16', rawDescription: 'UPI/42168810/PHARMEASY MEDS', amount: 760, type: 'debit', account: 'ICICI ••9012' },
  { date: '2026-10-18', rawDescription: 'HPCL PETROL PUMP INDRA NAGAR', amount: 2450, type: 'debit', account: 'SBI Card ••3310' },
  { date: '2026-10-19', rawDescription: 'UPI/42190233/THIRD WAVE COFFEE', amount: 440, type: 'debit', account: 'ICICI ••9012' },
  { date: '2026-10-21', rawDescription: 'IRCTC RAIL BOOKING', amount: 1680, type: 'debit', account: 'SBI Card ••3310' },
  { date: '2026-10-22', rawDescription: 'UPI/42228411/ZEPTO DELIVERY', amount: 980, type: 'debit', account: 'HDFC ••4821' },
  { date: '2026-10-24', rawDescription: 'DECATHLON SPORTS INDIA', amount: 2650, type: 'debit', account: 'SBI Card ••3310' },
  { date: '2026-10-25', rawDescription: 'AIRTEL POSTPAID MOBILE BILL', amount: 799, type: 'debit', account: 'HDFC ••4821' },
  { date: '2026-10-27', rawDescription: 'UPI/42274910/HALDIRAM SNACKS', amount: 590, type: 'debit', account: 'ICICI ••9012' },
  { date: '2026-10-28', rawDescription: 'BOOKMYSHOW INOX IMAX', amount: 1120, type: 'debit', account: 'SBI Card ••3310' },
  { date: '2026-10-30', rawDescription: 'DMART SUPERMARKET MONTHLY', amount: 3450, type: 'debit', account: 'ICICI ••9012' },

  // ================= NOVEMBER 2026 =================
  { date: '2026-11-01', rawDescription: 'NEFT-CR-ACME TECH PAYROLL SALARY', amount: 152000, type: 'credit', account: 'HDFC ••4821' },
  { date: '2026-11-02', rawDescription: 'NEFT-RENT-LANDLORD VIKRAM RAO', amount: 28000, type: 'debit', account: 'HDFC ••4821' },
  { date: '2026-11-03', rawDescription: 'UPI/41928371/SWIGGY', amount: 645, type: 'debit', account: 'HDFC ••4821' },
  { date: '2026-11-04', rawDescription: 'UPI/43049182/BIGBASKET FRESH', amount: 2290, type: 'debit', account: 'ICICI ••9012' },
  { date: '2026-11-05', rawDescription: 'NETFLIX.COM MUMBAI SUBSCRIPTION', amount: 649, type: 'debit', account: 'SBI Card ••3310' },
  { date: '2026-11-06', rawDescription: 'ACT FIBERNET BROADBAND BILL', amount: 1179, type: 'debit', account: 'HDFC ••4821' },
  { date: '2026-11-07', rawDescription: 'PAYTM*UBER RIDES', amount: 420, type: 'debit', account: 'ICICI ••9012' },
  { date: '2026-11-08', rawDescription: 'UPI/43081294/ZOMATO ORDER', amount: 790, type: 'debit', account: 'HDFC ••4821' },
  { date: '2026-11-09', rawDescription: 'UPI-PAY-RAHUL-SHARMA@okicici', amount: 2400, type: 'debit', account: 'HDFC ••4821' },
  { date: '2026-11-10', rawDescription: 'MYGATE SOCIETY MAINTENANCE', amount: 3500, type: 'debit', account: 'HDFC ••4821' },
  { date: '2026-11-11', rawDescription: 'UPI/43118820/BLINKIT ESSENTIALS', amount: 860, type: 'debit', account: 'ICICI ••9012' },
  { date: '2026-11-12', rawDescription: 'SPOTIFY INDIA PREMIUM', amount: 119, type: 'debit', account: 'SBI Card ••3310' },
  { date: '2026-11-12', rawDescription: 'UPI-PAY-PRIYA-NAIR@ybl', amount: 1250, type: 'debit', account: 'ICICI ••9012' },
  { date: '2026-11-13', rawDescription: 'AMAZON.IN/ECOM ACCESSORIES', amount: 2490, type: 'debit', account: 'SBI Card ••3310' },
  // Deliberate Anomaly Spike 1: Shopping (24,990 vs ~2,900 category avg)
  { date: '2026-11-14', rawDescription: 'CROMA ELECTRONICS MUMBAI STORE', amount: 24990, type: 'debit', account: 'SBI Card ••3310' },
  { date: '2026-11-15', rawDescription: 'BESCOM ELECTRICITY BILL', amount: 2210, type: 'debit', account: 'HDFC ••4821' },
  { date: '2026-11-15', rawDescription: 'UPI/99481023/ANKIT VERMA@okaxis', amount: 850, type: 'debit', account: 'HDFC ••4821' },
  { date: '2026-11-16', rawDescription: 'BPCL FUEL STATION', amount: 2150, type: 'debit', account: 'SBI Card ••3310' },
  // Deliberate Anomaly Spike 2: Food & Dining (9,400 vs ~600 category avg)
  { date: '2026-11-17', rawDescription: 'TAJ BANJARA FINE DINING RESTAURANT', amount: 9400, type: 'debit', account: 'SBI Card ••3310' },
  { date: '2026-11-18', rawDescription: 'UPI/43187712/ZEPTO GROCERIES', amount: 1190, type: 'debit', account: 'HDFC ••4821' },
  { date: '2026-11-18', rawDescription: 'UPI-PAY-KARAN-MEHTA@oksbi', amount: 3200, type: 'debit', account: 'ICICI ••9012' },
  // Deliberate Anomaly Spike 3: Health (11,500 vs ~950 category avg)
  { date: '2026-11-19', rawDescription: 'LILAVATI DIAGNOSTICS & HEALTH CHECKUP', amount: 11500, type: 'debit', account: 'SBI Card ••3310' },
  { date: '2026-11-20', rawDescription: 'UPI/43209410/STARBUCKS', amount: 520, type: 'debit', account: 'ICICI ••9012' },
  { date: '2026-11-20', rawDescription: 'AMAZON.IN/REFUND RETURN CREDIT', amount: 1490, type: 'credit', account: 'SBI Card ••3310' },
  { date: '2026-11-21', rawDescription: 'UPI/55291044/SNEHA-KULKARNI@okicici', amount: 1800, type: 'debit', account: 'HDFC ••4821' },
  { date: '2026-11-21', rawDescription: 'PAYTM*UBER PREMIER', amount: 560, type: 'debit', account: 'ICICI ••9012' },
  { date: '2026-11-22', rawDescription: 'AIRTEL POSTPAID MOBILE BILL', amount: 799, type: 'debit', account: 'HDFC ••4821' },
];

export const DEFAULT_BUDGETS: BudgetMap = {
  'Food & Dining': 12000,
  Groceries: 9000,
  Transport: 6000,
  Utilities: 5000,
  Shopping: 18000,
  Housing: 32000,
  Health: 13000,
  Entertainment: 3000,
  Transfers: 10000,
};

export function generateSampleTransactions(rules: MerchantRule[] = []): Transaction[] {
  return RAW_SAMPLE_ENTRIES.map((entry, idx) => {
    const { cleaned, redactedCount } = redactPII(entry.rawDescription);
    const normalizedMerchant = normalizeMerchantName(cleaned);
    const compositeKey = buildCompositeKey(entry.date, entry.amount, normalizedMerchant);
    const classification = classifyTransaction(cleaned, normalizedMerchant, rules);

    return {
      id: `sample_${idx + 1}_${entry.date}`,
      date: entry.date,
      rawDescription: cleaned,
      normalizedMerchant,
      amount: entry.amount,
      type: entry.type,
      account: entry.account,
      category: classification.category,
      confidence: classification.confidence,
      categorizedBy: classification.categorizedBy,
      reviewed: classification.confidence >= 0.7 || classification.categorizedBy === 'rule',
      compositeKey,
      redactedCount,
      matchedKeywords: classification.matchedKeywords,
    };
  });
}

export const SAMPLE_CSV_SNIPPET = `Date,Description,Debit,Credit,Account
2026-11-22,UPI/49918203/SWIGGY INSTAMART,785,,HDFC XX4821
2026-11-22,UPI-PAY-VIKAS-DESAI@okaxis,1500,,ICICI XX9012
2026-11-21,INDIGO AIRLINES BOOKING 4532 8910 2345 6789,6450,,SBI Card XX3310
2026-11-20,NEFT-CR-CONSULTING PAYOUT,,22500,HDFC XX4821`;

export const SAMPLE_SMS_SNIPPET = `Rs. 1,450.00 debited from A/c XX4821 on 22-11-26 at ZOMATO UPI Ref 632819
INR 840.00 spent on SBI Card XX3310 at UBER INDIA on 21-11-26`;
