/**
 * KPI / target extractor for Vietnamese government plan documents.
 *
 * Vietnamese plan documents embed KPI targets in prose text. For example:
 *   "phấn đấu tốc độ tăng trưởng GDP cả nước bình quân đạt khoảng 7,0%/năm"
 *
 * This module provides two extraction strategies:
 *   1. Rule-based (regex) — works offline, no API key needed.
 *   2. LLM-based (Claude API) — higher accuracy, requires ANTHROPIC_API_KEY.
 *
 * Usage:
 *   import { extractTargets } from './extract-targets';
 *   const targets = await extractTargets(sectionText);
 *   const targets = await extractTargets(sectionText, { useLLM: true });
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type TargetType = 'QUANTITATIVE' | 'QUALITATIVE' | 'MILESTONE';

export interface ExtractedTarget {
  targetType: TargetType;
  nameVi: string;           // "Tốc độ tăng trưởng GDP"
  nameEn?: string;          // Optional English translation
  unit?: string;            // "%", "USD", "km", "nghìn ha"
  targetValue?: number;     // 7.0
  targetYear?: number;      // 2030
  targetMin?: number;       // For ranges: 6.5
  targetMax?: number;       // For ranges: 7.0
  baselineValue?: number;
  baselineYear?: number;
  rawTextVi: string;        // Original sentence the target was extracted from
  metadata?: Record<string, unknown>;
}

export interface ExtractTargetsOptions {
  useLLM?: boolean;
  apiKey?: string;
}

// ---------------------------------------------------------------------------
// Vietnamese number helpers
// ---------------------------------------------------------------------------

/**
 * Parse a Vietnamese-formatted number string.
 *
 * Vietnamese conventions:
 *   - Dot (.) is the thousands separator: 7.500 = 7500
 *   - Comma (,) is the decimal separator:  6,5  = 6.5
 *   - Mixed: 1.234,56 = 1234.56
 *
 * Also handles plain integers and floats with dot decimal (for mixed contexts).
 *
 * Returns null if the string is not a recognisable number.
 */
export function parseVietnameseNumber(raw: string): number | null {
  const s = raw.trim();
  if (!s) return null;

  // Pure integer (no separators)
  if (/^-?\d+$/.test(s)) {
    return parseInt(s, 10);
  }

  // Vietnamese style: 1.234.567 or 1.234,56 or 7.500 or 6,5
  // Pattern: optional digits+dot groups, then optional comma+decimals
  if (/^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) {
    // Thousands-separated integer or decimal
    const normalised = s.replace(/\./g, '').replace(',', '.');
    const num = parseFloat(normalised);
    return isNaN(num) ? null : num;
  }

  // Vietnamese decimal without thousands: 6,5 or 12,34
  if (/^-?\d+(,\d+)$/.test(s)) {
    const normalised = s.replace(',', '.');
    const num = parseFloat(normalised);
    return isNaN(num) ? null : num;
  }

  // International float: 6.5, 7.0 (dot as decimal)
  // Only match if it does NOT look like Vietnamese thousands (i.e., not exactly 3 digits after dot)
  if (/^-?\d+\.\d+$/.test(s)) {
    // If pattern is like X.YYY where YYY is exactly 3 digits and X is 1-3 digits,
    // it is ambiguous — could be thousands. We check context: if the numeric value
    // is large (>= 1000 when interpreted as thousands), treat as thousands.
    const parts = s.split('.');
    if (parts[1].length === 3 && parts[0].length <= 3) {
      // Ambiguous — e.g., "7.500" could be 7500 or 7.500
      // In Vietnamese government docs, this is almost always thousands: 7.500 = 7500
      const asThousands = parseFloat(s.replace('.', ''));
      return isNaN(asThousands) ? null : asThousands;
    }
    const num = parseFloat(s);
    return isNaN(num) ? null : num;
  }

  return null;
}

/**
 * Parse a number that may appear inline in Vietnamese text.
 * Handles forms like "7,0", "7.500", "50", "6,5", etc.
 * Strips trailing non-numeric characters.
 */
function parseInlineNumber(raw: string): number | null {
  // Remove surrounding whitespace
  const s = raw.trim();
  // Extract the numeric part (digits, dots, commas, optional leading minus)
  const match = s.match(/^(-?\d[\d.,]*)/);
  if (!match) return null;
  return parseVietnameseNumber(match[1]);
}

// ---------------------------------------------------------------------------
// Sentence splitter
// ---------------------------------------------------------------------------

/**
 * Split Vietnamese text into individual sentences / clause fragments.
 *
 * We split on:
 *   - Period followed by space + uppercase letter (sentence boundary)
 *   - Semicolons (;) — clause separator in Vietnamese legal text
 *   - Newlines (already separated)
 *   - Dash/bullet items at start of line
 *
 * Returns an array of non-empty trimmed sentences.
 */
function splitSentences(text: string): string[] {
  // First split by newlines to preserve line structure
  const lines = text.split(/\n/);
  const sentences: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Split on period-space-uppercase, semicolons, and period-space-dash
    // But preserve the content before the split point
    const parts = trimmed.split(/(?<=\.)\s+(?=[A-ZĐÀÁẢÃẠĂẮẰẲẴẶÂẤẦẨẪẬÈÉẺẼẸÊẾỀỂỄỆÌÍỈĨỊÒÓỎÕỌÔỐỒỔỖỘƠỚỜỞỠỢÙÚỦŨỤƯỨỪỬỮỰỲÝỶỸỴ])|;\s*/);

    for (const part of parts) {
      const s = part.trim();
      if (s.length > 0) {
        sentences.push(s);
      }
    }
  }

  return sentences;
}

