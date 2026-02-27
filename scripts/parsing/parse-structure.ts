/**
 * Rule-based section parser for Vietnamese government plan documents.
 *
 * Handles the hierarchical section structure found in:
 *  - National documents (Nghi quyet from Quoc hoi):
 *      Dieu -> Arabic -> Letter/Roman -> Dash
 *  - Regional/sector/provincial documents (Quyet dinh from Thu tuong):
 *      Dieu -> Roman -> Arabic -> Letter -> Dash
 *
 * Usage:
 *   import { parseStructure } from './parse-structure';
 *   const doc = parseStructure(rawText);
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SectionLevel = 'DIEU' | 'ROMAN' | 'ARABIC' | 'LETTER' | 'DASH';

export interface ParsedSection {
  level: SectionLevel;
  sectionNumber: string;
  titleVi: string | null;
  contentVi: string;
  sortOrder: number;
  children: ParsedSection[];
  metadata?: Record<string, unknown>;
}

export interface ParsedDocument {
  /** Text before "QUYET NGHI:" or the first Dieu */
  preamble: string;
  sections: ParsedSection[];
  /** Text after the last Dieu (signature block, appendix header, etc.) */
  signatureBlock: string;
}

// ---------------------------------------------------------------------------
// Regex patterns
// ---------------------------------------------------------------------------

/**
 * "Dieu 1. Title here" -- always starts a new line, bold in the original.
 * Group 1 = number, Group 2 = title text
 */
const RE_DIEU = /^\u0110i\u1ec1u\s+(\d+)\.\s*(.+)$/;

/**
 * "1. Sub section" -- arabic numeral followed by dot and space.
 * Group 1 = number, Group 2 = text
 */
const RE_ARABIC = /^(\d+)\.\s+(.+)$/;

/**
 * "a) Sub sub section" -- lowercase letter (including Vietnamese d-bar) + closing paren.
 * Group 1 = letter, Group 2 = text
 */
const RE_LETTER = /^([a-z\u0111])\)\s+(.+)$/;

/**
 * "I. Roman section" -- Roman numeral followed by dot and space.
 * Supports I through XXXIX which covers any realistic Vietnamese legal document.
 * Group 1 = roman numeral, Group 2 = text
 */
const RE_ROMAN = /^(X{0,3}(?:IX|IV|V?I{0,3}))\.\s+(.+)$/;

/**
 * "- Dash item" or "+ Plus item" -- dash/plus at start of line.
 * Group 1 = text after the marker
 */
const RE_DASH = /^[-+]\s+(.+)$/;

// ---------------------------------------------------------------------------
// Preamble / signature detection
// ---------------------------------------------------------------------------

/**
 * Markers that signal the end of the preamble section.
 * "QUYET NGHI:" appears in Nghi quyet documents.
 * "QUYET DINH:" appears in Quyet dinh documents.
 */
const PREAMBLE_END_MARKERS = [
  'QUY\u1EBET NGH\u1ECA:',   // QUYET NGHI:
  'QUY\u1EBET \u0110\u1ECANH:', // QUYET DINH:
];

/**
 * Markers that indicate the start of the signature block after the last Dieu.
 * These are checked against trimmed lines (case-insensitive where needed).
 */
