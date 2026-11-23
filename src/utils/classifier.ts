import { CATEGORIES, CategorizationSource, Category, MerchantRule } from '../types';

interface KeywordEntry {
  term: string;
  weight: number; // IDF-inspired specificity weight (1.0 - 4.5)
}

const CATEGORY_LEXICON: Record<Category, KeywordEntry[]> = {
  'Food & Dining': [
    { term: 'swiggy', weight: 4.2 },
    { term: 'zomato', weight: 4.2 },
    { term: 'starbucks', weight: 4.0 },
    { term: 'mcdonalds', weight: 4.0 },
    { term: 'kfc', weight: 3.8 },
    { term: 'dominos', weight: 4.0 },
    { term: 'pizza hut', weight: 4.0 },
    { term: 'blue tokai', weight: 4.0 },
    { term: 'third wave', weight: 3.8 },
    { term: 'haldiram', weight: 3.8 },
    { term: 'barbeque', weight: 3.6 },
    { term: 'eatclub', weight: 3.8 },
    { term: 'bistro', weight: 3.2 },
    { term: 'restaurant', weight: 3.2 },
    { term: 'dining', weight: 3.4 },
    { term: 'cafe', weight: 2.8 },
    { term: 'coffee', weight: 2.8 },
    { term: 'bakery', weight: 2.8 },
    { term: 'biryani', weight: 3.4 },
    { term: 'chai', weight: 2.6 },
    { term: 'kitchen', weight: 2.4 },
    { term: 'food', weight: 2.2 },
  ],
  Groceries: [
    { term: 'bigbasket', weight: 4.4 },
    { term: 'blinkit', weight: 4.4 },
    { term: 'zepto', weight: 4.4 },
    { term: 'instamart', weight: 4.4 },
    { term: 'dmart', weight: 4.2 },
    { term: 'reliance fresh', weight: 4.2 },
    { term: 'reliance smart', weight: 4.0 },
    { term: 'natures basket', weight: 4.2 },
    { term: 'country delight', weight: 4.0 },
    { term: 'licious', weight: 4.0 },
    { term: 'more supermarket', weight: 4.0 },
    { term: 'spencers', weight: 3.8 },
    { term: 'supermarket', weight: 3.4 },
    { term: 'grocery', weight: 3.4 },
    { term: 'groceries', weight: 3.4 },
    { term: 'kirana', weight: 3.2 },
    { term: 'dairy', weight: 2.8 },
    { term: 'milk', weight: 2.4 },
    { term: 'vegetables', weight: 3.0 },
    { term: 'freshmart', weight: 3.4 },
  ],
  Transport: [
    { term: 'uber', weight: 4.2 },
    { term: 'ola', weight: 4.0 },
    { term: 'rapido', weight: 4.2 },
    { term: 'blusmart', weight: 4.4 },
    { term: 'irctc', weight: 4.3 },
    { term: 'indigo', weight: 4.0 },
    { term: 'air india', weight: 4.2 },
    { term: 'vistara', weight: 4.2 },
    { term: 'akasa', weight: 4.0 },
    { term: 'dmrc', weight: 4.2 },
    { term: 'bmrc', weight: 4.2 },
    { term: 'metro', weight: 3.4 },
    { term: 'fastag', weight: 4.3 },
    { term: 'hpcl', weight: 4.0 },
    { term: 'bpcl', weight: 4.0 },
    { term: 'iocl', weight: 4.0 },
    { term: 'indian oil', weight: 4.0 },
    { term: 'shell', weight: 3.6 },
    { term: 'petrol', weight: 3.6 },
    { term: 'diesel', weight: 3.6 },
    { term: 'fuel', weight: 3.2 },
    { term: 'parking', weight: 3.0 },
    { term: 'toll', weight: 3.0 },
    { term: 'cab', weight: 2.8 },
  ],
  Utilities: [
    { term: 'airtel', weight: 4.2 },
    { term: 'jio', weight: 3.8 },
    { term: 'act fibernet', weight: 4.4 },
    { term: 'bescom', weight: 4.4 },
    { term: 'tata power', weight: 4.4 },
    { term: 'adani electricity', weight: 4.4 },
    { term: 'mahavitaran', weight: 4.4 },
    { term: 'mahanagar gas', weight: 4.4 },
    { term: 'igl', weight: 3.8 },
    { term: 'tataplay', weight: 4.2 },
    { term: 'vodafone', weight: 4.0 },
    { term: 'bsnl', weight: 4.0 },
    { term: 'electricity', weight: 3.8 },
    { term: 'broadband', weight: 3.8 },
    { term: 'postpaid', weight: 3.6 },
    { term: 'prepaid', weight: 3.4 },
    { term: 'recharge', weight: 3.4 },
    { term: 'water bill', weight: 3.8 },
    { term: 'utility', weight: 3.2 },
    { term: 'wifi', weight: 3.2 },
    { term: 'gas bill', weight: 3.6 },
  ],
  Shopping: [
    { term: 'amazon', weight: 4.0 },
    { term: 'flipkart', weight: 4.2 },
    { term: 'myntra', weight: 4.2 },
    { term: 'ajio', weight: 4.2 },
    { term: 'nykaa', weight: 4.2 },
    { term: 'croma', weight: 4.2 },
    { term: 'reliance digital', weight: 4.2 },
    { term: 'decathlon', weight: 4.2 },
    { term: 'ikea', weight: 4.2 },
    { term: 'uniqlo', weight: 4.2 },
    { term: 'zara', weight: 4.0 },
    { term: 'tata cliq', weight: 4.2 },
    { term: 'westside', weight: 3.8 },
    { term: 'meesho', weight: 4.0 },
    { term: 'electronics', weight: 3.4 },
    { term: 'apparel', weight: 3.2 },
    { term: 'retail', weight: 2.6 },
    { term: 'mall', weight: 2.5 },
    { term: 'store', weight: 1.8 },
  ],
  Housing: [
    { term: 'rent', weight: 4.4 },
    { term: 'landlord', weight: 4.4 },
    { term: 'nobroker', weight: 4.4 },
    { term: 'mygate', weight: 4.2 },
    { term: 'adda', weight: 3.8 },
    { term: 'society maintenance', weight: 4.4 },
    { term: 'maintenance', weight: 3.4 },
    { term: 'urban company', weight: 3.6 },
    { term: 'apartment', weight: 3.4 },
    { term: 'housing', weight: 3.4 },
    { term: 'lease', weight: 3.6 },
    { term: 'plumber', weight: 3.2 },
    { term: 'electrician', weight: 3.2 },
    { term: 'housekeeping', weight: 3.4 },
  ],
  Health: [
    { term: 'apollo', weight: 4.2 },
    { term: 'pharmeasy', weight: 4.4 },
    { term: '1mg', weight: 4.4 },
    { term: 'netmeds', weight: 4.4 },
    { term: 'practo', weight: 4.2 },
    { term: 'medplus', weight: 4.2 },
    { term: 'lilavati', weight: 4.2 },
    { term: 'fortis', weight: 4.2 },
    { term: 'manipal', weight: 4.0 },
    { term: 'lal path', weight: 4.2 },
    { term: 'thyrocare', weight: 4.2 },
    { term: 'cultfit', weight: 4.0 },
    { term: 'cult.fit', weight: 4.2 },
    { term: 'pharmacy', weight: 3.8 },
    { term: 'diagnostics', weight: 3.8 },
    { term: 'hospital', weight: 3.8 },
    { term: 'clinic', weight: 3.4 },
    { term: 'medical', weight: 3.2 },
    { term: 'dental', weight: 3.6 },
    { term: 'doctor', weight: 3.4 },
    { term: 'health', weight: 2.8 },
    { term: 'gym', weight: 3.2 },
  ],
  Entertainment: [
    { term: 'netflix', weight: 4.5 },
    { term: 'spotify', weight: 4.4 },
    { term: 'bookmyshow', weight: 4.4 },
    { term: 'prime video', weight: 4.2 },
    { term: 'hotstar', weight: 4.4 },
    { term: 'disney', weight: 4.0 },
    { term: 'pvr', weight: 4.0 },
    { term: 'inox', weight: 4.0 },
    { term: 'youtube', weight: 3.8 },
    { term: 'steam', weight: 3.8 },
    { term: 'playstation', weight: 4.0 },
    { term: 'sonyliv', weight: 4.2 },
    { term: 'zee5', weight: 4.2 },
    { term: 'cinema', weight: 3.6 },
    { term: 'concert', weight: 3.6 },
    { term: 'movie', weight: 3.2 },
    { term: 'gaming', weight: 3.2 },
    { term: 'apple.com/bill', weight: 3.8 },
  ],
  Transfers: [
    { term: 'payroll', weight: 4.2 },
    { term: 'salary', weight: 4.2 },
    { term: 'zerodha', weight: 4.0 },
    { term: 'groww', weight: 4.0 },
    { term: 'mutual fund', weight: 4.0 },
    { term: 'cred', weight: 3.4 },
    { term: 'self transfer', weight: 4.0 },
    { term: 'atm', weight: 3.4 },
    { term: 'cash withdrawal', weight: 3.8 },
    { term: 'neft', weight: 2.0 },
    { term: 'imps', weight: 2.0 },
    { term: 'rtgs', weight: 2.2 },
    { term: 'refund', weight: 2.6 },
    { term: 'cashback', weight: 2.8 },
  ],
};