/**
 * Further split a sentence into sub-clauses when it contains multiple
 * comma-separated KPI targets. For example:
 *   "dịch vụ đạt trên 50%, khu vực công nghiệp trên 40%, nông nghiệp dưới 10%"
 * becomes three separate clauses.
 *
 * We only split on commas that are followed by a new KPI subject + numeric target.
 */
function splitSubClauses(sentence: string): string[] {
  // Pattern: comma, optional space, then a Vietnamese word phrase followed by
  // a numeric indicator keyword (đạt, trên, dưới, khoảng, ít nhất, ở mức, có, là, còn)
  const splitPattern = /,\s+(?=(?:khu\s+vực|tỷ\s+(?:lệ|trọng|số)|tốc\s+độ|số\s+lượng|diện\s+tích|chiều\s+dài|mức|GDP|HDI)[\wàáảãạăắằẳẵặâấầẩẫậèéẻẽẹêếềểễệìíỉĩịòóỏõọôốồổỗộơớờởỡợùúủũụưứừửữựỳýỷỹỵđĐ\s,()-]*?\s+(?:đạt|trên|dưới|khoảng|ít\s+nhất|ở\s+mức|có|là|còn)\s)/i;

  const parts = sentence.split(splitPattern);
  if (parts.length <= 1) return [sentence];

  return parts.map((p) => p.trim()).filter((p) => p.length > 0);
}

// ---------------------------------------------------------------------------
// Unit detection
// ---------------------------------------------------------------------------

/** Known unit patterns and their canonical forms. */
const UNIT_PATTERNS: Array<{ regex: RegExp; unit: string }> = [
  { regex: /%\/năm\b/i, unit: '%/năm' },
  { regex: /%/i, unit: '%' },
  { regex: /\bUSD\b/i, unit: 'USD' },
  { regex: /\btriệu USD\b/i, unit: 'triệu USD' },
  { regex: /\btỷ USD\b/i, unit: 'tỷ USD' },
  { regex: /\bnghìn tỷ đồng\b/i, unit: 'nghìn tỷ đồng' },
  { regex: /\btỷ đồng\b/i, unit: 'tỷ đồng' },
  { regex: /\btriệu đồng\b/i, unit: 'triệu đồng' },
  { regex: /\bnghìn ha\b/i, unit: 'nghìn ha' },
  { regex: /\btriệu ha\b/i, unit: 'triệu ha' },
  { regex: /\bha\b/i, unit: 'ha' },
  { regex: /\bkm\b/i, unit: 'km' },
  { regex: /\bMW\b/, unit: 'MW' },
  { regex: /\bGW\b/, unit: 'GW' },
  { regex: /\bgiường bệnh\b/i, unit: 'giường bệnh' },
  { regex: /\bbác sĩ\b/i, unit: 'bác sĩ' },
  { regex: /\bngười\b/i, unit: 'người' },
  { regex: /\blao động\b/i, unit: 'lao động' },
  { regex: /\btriệu người\b/i, unit: 'triệu người' },
  { regex: /\btriệu lượt\b/i, unit: 'triệu lượt' },
  { regex: /\bnghìn người\b/i, unit: 'nghìn người' },
  { regex: /\bdân số\b/i, unit: 'dân số' },
];

/**
 * Detect the unit from a text fragment containing a numeric target.
 */
