import {
  CSVColumnMapping,
  MerchantRule,
  ParseImportResult,
  Transaction,
  TransactionType,
} from '../types';
import { classifyTransaction, normalizeMerchantKey } from './classifier';

/**
 * Redact sensitive PII (12-16 digit cards, 9-18 digit accounts, OTPs, PAN)
 * strictly locally in the browser before storing or displaying.
 */
export function redactPII(input: string): { cleaned: string; redactedCount: number } {
  let cleaned = input;
  let redactedCount = 0;

  // 1. 12-16 digit card numbers (with spaces, hyphens, or contiguous)
  cleaned = cleaned.replace(
    /\b(?:\d[ -]?){12,16}\b/g,
    (match) => {
      const digitsOnly = match.replace(/\D/g, '');
      if (digitsOnly.length >= 12 && digitsOnly.length <= 19) {
        redactedCount += 1;
        return `XXXX-${digitsOnly.slice(-4)}`;
      }
      return match;
    }
  );

  // 2. 9-11 digit bank account numbers preceded by account indicators
  cleaned = cleaned.replace(
    /\b((?:a\/c|acct|account|ac)\s*(?:no\.?|#|:)?\s*)(\d{9,18})\b/gi,
    (_m, prefix: string, digits: string) => {
      redactedCount += 1;
      return `${prefix}XX${digits.slice(-4)}`;
    }
  );

  // 3. OTP codes
  cleaned = cleaned.replace(
    /\b(otp\s*(?:is|:|-)?\s*)(\d{4,8})\b/gi,
    (_m, prefix: string) => {
      redactedCount += 1;
      return `${prefix}[REDACTED]`;
    }
  );

  // 4. Indian PAN numbers (e.g. ABCDE1234F)
  cleaned = cleaned.replace(/\b[A-Z]{5}\d{4}[A-Z]\b/g, () => {
    redactedCount += 1;
    return '[PAN-REDACTED]';
  });

  return { cleaned, redactedCount };
}

/**
 * Extract a clean, human-readable merchant name from UPI/NEFT/Card narration strings.
 */
export function normalizeMerchantName(raw: string): string {
  let text = raw.trim();

  // Strip UPI/41928371/SWIGGY -> SWIGGY
  const upiSlashMatch = text.match(/^UPI\/\d+\/([^/@]+)(?:@[^\s/]+)?/i);
  if (upiSlashMatch?.[1]) {
    text = upiSlashMatch[1];
  }

  // Strip UPI-PAY-RAHUL-SHARMA@okicici -> RAHUL SHARMA
  const upiDashMatch = text.match(/^UPI[-/](?:PAY[-/])?([^/@\s]+(?:[- ][^/@\s]+)*)/i);
  if (upiDashMatch?.[1] && !upiSlashMatch) {
    text = upiDashMatch[1];
  }

  // Strip PAYTM*UBER -> UBER
  const starMatch = text.match(/^(?:PAYTM|RAZORPAY|RPAY|CASHFREE|BILLDESK)\*([^/\n]+)/i);
  if (starMatch?.[1]) {
    text = starMatch[1];
  }

  // Strip NEFT-CR- / NEFT- / IMPS- prefixes
  text = text
    .replace(/^(NEFT|IMPS|RTGS)[-/](?:CR[-/]|DR[-/])?/i, '')
    .replace(/^(POS|ECOM|BIL\/ONL|ACH|NACH)[-/ ]+/i, '')
    .replace(/@[a-z0-9._-]+/gi, '')
    .replace(/\b(UPI\s*Ref\s*\d+|Ref\s*No\.?\s*\d+|Txn\s*\d+)\b/gi, '')
    .replace(/\b\d{6,}\b/g, '')
    .replace(/[-_*]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!text) return 'Unknown Merchant';

  // Title-case nicely while preserving short acronyms
  return text
    .split(' ')
    .filter(Boolean)
    .slice(0, 5)
    .map((word) => {
      if (word.length <= 3 && word === word.toUpperCase()) return word;
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(' ');
}

export function buildCompositeKey(
  date: string,
  amount: number,
  normalizedMerchant: string
): string {
  const token = normalizeMerchantKey(normalizedMerchant)
    .toLowerCase()
    .replace(/\s+/g, '');
  return `${date}|${amount.toFixed(2)}|${token}`;
}

export function normalizeDateString(rawDate: string): string | null {
  const trimmed = rawDate.trim();
  if (!trimmed) return null;

  // YYYY-MM-DD or YYYY/MM/DD
  const iso = trimmed.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (iso) {
    const [, y, m, d] = iso;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  // DD-MM-YYYY or DD/MM/YYYY or DD-MM-YY
  const dmy = trimmed.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})/);
  if (dmy) {
    const [, d, m, yRaw] = dmy;
    const year = yRaw.length === 2 ? `20${yRaw}` : yRaw;
    const monthNum = parseInt(m, 10);
    const dayNum = parseInt(d, 10);
    if (monthNum >= 1 && monthNum <= 12 && dayNum >= 1 && dayNum <= 31) {
      return `${year}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    }
  }

  // DD MMM YYYY (e.g., 22 Nov 2026 or 22-Nov-26)
  const months: Record<string, string> = {
    jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
    jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
  };
  const dMonY = trimmed.match(/^(\d{1,2})[\s-]([A-Za-z]{3})[\s-](\d{2,4})/);
  if (dMonY) {
    const [, d, mon, yRaw] = dMonY;
    const m = months[mon.toLowerCase()];
    if (m) {
      const year = yRaw.length === 2 ? `20${yRaw}` : yRaw;
      return `${year}-${m}-${d.padStart(2, '0')}`;
    }
  }

  const parsed = new Date(trimmed);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }
  return null;
}

function parseNumericAmount(val: string | undefined): number {
  if (!val) return 0;
  const cleaned = val.replace(/[₹$,\sINRrs]/gi, '').replace(/[()]/g, '');
  const num = parseFloat(cleaned);
  return Number.isFinite(num) ? Math.abs(num) : 0;
}

export function splitCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

export function detectCSVColumns(csvText: string): {
  headers: string[];
  rows: string[][];
  suggestedMapping: CSVColumnMapping;
} {
  const lines = csvText
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .filter((l) => l.trim().length > 0);

  if (lines.length === 0) {
    return {
      headers: [],
      rows: [],
      suggestedMapping: {
        dateCol: '',
        descriptionCol: '',
        debitCol: '',
        creditCol: '',
        amountCol: '',
        typeCol: '',
        accountCol: '',
      },
    };
  }

  const headers = splitCSVLine(lines[0]);
  const rows = lines.slice(1).map(splitCSVLine);

  const findHeader = (patterns: RegExp[]): string =>
    headers.find((h) => patterns.some((p) => p.test(h))) ?? '';

  const suggestedMapping: CSVColumnMapping = {
    dateCol: findHeader([/date/i, /txn.*dt/i, /posted/i, /value.*dt/i]),
    descriptionCol: findHeader([
      /desc/i,
      /narration/i,
      /particular/i,
      /remark/i,
      /merchant/i,
      /detail/i,
    ]),
    debitCol: findHeader([/debit/i, /withdrawal/i, /dr\b/i, /paid out/i]),
    creditCol: findHeader([/credit/i, /deposit/i, /cr\b/i, /paid in/i]),
    amountCol: findHeader([/^amount$/i, /txn.*amt/i, /amount/i, /value/i]),
    typeCol: findHeader([/^type$/i, /dr.*cr/i, /direction/i]),
    accountCol: findHeader([/account/i, /card/i, /bank/i, /source/i]),
  };

  return { headers, rows, suggestedMapping };
}

export function parseCSVTransactions(
  headers: string[],
  rows: string[][],
  mapping: CSVColumnMapping,
  existingKeys: Set<string>,
  rules: MerchantRule[],
  defaultAccount = 'Imported CSV'
): ParseImportResult {
  const colIndex = (name: string) => (name ? headers.indexOf(name) : -1);

  const dateIdx = colIndex(mapping.dateCol);
  const descIdx = colIndex(mapping.descriptionCol);
  const debitIdx = colIndex(mapping.debitCol);
  const creditIdx = colIndex(mapping.creditCol);
  const amountIdx = colIndex(mapping.amountCol);
  const typeIdx = colIndex(mapping.typeCol);
  const accountIdx = colIndex(mapping.accountCol);

  const transactions: Transaction[] = [];
  const seenKeys = new Set(existingKeys);
  const errors: string[] = [];
  let duplicatesSkipped = 0;
  let redactedPIIItems = 0;

  if (dateIdx === -1 || descIdx === -1) {
    return {
      transactions: [],
      duplicatesSkipped: 0,
      redactedPIIItems: 0,
      errors: ['Please map both Date and Description/Narration columns.'],
    };
  }

  rows.forEach((cols, idx) => {
    const rawDate = cols[dateIdx] ?? '';
    const rawDesc = cols[descIdx] ?? '';
    if (!rawDate && !rawDesc) return;

    const normalizedDate = normalizeDateString(rawDate);
    if (!normalizedDate) {
      errors.push(`Row ${idx + 2}: Unrecognized date "${rawDate}"`);
      return;
    }

    let amount = 0;
    let type: TransactionType = 'debit';

    if (debitIdx !== -1 || creditIdx !== -1) {
      const debitVal = debitIdx !== -1 ? parseNumericAmount(cols[debitIdx]) : 0;
      const creditVal = creditIdx !== -1 ? parseNumericAmount(cols[creditIdx]) : 0;
      if (creditVal > 0 && debitVal === 0) {
        amount = creditVal;
        type = 'credit';
      } else if (debitVal > 0) {
        amount = debitVal;
        type = 'debit';
      }
    }

    if (amount === 0 && amountIdx !== -1) {
      const rawAmtStr = cols[amountIdx] ?? '';
      const isNegative = rawAmtStr.trim().startsWith('-');
      amount = parseNumericAmount(rawAmtStr);
      if (typeIdx !== -1) {
        const typeStr = (cols[typeIdx] ?? '').toLowerCase();
        type = /cr|credit|deposit|in/i.test(typeStr) ? 'credit' : 'debit';
      } else if (isNegative) {
        type = 'debit';
      } else if (/\bcr\b/i.test(rawAmtStr)) {
        type = 'credit';
      }
    }

    if (amount <= 0) {
      errors.push(`Row ${idx + 2}: Missing or zero transaction amount.`);
      return;
    }

    const { cleaned, redactedCount } = redactPII(rawDesc);
    redactedPIIItems += redactedCount;

    const normalizedMerchant = normalizeMerchantName(cleaned);
    const compositeKey = buildCompositeKey(normalizedDate, amount, normalizedMerchant);

    if (seenKeys.has(compositeKey)) {
      duplicatesSkipped += 1;
      return;
    }
    seenKeys.add(compositeKey);

    const accountRaw = accountIdx !== -1 && cols[accountIdx] ? cols[accountIdx] : defaultAccount;
    const { cleaned: safeAccount, redactedCount: acctRedacted } = redactPII(accountRaw);
    redactedPIIItems += acctRedacted;

    const classification = classifyTransaction(cleaned, normalizedMerchant, rules);

    transactions.push({
      id: `tx_${Date.now()}_${Math.random().toString(36).slice(2, 8)}_${idx}`,
      date: normalizedDate,
      rawDescription: cleaned,
      normalizedMerchant,
      amount: Number(amount.toFixed(2)),
      type,
      account: safeAccount || defaultAccount,
      category: classification.category,
      confidence: classification.confidence,
      categorizedBy: classification.categorizedBy,
      reviewed: classification.confidence >= 0.7 || classification.categorizedBy === 'rule',
      compositeKey,
      redactedCount: redactedCount + acctRedacted,
      matchedKeywords: classification.matchedKeywords,
    });
  });

  return {
    transactions,
    duplicatesSkipped,
    redactedPIIItems,
    errors,
  };
}

/**
 * Parse raw bank SMS or payment app notification alerts (supports multiple lines/alerts).
 * Example: "Rs. 1,450.00 debited from A/c XX4821 on 22-11-26 at ZOMATO UPI Ref 632819"
 */
export function parseSMSAlerts(
  smsText: string,
  existingKeys: Set<string>,
  rules: MerchantRule[]
): ParseImportResult {
  const chunks = smsText
    .split(/\n+/)
    .map((line) => line.trim())
    .filter((line) => line.length >= 8);

  const transactions: Transaction[] = [];
  const seenKeys = new Set(existingKeys);
  const errors: string[] = [];
  let duplicatesSkipped = 0;
  let redactedPIIItems = 0;

  chunks.forEach((line, idx) => {
    // 1. Amount extraction (Rs., INR, ₹)
    const amtMatch =
      line.match(/(?:rs\.?|inr|₹)\s*([\d,]+(?:\.\d{1,2})?)/i) ||
      line.match(/([\d,]+(?:\.\d{1,2})?)\s*(?:rs\.?|inr)/i);

    if (!amtMatch?.[1]) {
      errors.push(`Line ${idx + 1}: Could not detect currency amount.`);
      return;
    }
    const amount = parseNumericAmount(amtMatch[1]);
    if (amount <= 0) return;

    // 2. Debit vs Credit
    const isCredit = /\b(credited|received|deposited|refund|cashback)\b/i.test(line) &&
      !/\b(debited|spent|paid|withdrawn)\b/i.test(line);
    const type: TransactionType = isCredit ? 'credit' : 'debit';

    // 3. Date extraction
    const dateMatch =
      line.match(/\b(\d{1,2}[-/]\d{1,2}[-/]\d{2,4})\b/) ||
      line.match(/\b(\d{4}[-/]\d{1,2}[-/]\d{1,2})\b/) ||
      line.match(/\b(\d{1,2}[\s-][A-Za-z]{3}[\s-]\d{2,4})\b/);

    const date = dateMatch?.[1]
      ? normalizeDateString(dateMatch[1]) ?? new Date().toISOString().slice(0, 10)
      : new Date().toISOString().slice(0, 10);

    // 4. Account suffix extraction
    const acctMatch = line.match(
      /(?:a\/c|acct|account|card)\s*(?:no\.?|ending|xx|\*)*\s*([xX*]*\d{3,4})/i
    );
    const account = acctMatch?.[1]
      ? `A/c ••${acctMatch[1].slice(-4)}`
      : 'SMS Alert';

    // 5. Merchant extraction
    let merchantCandidate = '';
    const atMatch = line.match(
      /\b(?:at|to|towards|for|on|via|from)\s+([A-Za-z0-9.*&@/_ -]{2,42}?)(?=\s+(?:on\b|upi\s*ref|ref\b|avl\b|bal\b|not\s+you|if\s+not|$))/i
    );
    if (atMatch?.[1]) {
      merchantCandidate = atMatch[1].trim();
    } else {
      const fallbackAt = line.match(/\b(?:at|to|towards)\s+([A-Za-z0-9.*&@/_ -]{2,35})/i);
      merchantCandidate = fallbackAt?.[1]?.trim() ?? line;
    }

    const { cleaned, redactedCount } = redactPII(line);
    redactedPIIItems += redactedCount;

    const normalizedMerchant = normalizeMerchantName(merchantCandidate);
    const compositeKey = buildCompositeKey(date, amount, normalizedMerchant);

    if (seenKeys.has(compositeKey)) {
      duplicatesSkipped += 1;
      return;
    }
    seenKeys.add(compositeKey);

    const classification = classifyTransaction(cleaned, normalizedMerchant, rules);

    transactions.push({
      id: `sms_${Date.now()}_${Math.random().toString(36).slice(2, 8)}_${idx}`,
      date,
      rawDescription: cleaned,
      normalizedMerchant,
      amount: Number(amount.toFixed(2)),
      type,
      account,
      category: classification.category,
      confidence: classification.confidence,
      categorizedBy: classification.categorizedBy,
      reviewed: classification.confidence >= 0.7 || classification.categorizedBy === 'rule',
      compositeKey,
      redactedCount,
      matchedKeywords: classification.matchedKeywords,
    });
  });

  return {
    transactions,
    duplicatesSkipped,
    redactedPIIItems,
    errors,
  };
}