const PERSONAL_UPI_HANDLE_REGEX = /@(okicici|okaxis|okhdfcbank|oksbi|ybl|ibl|axl|paytm|apl|upi)/i;
const PERSONAL_UPI_PREFIX_REGEX = /^(upi[-/ ]*(pay|p2p|trf)|imps[-/ ]*p2p)/i;

export function normalizeTextForClassification(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/@[a-z0-9._-]+/g, ' ')
    .replace(/\b(upi|neft|imps|rtgs|pos|ecom|ref|txn|trf|pay|cr|dr|xx\d+)\b/g, ' ')
    .replace(/\b\d{5,}\b/g, ' ')
    .replace(/[^a-z0-9.&/ ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function normalizeMerchantKey(merchant: string): string {
  return merchant
    .toUpperCase()
    .replace(/@[A-Z0-9._-]+/g, '')
    .replace(/\b(UPI|PAY|REF|TXN|NEFT|IMPS|POS|ECOM|INDIA|PVT|LTD)\b/g, ' ')
    .replace(/\b\d{4,}\b/g, ' ')
    .replace(/[^A-Z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export interface ClassificationResult {
  category: Category;
  confidence: number;
  categorizedBy: CategorizationSource;
  matchedKeywords: string[];
}

export function classifyTransaction(
  rawDescription: string,
  normalizedMerchant: string,
  rules: MerchantRule[]
): ClassificationResult {
  const merchantKey = normalizeMerchantKey(normalizedMerchant);
  const rawUpper = rawDescription.toUpperCase();

  // Stage 1: User Rule Dictionary (Highest Priority)
  for (const rule of rules) {
    const target = rule.merchantKey.toUpperCase().trim();
    if (!target) continue;
    if (
      merchantKey === target ||
      merchantKey.includes(target) ||
      target.includes(merchantKey) && merchantKey.length >= 4 ||
      rawUpper.includes(target)
    ) {
      return {
        category: rule.category,
        confidence: 1.0,
        categorizedBy: 'rule',
        matchedKeywords: [`Rule: ${rule.displayName}`],
      };
    }
  }

  // Stage 2: NLP Keyword / TF-IDF Weighted Scoring Classifier
  const normalizedText = normalizeTextForClassification(
    `${rawDescription} ${normalizedMerchant}`
  );
  const rawLower = rawDescription.toLowerCase();

  const scores: Record<Category, number> = {
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
  const matchedByCat: Record<Category, string[]> = {
    'Food & Dining': [],
    Groceries: [],
    Transport: [],
    Utilities: [],
    Shopping: [],
    Housing: [],
    Health: [],
    Entertainment: [],
    Transfers: [],
  };

  for (const category of CATEGORIES) {
    const entries = CATEGORY_LEXICON[category];
    for (const entry of entries) {
      const escaped = entry.term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`(^|\\s|/|-|\\*)${escaped}($|\\s|/|-|\\*)`, 'i');
      if (regex.test(normalizedText) || regex.test(rawLower)) {
        // Term frequency boost if repeated across description and merchant
        const tf = rawLower.includes(entry.term) ? 1.1 : 1.0;
        scores[category] += entry.weight * tf;
        matchedByCat[category].push(entry.term);
      }
    }
  }

  // Rank category scores
  const ranked = CATEGORIES.map((cat) => ({
    category: cat,
    score: scores[cat],
    keywords: matchedByCat[cat],
  })).sort((a, b) => b.score - a.score);

  const top = ranked[0];
  const runnerUp = ranked[1];

  const looksLikePersonalP2P =
    PERSONAL_UPI_HANDLE_REGEX.test(rawDescription) ||
    PERSONAL_UPI_PREFIX_REGEX.test(rawDescription.trim());

  // No lexicon match or very weak generic transfer-only hit
  if (top.score === 0) {
    // Cryptic personal P2P transfers (e.g. UPI-PAY-RAHUL-SHARMA@okicici) must score < 0.70
    if (looksLikePersonalP2P) {
      return {
        category: 'Transfers',
        confidence: 0.48,
        categorizedBy: 'ml',
        matchedKeywords: ['Personal UPI P2P pattern'],
      };
    }
    return {
      category: 'Transfers',
      confidence: 0.52,
      categorizedBy: 'ml',
      matchedKeywords: [],
    };
  }

  // If it only matched generic transfer words (like neft/imps) and also looks like P2P
  if (
    top.category === 'Transfers' &&
    top.score < 3.0 &&
    looksLikePersonalP2P
  ) {
    return {
      category: 'Transfers',
      confidence: 0.54,
      categorizedBy: 'ml',
      matchedKeywords: top.keywords.length ? top.keywords : ['Personal UPI P2P'],
    };
  }

  // Compute calibrated confidence score [0.00 - 0.99]
  const margin = top.score - runnerUp.score;
  let confidence = 0.55 + Math.min(top.score, 6.0) * 0.058 + Math.min(margin, 2.5) * 0.032;

  // Penalize confidence slightly if personal P2P handle is present without strong brand hit
  if (looksLikePersonalP2P && top.score < 3.5) {
    confidence = Math.min(confidence, 0.64);
  }

  confidence = Math.max(0.35, Math.min(0.98, Number(confidence.toFixed(2))));

  return {
    category: top.category,
    confidence,
    categorizedBy: 'ml',
    matchedKeywords: top.keywords,
  };
}