const SIGNATURE_MARKERS = [
  'PH\u1EE4 L\u1EE4C',        // PHU LUC
  'CH\u1EE6 T\u1ECACH',        // CHU TICH
  'TM.',                        // TM. (Thay mat)
  'N\u01A0I NH\u1EACN:',      // NOI NHAN:
  'KT.',                        // KT. (Ky thay)
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Numeric priority for each level (lower = higher in hierarchy). */
const LEVEL_PRIORITY: Record<SectionLevel, number> = {
  DIEU: 0,
  ROMAN: 1,
  ARABIC: 2,
  LETTER: 3,
  DASH: 4,
};

interface MatchResult {
  level: SectionLevel;
  sectionNumber: string;
  text: string;
}

/**
 * Attempt to match a trimmed line against every pattern.
 * Returns the first match or null.
 *
 * Pattern order matters: DIEU is tested first (most specific), then ROMAN
 * before ARABIC because a bare roman numeral like "I." would also match
 * the arabic pattern if tested later (it would not -- "I" is not \d+, but
 * we keep ROMAN before ARABIC as a safeguard and for clarity).
 */
function matchLine(trimmed: string): MatchResult | null {
  // Dieu
  let m = RE_DIEU.exec(trimmed);
  if (m) {
    return { level: 'DIEU', sectionNumber: m[1], text: m[2] };
  }

  // Roman -- test before Arabic so "IV. ..." is not accidentally matched
  // as arabic (it wouldn't since "IV" is not \d+, but clarity is good).
  m = RE_ROMAN.exec(trimmed);
  if (m && m[1] !== '') {
    // RE_ROMAN can match empty string for group 1 when there's nothing before the dot.
    // Guard against that edge case.
    return { level: 'ROMAN', sectionNumber: m[1], text: m[2] };
  }

  // Arabic
  m = RE_ARABIC.exec(trimmed);
  if (m) {
    return { level: 'ARABIC', sectionNumber: m[1], text: m[2] };
  }

  // Letter
  m = RE_LETTER.exec(trimmed);
  if (m) {
    return { level: 'LETTER', sectionNumber: m[1], text: m[2] };
  }

  // Dash
  m = RE_DASH.exec(trimmed);
  if (m) {
    return { level: 'DASH', sectionNumber: '', text: m[1] };
  }

  return null;
}

/**
 * Append text to a section's contentVi, adding a newline separator
 * if there is already existing content.
 */
function appendContent(section: ParsedSection, text: string): void {
  if (section.contentVi.length > 0) {
    section.contentVi += '\n' + text;
  } else {
    section.contentVi = text;
  }
}

/**
 * Create a fresh ParsedSection node.
 */
function createSection(
  level: SectionLevel,
  sectionNumber: string,
  text: string,
  sortOrder: number,
): ParsedSection {
  return {
    level,
    sectionNumber,
    titleVi: level === 'DASH' ? null : text,
    contentVi: '',
    sortOrder,
    children: [],
  };
}

// ---------------------------------------------------------------------------
// Main parser
// ---------------------------------------------------------------------------

/**
 * Parse the plain-text content of a Vietnamese government plan document
 * into a structured tree of sections.
 *
 * @param text - The full document text (UTF-8).
 * @returns A ParsedDocument with preamble, hierarchical sections, and signature block.
 */
export function parseStructure(text: string): ParsedDocument {
  const lines = text.split('\n');

  // ------------------------------------------------------------------
  // Phase 1: Identify preamble boundary
  // ------------------------------------------------------------------

  let preambleEndIndex = -1; // line index (exclusive) for preamble content

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();

    // Check for explicit preamble-end markers (QUYET NGHI: / QUYET DINH:)
    for (const marker of PREAMBLE_END_MARKERS) {
      if (trimmed.toUpperCase().includes(marker)) {
        // Include the marker line itself in the preamble
        preambleEndIndex = i + 1;
        break;
      }
    }
    if (preambleEndIndex !== -1) break;

    // If we hit the first "Dieu" before any marker, the preamble ends here
    if (RE_DIEU.test(trimmed)) {
      preambleEndIndex = i;
      break;
    }
  }

  // If no preamble boundary was found, treat everything as sections (no preamble)
  if (preambleEndIndex === -1) {
    preambleEndIndex = 0;
  }

  const preamble = lines
    .slice(0, preambleEndIndex)
    .join('\n')
    .trim();

  // ------------------------------------------------------------------
  // Phase 2: Identify signature block boundary (scan from end)
  // ------------------------------------------------------------------

  let signatureStartIndex = lines.length; // line index where signature block begins

  // Walk backward from the end looking for the last Dieu to set a floor,
  // then scan forward from there for signature markers.
  let lastDieuLine = -1;
  for (let i = lines.length - 1; i >= preambleEndIndex; i--) {
    if (RE_DIEU.test(lines[i].trim())) {
      lastDieuLine = i;
      break;
    }
  }

  if (lastDieuLine !== -1) {
    // Scan forward from after the last Dieu looking for signature markers
    for (let i = lastDieuLine + 1; i < lines.length; i++) {
      const upper = lines[i].trim().toUpperCase();
      if (upper.length === 0) continue;

      // Check if this line starts with any signature marker
      const isSignatureLine = SIGNATURE_MARKERS.some((marker) =>
        upper.startsWith(marker),
      );

      if (isSignatureLine) {
        signatureStartIndex = i;
        break;
      }
    }
  }

  const signatureBlock = lines
    .slice(signatureStartIndex)
    .join('\n')
    .trim();

  // ------------------------------------------------------------------
  // Phase 3: Parse sections between preamble and signature block
  // ------------------------------------------------------------------

  const contentLines = lines.slice(preambleEndIndex, signatureStartIndex);

  const rootSections: ParsedSection[] = [];

  /**
   * Stack tracks the current nesting path.
   * Each element is a ParsedSection that is currently "open" (accepting children
   * or content). The stack is ordered from highest level (index 0 = DIEU) to
   * lowest (e.g. index 3 = DASH).
   */
  const stack: ParsedSection[] = [];

  /** Global counter for sortOrder across the whole document. */
  let sortCounter = 0;

  /**
   * Return the innermost (deepest) currently-open section, or null.
   */
  function currentSection(): ParsedSection | null {
    return stack.length > 0 ? stack[stack.length - 1] : null;
  }

  /**
   * Close sections on the stack until the top of the stack has a strictly
   * higher priority (lower LEVEL_PRIORITY number) than `level`, or the
   * stack is empty. This implements rule 4: "A new section at the same or
   * higher level closes the previous section."
   */
  function closeUntilParentFor(level: SectionLevel): void {
    const newPriority = LEVEL_PRIORITY[level];
    while (stack.length > 0) {
      const topPriority = LEVEL_PRIORITY[stack[stack.length - 1].level];
      if (topPriority < newPriority) {
        // The top of the stack is a strictly higher-level section -- it
        // becomes the parent for the new section.
        break;
      }
      // Pop: the section is already attached to its parent's children array
      // (or rootSections), so we just remove it from the stack.
      stack.pop();
    }
  }

  for (const line of contentLines) {
    const trimmed = line.trim();

    // Skip completely empty lines (rule 7)
    if (trimmed.length === 0) {
      continue;
    }

    const match = matchLine(trimmed);

    if (match) {
      // --- New section detected ---
      closeUntilParentFor(match.level);

      const section = createSection(
        match.level,
        match.sectionNumber,
        match.text,
        sortCounter++,
      );

      // For DASH items, the matched text IS the content (no separate title)
      if (match.level === 'DASH') {
        section.contentVi = match.text;
      }

      const parent = currentSection();
      if (parent) {
        parent.children.push(section);
      } else {
        rootSections.push(section);
      }

      stack.push(section);
    } else {
      // --- Continuation text (belongs to current section's contentVi) ---
      const cur = currentSection();
      if (cur) {
        appendContent(cur, trimmed);
      }
      // If there is no current section, the line is orphan text between
      // preamble and the first structured section -- we silently skip it,
      // as this scenario should be rare given proper preamble detection.
    }
  }

  return {
    preamble,
    sections: rootSections,
    signatureBlock,
  };
}