function detectUnit(text: string): string | undefined {
  for (const { regex, unit } of UNIT_PATTERNS) {
    if (regex.test(text)) return unit;
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// Year extraction
// ---------------------------------------------------------------------------

/**
 * Extract target year from text. Looks for patterns like:
 *   - "đến năm 2030"
 *   - "năm 2025"
 *   - "giai đoạn 2021 - 2030" (takes the end year)
 *   - "2030"
 */
function extractYear(text: string): number | undefined {
  // "đến năm YYYY" / "den nam YYYY"
  const denNam = text.match(/đến\s+năm\s+(\d{4})/i);
  if (denNam) return parseInt(denNam[1], 10);

  // "năm YYYY"
  const nam = text.match(/năm\s+(\d{4})/i);
  if (nam) return parseInt(nam[1], 10);

  // "giai đoạn YYYY - YYYY" (take end year)
  const giaiDoan = text.match(/giai\s+đoạn\s+(\d{4})\s*[-–]\s*(\d{4})/i);
  if (giaiDoan) return parseInt(giaiDoan[2], 10);

  // Standalone 4-digit year between 2000-2099
  const standalone = text.match(/\b(20\d{2})\b/);
  if (standalone) return parseInt(standalone[1], 10);

  return undefined;
}

/**
 * Extract period information (start year - end year) if present.
 */
function extractPeriod(text: string): { startYear?: number; endYear?: number } {
  const giaiDoan = text.match(/giai\s+đoạn\s+(\d{4})\s*[-–]\s*(\d{4})/i);
  if (giaiDoan) {
    return {
      startYear: parseInt(giaiDoan[1], 10),
      endYear: parseInt(giaiDoan[2], 10),
    };
  }
  return {};
}

// ---------------------------------------------------------------------------
// KPI name extraction
// ---------------------------------------------------------------------------

/**
 * Common Vietnamese KPI name patterns.
 * Each pattern captures the indicator name preceding the numeric value.
 */
const KPI_NAME_PATTERNS: RegExp[] = [
  // "Tốc độ tăng trưởng GDP ... đạt"
  /(?:tốc\s+độ\s+(?:tăng(?:\s+trưởng)?)\s+[\wàáảãạăắằẳẵặâấầẩẫậèéẻẽẹêếềểễệìíỉĩịòóỏõọôốồổỗộơớờởỡợùúủũụưứừửữựỳýỷỹỵđĐ\s-]+?)(?=\s+(?:bình\s+quân\s+)?đạt)/i,

  // "GDP bình quân đầu người ... đạt"
  /(?:GDP\s+bình\s+quân\s+đầu\s+người[\wàáảãạăắằẳẵặâấầẩẫậèéẻẽẹêếềểễệìíỉĩịòóỏõọôốồổỗộơớờởỡợùúủũụưứừửữựỳýỷỹỵđĐ\s-]*?)(?=\s+đạt)/i,

  // "Tỷ trọng ... đạt"
  /(?:tỷ\s+trọng[\wàáảãạăắằẳẵặâấầẩẫậèéẻẽẹêếềểễệìíỉĩịòóỏõọôốồổỗộơớờởỡợùúủũụưứừửữựỳýỷỹỵđĐ\s-]*?)(?=\s+đạt)/i,

  // "Tỷ lệ ... đạt"
  /(?:tỷ\s+lệ[\wàáảãạăắằẳẵặâấầẩẫậèéẻẽẹêếềểễệìíỉĩịòóỏõọôốồổỗộơớờởỡợùúủũụưứừửữựỳýỷỹỵđĐ\s,()-]*?)(?=\s+đạt)/i,

  // Generic: "X đạt khoảng/trên/dưới Y"
  // Capture everything before "đạt" that looks like a name
  /(?:(?:^|[.;]\s*)([A-ZĐÀÁẢÃẠĂẮẰẲẴẶÂẤẦẨẪẬÈÉẺẼẸÊẾỀỂỄỆÌÍỈĨỊÒÓỎÕỌÔỐỒỔỖỘƠỚỜỞỠỢÙÚỦŨỤƯỨỪỬỮỰỲÝỶỸỴa-zàáảãạăắằẳẵặâấầẩẫậèéẻẽẹêếềểễệìíỉĩịòóỏõọôốồổỗộơớờởỡợùúủũụưứừửữựỳýỷỹỵđ][\wàáảãạăắằẳẵặâấầẩẫậèéẻẽẹêếềểễệìíỉĩịòóỏõọôốồổỗộơớờởỡợùúủũụưứừửữựỳýỷỹỵđĐ\s,()-]*?))(?=\s+đạt)/i,
];

/**
 * Extract the KPI/indicator name from a sentence.
 * Returns the extracted name or a fallback truncation of the sentence.
 */
function extractKpiName(sentence: string): string {
  for (const pattern of KPI_NAME_PATTERNS) {
    const match = sentence.match(pattern);
    if (match) {
      // Use the last non-null capture group, or the full match
      const name = (match[1] || match[0]).trim();
      // Clean up: remove leading dashes, bullets, "Về kinh tế:" prefixes
      const cleaned = name
        .replace(/^[-+•]\s*/, '')
        .replace(/^(?:Về\s+[\wàáảãạăắằẳẵặâấầẩẫậèéẻẽẹêếềểễệìíỉĩịòóỏõọôốồổỗộơớờởỡợùúủũụưứừửữựỳýỷỹỵđĐ\s]+:\s*)/i, '')
        .replace(/^\s*phấn\s+đấu\s+/i, '')
        .trim();
      if (cleaned.length > 3) return cleaned;
    }
  }

  // Fallback: try to extract the subject before any indicator keyword
  const beforeKeyword = sentence.match(
    /^[^.;]*?(?:(?:[-+•]\s*)?(?:Về\s+[\wàáảãạăắằẳẵặâấầẩẫậèéẻẽẹêếềểễệìíỉĩịòóỏõọôốồổỗộơớờởỡợùúủũụưứừửữựỳýỷỹỵđĐ\s]+:\s*)?(?:phấn\s+đấu\s+)?(?:đến\s+năm\s+\d{4},?\s*)?(?:có\s+)?)([\wàáảãạăắằẳẵặâấầẩẫậèéẻẽẹêếềểễệìíỉĩịòóỏõọôốồổỗộơớờởỡợùúủũụưứừửữựỳýỷỹỵđĐ\s,()-]+?)(?=\s+(?:đạt|khoảng|trên|dưới|là|còn|tăng|giảm|ở\s+mức|ít\s+nhất|ổn\s+định)\s)/i,
  );
  if (beforeKeyword && beforeKeyword[1] && beforeKeyword[1].trim().length > 3) {
    return beforeKeyword[1].trim();
  }

  // Try extracting text before a number
  const beforeNumber = sentence.match(
    /^(.+?)\s+(?:đạt|trên|dưới|khoảng|ít\s+nhất|ở\s+mức|có|là|còn)\s+\d/i,
  );
  if (beforeNumber && beforeNumber[1]) {
    let cleaned = beforeNumber[1]
      .replace(/^[-+•]\s*/, '')
      .replace(/^(?:Về\s+[\wàáảãạăắằẳẵặâấầẩẫậèéẻẽẹêếềểễệìíỉĩịòóỏõọôốồổỗộơớờởỡợùúủũụưứừửữựỳýỷỹỵđĐ\s]+:\s*)/i, '')
      .trim();
    // Iteratively strip common prefixes (phấn đấu, đến năm YYYY, có)
    for (let attempts = 0; attempts < 3; attempts++) {
      const before = cleaned;
      cleaned = cleaned
        .replace(/^phấn\s+đấu\s+/i, '')
        .replace(/^đến\s+năm\s+\d{4},?\s*/i, '')
        .replace(/^có\s+/i, '')
        .trim();
      if (cleaned === before) break;
    }
    if (cleaned.length > 3) return cleaned;
  }

  // Try extracting the subject AFTER the number (e.g., "5.000 km đường bộ cao tốc")
  // This handles cases where the KPI name follows the numeric value
  const afterNumber = sentence.match(
    /(?:đạt|trên|dưới|khoảng|ít\s+nhất|ở\s+mức|có)\s+\d[\d.,]*\s*(?:%(?:\/năm)?|USD|km|ha|MW|GW|triệu|tỷ|nghìn)?\s+([\wàáảãạăắằẳẵặâấầẩẫậèéẻẽẹêếềểễệìíỉĩịòóỏõọôốồổỗộơớờởỡợùúủũụưứừửữựỳýỷỹỵđĐ][\wàáảãạăắằẳẵặâấầẩẫậèéẻẽẹêếềểễệìíỉĩịòóỏõọôốồổỗộơớờởỡợùúủũụưứừửữựỳýỷỹỵđĐ\s]*)/i,
  );
  if (afterNumber && afterNumber[1] && afterNumber[1].trim().length > 3) {
    return afterNumber[1].trim();
  }

  // Last resort: use the first ~60 chars of the sentence
  const truncated = sentence.substring(0, 80).replace(/\s+\S*$/, '').trim();
  return truncated || sentence.substring(0, 60);
}

// ---------------------------------------------------------------------------
// Rule-based extraction patterns
// ---------------------------------------------------------------------------

/**
 * Match result from a KPI pattern.
 */
interface KpiMatch {
  /** What the pattern captured for the numeric value */
  valueStr: string;
  /** Optional second value for ranges */
  valueStr2?: string;
  /** Comparison type */
  comparison: 'exact' | 'above' | 'below' | 'range' | 'approximately';
  /** Unit if found adjacent to the number */
  unitHint?: string;
  /** Index in the sentence where the match starts */
  matchIndex: number;
  /** Full match string */
  matchStr: string;
}

/**
 * KPI numeric patterns found in Vietnamese government documents.
 *
 * Ordered from most specific to least specific to reduce false positives.
 * Vietnamese text uses comma as decimal separator in running text.
 */
const KPI_REGEX_PATTERNS: Array<{
  regex: RegExp;
  comparison: KpiMatch['comparison'];
  valueGroup: number;
  valueGroup2?: number;
}> = [
  // Range: "X - Y%" / "X – Y%" / "X,X - Y,Y%"
  {
    regex: /(\d[\d.,]*)\s*[-–]\s*(\d[\d.,]*)\s*(%(?:\/năm)?|\bUSD\b|\bkm\b|\bha\b|\bMW\b|\bGW\b)/gi,
    comparison: 'range',
    valueGroup: 1,
    valueGroup2: 2,
  },
  // "đạt khoảng X%" / "đạt khoảng X USD"
  {
    regex: /đạt\s+khoảng\s+(\d[\d.,]*)\s*(%(?:\/năm)?|\bUSD\b|\btriệu\b|\btỷ\b|\bnghìn\b|\bkm\b|\bha\b|\bMW\b)/gi,
    comparison: 'approximately',
    valueGroup: 1,
  },
  // "đạt trên X%" / "đạt trên X"
  {
    regex: /đạt\s+trên\s+(\d[\d.,]*)\s*(%(?:\/năm)?|\bUSD\b|\btriệu\b|\btỷ\b|\bnghìn\b|\bkm\b|\bha\b|\bMW\b)?/gi,
    comparison: 'above',
    valueGroup: 1,
  },
  // "trên X%" (without "đạt")
  {
    regex: /\btrên\s+(\d[\d.,]*)\s*(%(?:\/năm)?)/gi,
    comparison: 'above',
    valueGroup: 1,
  },
  // "dưới X%" / "dưới X"
  {
    regex: /(?:đạt\s+)?dưới\s+(\d[\d.,]*)\s*(%(?:\/năm)?|\bUSD\b|\btriệu\b|\btỷ\b|\bnghìn\b|\bkm\b|\bha\b)?/gi,
    comparison: 'below',
    valueGroup: 1,
  },
  // "đạt X%" / "đạt X USD" / "đạt X"
  {
    regex: /đạt\s+(\d[\d.,]*)\s*(%(?:\/năm)?|\bUSD\b|\btriệu\b|\btỷ\b|\bnghìn\b|\bkm\b|\bha\b|\bMW\b)?/gi,
    comparison: 'exact',
    valueGroup: 1,
  },
  // "khoảng X%" (without "đạt")
  {
    regex: /khoảng\s+(\d[\d.,]*)\s*(%(?:\/năm)?|\bUSD\b|\btriệu\b|\btỷ\b|\bnghìn\b)/gi,
    comparison: 'approximately',
    valueGroup: 1,
  },
  // "là X%" / "còn X%"
  {
    regex: /(?:là|còn)\s+(\d[\d.,]*)\s*(%(?:\/năm)?)/gi,
    comparison: 'exact',
    valueGroup: 1,
  },
  // "tăng X%" / "giảm X%"
  {
    regex: /(?:tăng|giảm)\s+(\d[\d.,]*)\s*(%(?:\/năm)?)/gi,
    comparison: 'exact',
    valueGroup: 1,
  },
  // "ở mức X%" / "ở mức X"
  {
    regex: /ở\s+mức\s+(\d[\d.,]*)\s*(%(?:\/năm)?|\bUSD\b|\btriệu\b|\btỷ\b|\bnghìn\b|\bkm\b|\bha\b)?/gi,
    comparison: 'approximately',
    valueGroup: 1,
  },
  // "ít nhất X km" / "ít nhất X%"
  {
    regex: /ít\s+nhất\s+(\d[\d.,]*)\s*(%(?:\/năm)?|\bUSD\b|\btriệu\b|\btỷ\b|\bnghìn\b|\bkm\b|\bha\b|\bMW\b)?/gi,
    comparison: 'above',
    valueGroup: 1,
  },
  // "có X km" / "có X%" — "có" + number + unit (common in infrastructure targets)
  {
    regex: /\bcó\s+(\d[\d.,]*)\s*(km|ha|%|MW|GW|giường\s+bệnh)/gi,
    comparison: 'exact',
    valueGroup: 1,
  },
  // "X%" standalone with preceding "đạt" already covered — catch "100%" patterns
  {
    regex: /\b(\d{2,3})\s*%(?!\s*\/)/gi,
    comparison: 'exact',
    valueGroup: 1,
  },
  // "X triệu USD" / "X tỷ đồng" etc. (standalone large number + unit)
  {
    regex: /(\d[\d.,]*)\s*(triệu\s+USD|tỷ\s+USD|tỷ\s+đồng|nghìn\s+tỷ\s+đồng|triệu\s+đồng|nghìn\s+ha|triệu\s+ha|nghìn\s+người|triệu\s+người|triệu\s+lượt)/gi,
    comparison: 'exact',
    valueGroup: 1,
  },
  // "X USD" standalone
  {
    regex: /(\d[\d.,]*)\s+USD/gi,
    comparison: 'exact',
    valueGroup: 1,
  },
];

/**
 * Find all KPI numeric matches in a sentence.
 */
function findKpiMatches(sentence: string): KpiMatch[] {
  const results: KpiMatch[] = [];
  const usedRanges: Array<[number, number]> = []; // track [start, end] to avoid overlaps

  for (const pattern of KPI_REGEX_PATTERNS) {
    // Reset regex state
    pattern.regex.lastIndex = 0;
    let m: RegExpExecArray | null;

    while ((m = pattern.regex.exec(sentence)) !== null) {
      const matchStart = m.index;
      const matchEnd = m.index + m[0].length;

      // Skip if this overlaps with a previous (higher-priority) match
      const overlaps = usedRanges.some(
        ([s, e]) => matchStart < e && matchEnd > s,
      );
      if (overlaps) continue;

      usedRanges.push([matchStart, matchEnd]);

      const kpiMatch: KpiMatch = {
        valueStr: m[pattern.valueGroup],
        comparison: pattern.comparison,
        matchIndex: m.index,
        matchStr: m[0],
      };

      if (pattern.valueGroup2 && m[pattern.valueGroup2]) {
        kpiMatch.valueStr2 = m[pattern.valueGroup2];
      }

      // Check for unit hint in the match
      const unitCapture = m[m.length > 2 ? (pattern.valueGroup2 ? 3 : 2) : 0];
      if (unitCapture && /[a-zA-Z%đĐ]/.test(unitCapture)) {
        kpiMatch.unitHint = unitCapture.trim();
      }

      results.push(kpiMatch);
    }
  }

  // Sort by position in the sentence
  results.sort((a, b) => a.matchIndex - b.matchIndex);
  return results;
}

// ---------------------------------------------------------------------------
// Rule-based extraction (Approach 1)
// ---------------------------------------------------------------------------

/**
 * Extract KPI targets from Vietnamese text using regex-based rules.
 *
 * This approach does not require an API key and works entirely offline.
 * It reliably extracts quantitative targets but may miss complex or
 * qualitative targets.
 *
 * @param contentVi - Vietnamese text containing KPI targets.
 * @returns Array of extracted targets.
 */
export function extractTargetsRuleBased(contentVi: string): ExtractedTarget[] {
  const targets: ExtractedTarget[] = [];
  const sentences = splitSentences(contentVi);

  for (const sentence of sentences) {
    // Try splitting the sentence into sub-clauses for multi-KPI sentences
    const clauses = splitSubClauses(sentence);

    for (const clause of clauses) {
      const matches = findKpiMatches(clause);

      for (const match of matches) {
        const value1 = parseInlineNumber(match.valueStr);
        const value2 = match.valueStr2 ? parseInlineNumber(match.valueStr2) : null;

        if (value1 === null && value2 === null) continue;

        // Determine unit: first check text near the match, then the full clause
        const unit = detectUnit(clause) || (match.unitHint ? normalizeUnit(match.unitHint) : undefined);

        // Extract target year from the clause, or fall back to the full sentence
        const year = extractYear(clause) || extractYear(sentence);

        // Extract period metadata from clause or sentence
        const period = extractPeriod(clause);
        if (!period.startYear && !period.endYear) {
          const sentPeriod = extractPeriod(sentence);
          if (sentPeriod.startYear) period.startYear = sentPeriod.startYear;
          if (sentPeriod.endYear) period.endYear = sentPeriod.endYear;
        }

        // Extract KPI name — use the local clause text for better per-match names
        const nameVi = extractKpiName(clause);

        // Build target entry
        const target: ExtractedTarget = {
          targetType: 'QUANTITATIVE',
          nameVi,
          unit,
          rawTextVi: clause.trim(),
        };

        // Assign values based on comparison type
        switch (match.comparison) {
          case 'range':
            target.targetMin = value1 ?? undefined;
            target.targetMax = value2 ?? undefined;
            // Use midpoint as targetValue if both are available
            if (value1 !== null && value2 !== null) {
              target.targetValue = (value1 + value2) / 2;
            }
            break;

          case 'above':
            target.targetMin = value1 ?? undefined;
            target.targetValue = value1 ?? undefined;
            target.metadata = { ...target.metadata, comparison: 'above' };
            break;

          case 'below':
            target.targetMax = value1 ?? undefined;
            target.targetValue = value1 ?? undefined;
            target.metadata = { ...target.metadata, comparison: 'below' };
            break;

          case 'approximately':
            target.targetValue = value1 ?? undefined;
            target.metadata = { ...target.metadata, comparison: 'approximately' };
            break;

          case 'exact':
          default:
            target.targetValue = value1 ?? undefined;
            break;
        }

        // Assign year
        if (year) {
          target.targetYear = year;
        }

        // Attach period info to metadata if present
        if (period.startYear || period.endYear) {
          target.metadata = {
            ...target.metadata,
            period: {
              startYear: period.startYear,
              endYear: period.endYear,
            },
          };
        }

        targets.push(target);
      }
    }
  }

  return deduplicateTargets(targets);
}

/**
 * Normalize a unit hint string into a canonical unit name.
 */
function normalizeUnit(hint: string): string | undefined {
  const s = hint.trim().toLowerCase();
  if (s === '%' || s === '%/năm') return s;
  if (s.includes('usd')) return 'USD';
  if (s.includes('km')) return 'km';
  if (s.includes('ha')) return 'ha';
  if (s.includes('mw')) return 'MW';
  if (s.includes('gw')) return 'GW';
  if (s.includes('nghìn')) return s;
  if (s.includes('triệu')) return s;
  if (s.includes('tỷ')) return s;
  return hint.trim() || undefined;
}

/**
 * Remove duplicate targets that refer to the same KPI in the same sentence.
 * Keeps the entry with more complete data.
 */
function deduplicateTargets(targets: ExtractedTarget[]): ExtractedTarget[] {
  const result: ExtractedTarget[] = [];
  const seen = new Set<string>();

  for (const t of targets) {
    // Create a rough dedup key from the name + value + unit
    const key = `${t.nameVi}|${t.targetValue ?? ''}|${t.unit ?? ''}|${t.targetMin ?? ''}|${t.targetMax ?? ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(t);
  }

  return result;
}

// ---------------------------------------------------------------------------
// LLM-based extraction (Approach 2)
// ---------------------------------------------------------------------------

/** The system prompt for the Claude API extraction call. */
const LLM_SYSTEM_PROMPT = `You are a specialist in extracting KPI targets from Vietnamese government planning documents.

Given a section of Vietnamese text, extract ALL quantitative, qualitative, and milestone targets. Return a JSON array.

RULES:
1. Vietnamese number format: dot (.) = thousands separator, comma (,) = decimal separator.
   - "7.500" = 7500 (seven thousand five hundred)
   - "6,5" = 6.5 (six point five)
   - "1.234,56" = 1234.56
2. Extract the indicator/KPI name in Vietnamese (nameVi field).
3. Provide an English translation for nameEn when possible.
4. For ranges like "6,5 - 7,0%", set targetMin and targetMax. Also set targetValue to the midpoint.
5. For "đạt trên X%" (above), set targetMin = X and comparison metadata.
6. For "dưới X%" (below), set targetMax = X and comparison metadata.
7. For "đạt khoảng X%" (approximately), set targetValue = X.
8. Extract the target year when mentioned (e.g., "đến năm 2030" → targetYear: 2030).
9. Include the complete original Vietnamese sentence in rawTextVi.
10. Set targetType: "QUANTITATIVE" for numeric targets, "QUALITATIVE" for non-numeric goals, "MILESTONE" for date-based targets.
11. Detect units: %, %/năm, USD, triệu USD, tỷ đồng, km, ha, etc.
12. If a baseline value/year is mentioned (e.g., "so với năm 2020"), extract it.`;

const LLM_USER_PROMPT_TEMPLATE = `Extract all KPI targets from this Vietnamese government planning text. Return ONLY a valid JSON array of objects with these fields:

{
  "targetType": "QUANTITATIVE" | "QUALITATIVE" | "MILESTONE",
  "nameVi": "string (Vietnamese KPI name)",
  "nameEn": "string (English translation, optional)",
  "unit": "string (%, USD, km, etc., optional)",
  "targetValue": number | null,
  "targetYear": number | null,
  "targetMin": number | null,
  "targetMax": number | null,
  "baselineValue": number | null,
  "baselineYear": number | null,
  "rawTextVi": "string (the original sentence)",
  "metadata": {} | null
}

TEXT:
---
{{TEXT}}
---

Return ONLY the JSON array, no markdown fences, no explanation.`;

/**
 * Extract KPI targets using the Claude API (LLM-based).
 *
 * Calls the Anthropic Messages API with a structured prompt that
 * instructs Claude to return a JSON array of targets.
 *
 * @param contentVi - Vietnamese text containing KPI targets.
 * @param apiKey - Anthropic API key. Falls back to ANTHROPIC_API_KEY env var.
 * @returns Array of extracted targets.
 * @throws Error if no API key is available or the API call fails.
 */
export async function extractTargetsWithLLM(
  contentVi: string,
  apiKey?: string,
): Promise<ExtractedTarget[]> {
  const key = apiKey || process.env.ANTHROPIC_API_KEY;
  if (!key) {
    throw new Error(
      'No Anthropic API key provided. Set ANTHROPIC_API_KEY environment variable ' +
      'or pass apiKey option.',
    );
  }

  // Truncate very long texts to stay within token limits
  // Claude can handle ~100k tokens, but we want fast responses
  const maxChars = 30_000;
  const truncatedText = contentVi.length > maxChars
    ? contentVi.substring(0, maxChars) + '\n\n[... text truncated ...]'
    : contentVi;

  const userPrompt = LLM_USER_PROMPT_TEMPLATE.replace('{{TEXT}}', truncatedText);

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      system: LLM_SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: userPrompt,
        },
      ],
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(
      `Claude API error (${response.status}): ${errorBody}`,
    );
  }

  const data = await response.json() as {
    content: Array<{ type: string; text?: string }>;
  };

  // Extract text from the response
  const textBlock = data.content.find((block) => block.type === 'text');
  if (!textBlock?.text) {
    throw new Error('No text content in Claude API response');
  }

  // Parse the JSON response
  let rawTargets: unknown[];
  try {
    // Strip potential markdown code fences
    let jsonStr = textBlock.text.trim();
    if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
    }
    rawTargets = JSON.parse(jsonStr);
  } catch {
    throw new Error(
      `Failed to parse Claude API response as JSON: ${textBlock.text.substring(0, 200)}`,
    );
  }

  if (!Array.isArray(rawTargets)) {
    throw new Error('Claude API response is not a JSON array');
  }

  // Validate and normalise each target
  return rawTargets
    .filter((item): item is Record<string, unknown> =>
      typeof item === 'object' && item !== null,
    )
    .map((item) => normalizeLlmTarget(item));
}

/**
 * Normalize a target object returned from the LLM into our ExtractedTarget type.
 * Handles type coercion, missing fields, etc.
 */
function normalizeLlmTarget(raw: Record<string, unknown>): ExtractedTarget {
  const validTypes: Set<string> = new Set(['QUANTITATIVE', 'QUALITATIVE', 'MILESTONE']);
  const rawType = String(raw.targetType || 'QUANTITATIVE').toUpperCase();

  return {
    targetType: validTypes.has(rawType) ? (rawType as TargetType) : 'QUANTITATIVE',
    nameVi: String(raw.nameVi || raw.name_vi || ''),
    nameEn: raw.nameEn != null || raw.name_en != null
      ? String(raw.nameEn ?? raw.name_en)
      : undefined,
    unit: raw.unit != null ? String(raw.unit) : undefined,
    targetValue: toNumberOrUndefined(raw.targetValue ?? raw.target_value),
    targetYear: toIntOrUndefined(raw.targetYear ?? raw.target_year),
    targetMin: toNumberOrUndefined(raw.targetMin ?? raw.target_min),
    targetMax: toNumberOrUndefined(raw.targetMax ?? raw.target_max),
    baselineValue: toNumberOrUndefined(raw.baselineValue ?? raw.baseline_value),
    baselineYear: toIntOrUndefined(raw.baselineYear ?? raw.baseline_year),
    rawTextVi: String(raw.rawTextVi || raw.raw_text_vi || ''),
    metadata: raw.metadata != null && typeof raw.metadata === 'object'
      ? raw.metadata as Record<string, unknown>
      : undefined,
  };
}

function toNumberOrUndefined(val: unknown): number | undefined {
  if (val === null || val === undefined) return undefined;
  const n = Number(val);
  return isNaN(n) ? undefined : n;
}

function toIntOrUndefined(val: unknown): number | undefined {
  if (val === null || val === undefined) return undefined;
  const n = parseInt(String(val), 10);
  return isNaN(n) ? undefined : n;
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

/**
 * Extract KPI targets from Vietnamese plan document text.
 *
 * If `useLLM` is true and an API key is available (via `apiKey` option or
 * `ANTHROPIC_API_KEY` env var), uses the Claude API for high-accuracy extraction.
 * Otherwise falls back to rule-based regex extraction.
 *
 * @param contentVi - Vietnamese text containing KPI targets.
 * @param options - Optional configuration.
 * @returns Array of extracted targets.
 *
 * @example
 * ```typescript
 * // Rule-based (default, no API key needed)
 * const targets = await extractTargets(sectionText);
 *
 * // LLM-based (requires ANTHROPIC_API_KEY env var)
 * const targets = await extractTargets(sectionText, { useLLM: true });
 *
 * // LLM-based with explicit key
 * const targets = await extractTargets(sectionText, {
 *   useLLM: true,
 *   apiKey: 'sk-ant-...',
 * });
 * ```
 */
export async function extractTargets(
  contentVi: string,
  options?: ExtractTargetsOptions,
): Promise<ExtractedTarget[]> {
  const useLLM = options?.useLLM ?? false;
  const apiKey = options?.apiKey;

  if (useLLM) {
    const key = apiKey || process.env.ANTHROPIC_API_KEY;
    if (key) {
      try {
        return await extractTargetsWithLLM(contentVi, key);
      } catch (error) {
        console.warn(
          '[extract-targets] LLM extraction failed, falling back to rule-based:',
          error instanceof Error ? error.message : String(error),
        );
        // Fall through to rule-based
      }
    } else {
      console.warn(
        '[extract-targets] useLLM=true but no API key available. Falling back to rule-based extraction.',
      );
    }
  }

  return extractTargetsRuleBased(contentVi);
}

// ---------------------------------------------------------------------------
// CLI entry point
// ---------------------------------------------------------------------------

/**
 * CLI runner: test the extractor against sample text or a file.
 *
 * Usage:
 *   npx tsx scripts/parsing/extract-targets.ts "path/to/file.txt"
 *   npx tsx scripts/parsing/extract-targets.ts --llm "path/to/file.txt"
 *   npx tsx scripts/parsing/extract-targets.ts --demo
 */
async function runCli(): Promise<void> {
  const args = process.argv.slice(2);
  const useLLM = args.includes('--llm');
  const isDemo = args.includes('--demo');
  const filePath = args.find((a) => !a.startsWith('--'));

  if (!filePath && !isDemo) {
    console.error('Usage: npx tsx scripts/parsing/extract-targets.ts [--llm] [--demo] <file.txt>');
    console.error('');
    console.error('Options:');
    console.error('  --llm    Use Claude API for extraction (requires ANTHROPIC_API_KEY)');
    console.error('  --demo   Run against built-in sample text');
    process.exit(1);
  }

  let text: string;

  if (isDemo) {
    text = DEMO_TEXT;
    console.log('Running demo with sample Vietnamese plan text...\n');
  } else {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = require('fs') as typeof import('fs');
    text = fs.readFileSync(filePath!, 'utf-8');
    console.log(`Extracting targets from: ${filePath}\n`);
  }

  console.log(`Mode: ${useLLM ? 'LLM-based (Claude API)' : 'Rule-based (regex)'}`);
  console.log('─'.repeat(60));

  const targets = await extractTargets(text, { useLLM });

  console.log(`\nFound ${targets.length} targets:\n`);

  for (let i = 0; i < targets.length; i++) {
    const t = targets[i];
    console.log(`[${i + 1}] ${t.nameVi}`);
    if (t.nameEn) console.log(`    EN: ${t.nameEn}`);
    console.log(`    Type: ${t.targetType}`);

    if (t.targetMin !== undefined && t.targetMax !== undefined) {
      console.log(`    Range: ${t.targetMin} - ${t.targetMax} ${t.unit || ''}`);
    } else if (t.targetValue !== undefined) {
      const comp = (t.metadata as Record<string, unknown>)?.comparison;
      const prefix = comp === 'above' ? '>' : comp === 'below' ? '<' : comp === 'approximately' ? '~' : '';
      console.log(`    Value: ${prefix}${t.targetValue} ${t.unit || ''}`);
    }

    if (t.targetYear) console.log(`    Year: ${t.targetYear}`);
    if (t.baselineValue !== undefined) {
      console.log(`    Baseline: ${t.baselineValue} (${t.baselineYear || '?'})`);
    }

    // Show truncated raw text
    const rawPreview = t.rawTextVi.length > 100
      ? t.rawTextVi.substring(0, 100) + '...'
      : t.rawTextVi;
    console.log(`    Raw: "${rawPreview}"`);
    console.log('');
  }
}

// ---------------------------------------------------------------------------
// Demo text for --demo mode
// ---------------------------------------------------------------------------

const DEMO_TEXT = `Về kinh tế: phấn đấu tốc độ tăng trưởng GDP cả nước bình quân đạt khoảng 7,0%/năm giai đoạn 2021 - 2030. Đến năm 2030, GDP bình quân đầu người theo giá hiện hành đạt khoảng 7.500 USD. Tỷ trọng trong GDP của khu vực dịch vụ đạt trên 50%, khu vực công nghiệp - xây dựng trên 40%, khu vực nông, lâm, thủy sản dưới 10%. Tốc độ tăng năng suất lao động xã hội bình quân đạt trên 6,5%/năm.
Về xã hội: Đến năm 2030, tỷ lệ lao động qua đào tạo có bằng cấp, chứng chỉ đạt 35 - 40%. Tỷ lệ thất nghiệp ở khu vực thành thị dưới 4%. Tỷ lệ nghèo đa chiều duy trì mức giảm 1 - 1,5%/năm.
Về môi trường: Đến năm 2030, tỷ lệ che phủ rừng ổn định ở mức 42%. Tỷ lệ xử lý và tái sử dụng nước thải ra môi trường lưu vực các sông đạt trên 70%.
Về hạ tầng: Phấn đấu đến năm 2030 có ít nhất 5.000 km đường bộ cao tốc; 100% xã có đường ô tô đến trung tâm xã được trải nhựa hoặc bê tông.`;

// ---------------------------------------------------------------------------
// Entry point guard
// ---------------------------------------------------------------------------

if (typeof process !== 'undefined' && process.argv[1]?.includes('extract-targets')) {
  runCli().catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
}