// ---------------------------------------------------------------------------
// Utility: flatten the tree for debugging / inspection
// ---------------------------------------------------------------------------

/**
 * Flatten the parsed section tree into a single array with depth info.
 * Useful for debugging and quick inspection.
 */
export function flattenSections(
  sections: ParsedSection[],
  depth = 0,
): Array<ParsedSection & { depth: number }> {
  const result: Array<ParsedSection & { depth: number }> = [];
  for (const s of sections) {
    result.push({ ...s, depth, children: s.children });
    if (s.children.length > 0) {
      result.push(...flattenSections(s.children, depth + 1));
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Utility: pretty-print for CLI debugging
// ---------------------------------------------------------------------------

/**
 * Return a human-readable indented representation of the parse tree.
 */
export function prettyPrint(doc: ParsedDocument): string {
  const lines: string[] = [];

  if (doc.preamble) {
    lines.push('=== PREAMBLE ===');
    lines.push(doc.preamble.substring(0, 200) + (doc.preamble.length > 200 ? '...' : ''));
    lines.push('');
  }

  function printSection(s: ParsedSection, indent: number): void {
    const pad = '  '.repeat(indent);
    const num = s.sectionNumber ? ` ${s.sectionNumber}` : '';
    const title = s.titleVi ? ` - ${s.titleVi}` : '';
    const contentPreview =
      s.contentVi.length > 0
        ? ` [${s.contentVi.length} chars]`
        : '';

    lines.push(`${pad}[${s.level}${num}]${title}${contentPreview}`);

    for (const child of s.children) {
      printSection(child, indent + 1);
    }
  }

  lines.push('=== SECTIONS ===');
  for (const s of doc.sections) {
    printSection(s, 0);
  }

  if (doc.signatureBlock) {
    lines.push('');
    lines.push('=== SIGNATURE BLOCK ===');
    lines.push(
      doc.signatureBlock.substring(0, 200) +
        (doc.signatureBlock.length > 200 ? '...' : ''),
    );
  }

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// CLI entry point: run directly with `tsx scripts/parsing/parse-structure.ts <file>`
// ---------------------------------------------------------------------------

function runCli(): void {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const fs = require('fs') as typeof import('fs');
  const filePath = process.argv[2];

  if (!filePath) {
    console.error('Usage: tsx scripts/parsing/parse-structure.ts <path-to-document.txt>');
    process.exit(1);
  }

  const text = fs.readFileSync(filePath, 'utf-8');
  const doc = parseStructure(text);

  console.log(prettyPrint(doc));
  console.log('\n--- Stats ---');
  console.log(`Preamble: ${doc.preamble.length} chars`);
  console.log(`Top-level sections: ${doc.sections.length}`);
  console.log(`Signature block: ${doc.signatureBlock.length} chars`);

  const flat = flattenSections(doc.sections);
  console.log(`Total sections (flat): ${flat.length}`);

  const byLevel = flat.reduce(
    (acc, s) => {
      acc[s.level] = (acc[s.level] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );
  console.log('By level:', byLevel);
}

if (typeof process !== 'undefined' && process.argv[1]?.includes('parse-structure')) {
  runCli();
}
