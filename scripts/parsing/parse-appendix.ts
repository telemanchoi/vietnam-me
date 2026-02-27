/**
 * Appendix (Phu luc) parser for Vietnamese government plan documents.
 *
 * Vietnamese plans typically end with one or more appendices ("PHU LUC")
 * placed after the signature block. Each appendix contains a title, an
 * optional reference to the parent resolution, and a data table (project
 * lists, indicator tables, route tables, etc.).
 *
 * Two entry points are exported:
 *  - parseAppendices(text)         – for plain-text input (PDF via pdf-parse)
 *  - parseAppendicesFromHtml(html) – for HTML input (DOC/DOCX via mammoth)
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AppendixType =
  | "PROJECT_LIST"
  | "MAP_LIST"
  | "INDICATOR_TABLE"
  | "ROUTE_TABLE"
  | "FACILITY_LIST"
  | "MIXED";

export interface ParsedAppendixRow {
  rowNumber: number;
  data: Record<string, unknown>;
  sortOrder: number;
}

export interface ParsedAppendix {
  appendixNumber: number;
  titleVi: string;
  appendixType: AppendixType;
  columns: string[];
  rows: ParsedAppendixRow[];
  sortOrder: number;
}

// ---------------------------------------------------------------------------
// Constants & keyword maps for appendix-type classification
// ---------------------------------------------------------------------------

/**
 * Keywords used to classify an appendix by its title and content.
 * Each entry maps a keyword (lowercased, no diacritics) to its type.
 * Order matters: the first match wins, so more specific entries come first.
 */
const TYPE_KEYWORDS: Array<{ keywords: string[]; type: AppendixType }> = [
  {
    keywords: ["ban do", "bản đồ"],
    type: "MAP_LIST",
  },
  {
    keywords: ["chi tieu", "chỉ tiêu", "chi so", "chỉ số"],
    type: "INDICATOR_TABLE",
  },
  {
    keywords: ["tuyen", "tuyến", "duong", "đường"],
    type: "ROUTE_TABLE",
  },
  {
    keywords: ["co so", "cơ sở", "thiet che", "thiết chế"],
    type: "FACILITY_LIST",
  },
  {
    keywords: ["du an", "dự án", "danh muc", "danh mục"],
    type: "PROJECT_LIST",
  },
];

// ---------------------------------------------------------------------------
// Vietnamese text helpers
// ---------------------------------------------------------------------------

/**
 * Strip Vietnamese diacritical marks so keyword matching is more robust.
 * This covers the common Unicode combining sequences used in Vietnamese.
 */
function removeDiacritics(text: string): string {
  return text.normalize("NFD").replace(/[\u0300-\u036f\u0301-\u0323]/g, "");
}

/**
 * Classify appendix type from its title (and optionally its body text).
 */
function classifyAppendixType(title: string, bodyHint?: string): AppendixType {
  const normalised = removeDiacritics(`${title} ${bodyHint ?? ""}`).toLowerCase();

  for (const entry of TYPE_KEYWORDS) {
    for (const kw of entry.keywords) {
      if (normalised.includes(removeDiacritics(kw).toLowerCase())) {
        return entry.type;
      }
    }
  }

  return "MIXED";
}

// ---------------------------------------------------------------------------
// Plain-text parsing helpers
// ---------------------------------------------------------------------------

/**
 * Regex that matches the start of an appendix section.
 *
 * Patterns recognised:
 *   PHU LUC I        (Roman numeral)
 *   PHU LUC 1        (Arabic numeral)
 *   PHU LUC          (single / unnumbered appendix)
 *   PHU LUC A, B...  (letter-numbered)
 *
 * The regex is case-insensitive and allows optional leading whitespace /
 * newlines. The Vietnamese text uses upper-case by convention.
 */
const APPENDIX_HEADER_RE =
  /(?:^|\n)\s*(PH[UỤ]\s*L[UỤ]C)\s*(?:([IVXLCDM]+|[0-9]+|[A-Z])(?:\s*[.:]\s*|\s+))?/gi;

/**
 * Roman numeral → integer (supports I..L which is sufficient for Vietnamese plans).
 */
function romanToInt(roman: string): number {
  const map: Record<string, number> = {
    I: 1,
    V: 5,
    X: 10,
    L: 50,
    C: 100,
    D: 500,
    M: 1000,
  };
  let total = 0;
  for (let i = 0; i < roman.length; i++) {
    const current = map[roman[i]] ?? 0;
    const next = map[roman[i + 1]] ?? 0;
    total += current < next ? -current : current;
  }
  return total;
}

/**
 * Parse an appendix identifier (Roman numeral, Arabic number, or letter) into
 * a numeric appendix number.
 */
function parseAppendixNumber(id: string | undefined, fallback: number): number {
  if (!id) return fallback;

  // Arabic numeral
  const asInt = parseInt(id, 10);
  if (!isNaN(asInt)) return asInt;

  // Roman numeral
  if (/^[IVXLCDM]+$/i.test(id)) {
    return romanToInt(id.toUpperCase());
  }

  // Single letter: A=1, B=2, ...
  if (/^[A-Z]$/i.test(id)) {
    return id.toUpperCase().charCodeAt(0) - 64; // 'A' = 1
  }

  return fallback;
}

// ---------------------------------------------------------------------------
// Table detection in plain text
// ---------------------------------------------------------------------------

/**
 * Heuristic: detect whether a line is a table row.
 *
 * After PDF extraction tables often become lines where columns are separated
 * by 2+ spaces, tabs, or pipe characters. We also detect markdown-style
 * separator lines (|---|---|).
 */
function isLikelyTableRow(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return false;

  // Pipe-delimited
  if (trimmed.includes("|")) return true;

  // Tab-delimited
  if (trimmed.includes("\t")) return true;

  // Two or more groups of 2+ whitespace characters (space-aligned columns)
  const gapCount = (trimmed.match(/\s{2,}/g) ?? []).length;
  return gapCount >= 1;
}

/**
 * Detect if a line is a markdown/text table separator (e.g., |---|---|).
 */
function isTableSeparator(line: string): boolean {
  return /^[\s|+\-:=]+$/.test(line.trim()) && line.trim().length > 2;
}

/**
 * Split a text line into cells using the dominant delimiter found.
 */
function splitTableRow(line: string): string[] {
  const trimmed = line.trim();

  // Pipe-delimited (markdown-style)
  if (trimmed.includes("|")) {
    return trimmed
      .split("|")
      .map((cell) => cell.trim())
      .filter((_, i, arr) => {
        // Remove empty leading/trailing cells from |col1|col2| patterns
        if (i === 0 && arr[i] === "") return false;
        if (i === arr.length - 1 && arr[i] === "") return false;
        return true;
      });
  }

  // Tab-delimited
  if (trimmed.includes("\t")) {
    return trimmed.split("\t").map((cell) => cell.trim());
  }

  // Space-aligned columns: split on 2+ consecutive spaces
  return trimmed.split(/\s{2,}/).map((cell) => cell.trim());
}

// ---------------------------------------------------------------------------
// Core: extract title lines following the PHU LUC marker
// ---------------------------------------------------------------------------

/**
 * Gather the title block that immediately follows a PHU LUC header.
 *
 * The title typically spans 1-3 lines in UPPER CASE, followed by a
 * parenthetical reference to the parent resolution. We keep collecting
 * lines until we hit an empty line or a line that looks like a table row.
 */
function extractTitleBlock(lines: string[], startIdx: number): {
  titleVi: string;
  endIdx: number;
} {
  const titleParts: string[] = [];
  let idx = startIdx;

  while (idx < lines.length) {
    const line = lines[idx].trim();

    // Stop on blank line after we have captured at least one title line
    if (!line && titleParts.length > 0) break;

    // Stop if the line looks like a table row (starts with a number or |)
    if (titleParts.length > 0 && isLikelyTableRow(line) && /^\d|^\|/.test(line)) {
      break;
    }

    // Skip fully blank lines before the title starts
    if (!line) {
      idx++;
      continue;
    }

    titleParts.push(line);
    idx++;

    // If we already captured a parenthetical reference, stop
    if (/\)$/.test(line)) break;

    // Safety: don't consume more than 6 lines as title
    if (titleParts.length >= 6) break;
  }

  return {
    titleVi: titleParts.join(" ").replace(/\s+/g, " ").trim(),
    endIdx: idx,
  };
}

// ---------------------------------------------------------------------------
// Core: parse a table block from plain text lines
// ---------------------------------------------------------------------------

interface TextTableResult {
  columns: string[];
  rows: ParsedAppendixRow[];
}

/**
 * Parse a block of text lines that represent a table into structured columns
 * and rows.
 *
 * Strategy:
 * 1. Find the first line that looks like a header row (often the first
 *    table-like line, or preceded by a separator line).
 * 2. Use that line to derive column names.
 * 3. Parse subsequent lines as data rows, mapping cells to column names.
 */
function parseTextTable(lines: string[]): TextTableResult {
  // Filter to only lines that look like table rows
  const tableLines: string[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (isTableSeparator(trimmed)) continue;
    if (isLikelyTableRow(trimmed)) {
      tableLines.push(trimmed);
    }
  }

  if (tableLines.length === 0) {
    return { columns: [], rows: [] };
  }

  // First table line is the header
  const headerCells = splitTableRow(tableLines[0]);
  const columns = headerCells.map((h) => h || `Column_${headerCells.indexOf(h) + 1}`);

  // Remaining lines are data rows
  const rows: ParsedAppendixRow[] = [];
  let rowNumber = 1;

  for (let i = 1; i < tableLines.length; i++) {
    const cells = splitTableRow(tableLines[i]);
    if (cells.length === 0) continue;

    // Skip lines that look like sub-headers or separators
    if (cells.every((c) => !c || isTableSeparator(c))) continue;

    const data: Record<string, unknown> = {};
    for (let j = 0; j < columns.length; j++) {
      const value = cells[j] ?? "";
      // Attempt numeric conversion for cells that look like numbers
      const numericValue = parseVietnameseNumber(value);
      data[columns[j]] = numericValue !== null ? numericValue : value;
    }

    // Include any extra cells beyond the column count
    if (cells.length > columns.length) {
      for (let j = columns.length; j < cells.length; j++) {
        data[`Extra_${j + 1}`] = cells[j];
      }
    }

    rows.push({
      rowNumber,
      data,
      sortOrder: rowNumber,
    });
    rowNumber++;
  }

  return { columns, rows };
}

/**
 * Try to parse a Vietnamese-formatted number string.
 * Vietnamese uses dot as thousand separator and comma as decimal separator
 * (e.g., "1.234,56" means 1234.56).
 *
 * Returns null if the string is not a recognisable number.
 */
function parseVietnameseNumber(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  // Pure integer or float (no thousand separators)
  if (/^-?\d+$/.test(trimmed)) return parseInt(trimmed, 10);

  // Vietnamese format: 1.234.567 or 1.234,56
  if (/^-?\d{1,3}(\.\d{3})*(,\d+)?$/.test(trimmed)) {
    const normalised = trimmed.replace(/\./g, "").replace(",", ".");
    const num = parseFloat(normalised);
    return isNaN(num) ? null : num;
  }

  // International format: 1,234,567 or 1,234.56
  if (/^-?\d{1,3}(,\d{3})*(\.\d+)?$/.test(trimmed)) {
    const normalised = trimmed.replace(/,/g, "");
    const num = parseFloat(normalised);
    return isNaN(num) ? null : num;
  }

  return null;
}

// ---------------------------------------------------------------------------
// Plain-text entry point
// ---------------------------------------------------------------------------

/**
 * Parse appendix sections from a plain-text document (typically from
 * pdf-parse output).
 *
 * @param text - Full document text. Appendices are expected after the
 *   signature block, starting with "PHU LUC" markers.
 * @returns Parsed appendix array (may be empty if no appendices found).
 */
export function parseAppendices(text: string): ParsedAppendix[] {
  const results: ParsedAppendix[] = [];

  // Find all PHU LUC headers
  const matches: Array<{ index: number; id?: string }> = [];
  let match: RegExpExecArray | null;

  // Reset regex state
  APPENDIX_HEADER_RE.lastIndex = 0;

  while ((match = APPENDIX_HEADER_RE.exec(text)) !== null) {
    matches.push({
      index: match.index,
      id: match[2]?.trim(),
    });
  }

  if (matches.length === 0) {
    return results;
  }

  for (let mi = 0; mi < matches.length; mi++) {
    const headerMatch = matches[mi];
    const nextMatchIndex = mi < matches.length - 1 ? matches[mi + 1].index : text.length;

    // Slice the document text for this appendix
    const sectionText = text.slice(headerMatch.index, nextMatchIndex);
    const sectionLines = sectionText.split("\n");

    // Skip the header line itself
    let lineIdx = 1;

    // Extract title
    const { titleVi, endIdx } = extractTitleBlock(sectionLines, lineIdx);
    lineIdx = endIdx;

    // Everything after the title block is the table body
    const bodyLines = sectionLines.slice(lineIdx);

    // Parse table
    const { columns, rows } = parseTextTable(bodyLines);

    // Classify type
    const appendixNumber = parseAppendixNumber(headerMatch.id, mi + 1);
    const bodyHint = bodyLines.slice(0, 5).join(" ");
    const appendixType = classifyAppendixType(titleVi, bodyHint);

    results.push({
      appendixNumber,
      titleVi: titleVi || `Phu luc ${appendixNumber}`,
      appendixType,
      columns,
      rows,
      sortOrder: mi + 1,
    });
  }

  return results;
}

// ---------------------------------------------------------------------------
// HTML parsing helpers
// ---------------------------------------------------------------------------

/**
 * Minimal HTML tag stripper. Extracts inner text from an HTML string,
 * collapsing whitespace.
 */
function stripHtmlTags(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Parse a single <table> HTML string into columns and rows.
 */
function parseHtmlTable(tableHtml: string): TextTableResult {
  // Extract all rows (<tr> elements)
  const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  const rowMatches: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = rowRegex.exec(tableHtml)) !== null) {
    rowMatches.push(m[1]);
  }

  if (rowMatches.length === 0) {
    return { columns: [], rows: [] };
  }

  // Parse cells from each row
  const cellRegex = /<(?:td|th)[^>]*>([\s\S]*?)<\/(?:td|th)>/gi;

  function extractCells(rowHtml: string): string[] {
    const cells: string[] = [];
    let cm: RegExpExecArray | null;
    cellRegex.lastIndex = 0;
    while ((cm = cellRegex.exec(rowHtml)) !== null) {
      cells.push(stripHtmlTags(cm[1]));
    }
    return cells;
  }

  // Determine header row: use <th> if present in first row, else treat
  // the first <tr> as the header
  const firstRowCells = extractCells(rowMatches[0]);
  const hasThTags = /<th[\s>]/i.test(rowMatches[0]);

  let columns: string[];
  let dataStartIdx: number;

  if (hasThTags || rowMatches.length > 1) {
    columns = firstRowCells.map(
      (h, i) => h || `Column_${i + 1}`,
    );
    dataStartIdx = 1;
  } else {
    // Single-row table — treat as data with generic column names
    columns = firstRowCells.map((_, i) => `Column_${i + 1}`);
    dataStartIdx = 0;
  }

  // Parse data rows
  const rows: ParsedAppendixRow[] = [];
  let rowNumber = 1;

  for (let i = dataStartIdx; i < rowMatches.length; i++) {
    const cells = extractCells(rowMatches[i]);
    if (cells.length === 0) continue;

    // Skip rows that are purely empty
    if (cells.every((c) => !c)) continue;

    const data: Record<string, unknown> = {};
    for (let j = 0; j < columns.length; j++) {
      const value = cells[j] ?? "";
      const numericValue = parseVietnameseNumber(value);
      data[columns[j]] = numericValue !== null ? numericValue : value;
    }

    // Extra cells beyond column count
    if (cells.length > columns.length) {
      for (let j = columns.length; j < cells.length; j++) {
        data[`Extra_${j + 1}`] = cells[j];
      }
    }

    rows.push({
      rowNumber,
      data,
      sortOrder: rowNumber,
    });
    rowNumber++;
  }

  return { columns, rows };
}

// ---------------------------------------------------------------------------
// HTML entry point
// ---------------------------------------------------------------------------

/**
 * Parse appendix sections from HTML output (typically from mammoth
 * convertToHtml).
 *
 * This approach is more reliable for table extraction because mammoth
 * preserves <table> structure from DOC/DOCX files.
 *
 * @param html - Full HTML string from mammoth.convertToHtml().
 * @returns Parsed appendix array.
 */
export function parseAppendicesFromHtml(html: string): ParsedAppendix[] {
  const results: ParsedAppendix[] = [];

  // Strategy: find PHU LUC sections in the HTML, then locate the <table>
  // elements that belong to each section.

  // First, locate all PHU LUC headers
  const headerRe =
    /PH[UỤ]\s*L[UỤ]C\s*(?:([IVXLCDM]+|[0-9]+|[A-Z])(?:\s*[.:]\s*|\s+))?/gi;
  const headers: Array<{ index: number; id?: string }> = [];
  let hm: RegExpExecArray | null;
  while ((hm = headerRe.exec(html)) !== null) {
    headers.push({ index: hm.index, id: hm[1]?.trim() });
  }

  // If no PHU LUC headers at all, check if there are tables that might be
  // appendix tables (after the main document body)
  if (headers.length === 0) {
    return results;
  }

  // Extract all tables and their positions
  const tablePositions: Array<{ index: number; html: string }> = [];
  const tableRe = /<table[^>]*>([\s\S]*?)<\/table>/gi;
  let tm: RegExpExecArray | null;
  while ((tm = tableRe.exec(html)) !== null) {
    tablePositions.push({ index: tm.index, html: tm[0] });
  }

  // For each PHU LUC header, find the table(s) that belong to it
  for (let hi = 0; hi < headers.length; hi++) {
    const header = headers[hi];
    const nextHeaderIndex =
      hi < headers.length - 1 ? headers[hi + 1].index : html.length;

    // Find tables between this header and the next one
    const sectionTables = tablePositions.filter(
      (t) => t.index > header.index && t.index < nextHeaderIndex,
    );

    // Extract the title text between the header and the first table
    const titleEndIndex =
      sectionTables.length > 0 ? sectionTables[0].index : nextHeaderIndex;
    const titleHtml = html.slice(
      header.index,
      Math.min(titleEndIndex, header.index + 2000),
    );
    const titleText = stripHtmlTags(titleHtml)
      // Remove the PHU LUC header itself from the title
      .replace(/^PH[UỤ]\s*L[UỤ]C\s*(?:[IVXLCDM]+|[0-9]+|[A-Z])?\s*[.:]*\s*/i, "")
      .replace(/\s+/g, " ")
      .trim();

    // Merge all tables in this section into one appendix
    // (Most appendices have a single table, but some span multiple tables)
    let mergedColumns: string[] = [];
    let mergedRows: ParsedAppendixRow[] = [];

    for (const table of sectionTables) {
      const { columns, rows } = parseHtmlTable(table.html);

      if (mergedColumns.length === 0) {
        mergedColumns = columns;
        mergedRows = rows;
      } else if (
        columns.length === mergedColumns.length &&
        columns.every((c, i) => c === mergedColumns[i])
      ) {
        // Same columns — append rows (continuation table)
        const offset = mergedRows.length;
        for (const row of rows) {
          mergedRows.push({
            ...row,
            rowNumber: row.rowNumber + offset,
            sortOrder: row.sortOrder + offset,
          });
        }
      } else {
        // Different column structure — treat as separate table within
        // the same appendix. Store with prefixed column names.
        // For simplicity, just append with the first table's columns.
        const offset = mergedRows.length;
        for (const row of rows) {
          mergedRows.push({
            ...row,
            rowNumber: row.rowNumber + offset,
            sortOrder: row.sortOrder + offset,
          });
        }
      }
    }

    const appendixNumber = parseAppendixNumber(header.id, hi + 1);
    const appendixType = classifyAppendixType(
      titleText,
      mergedRows
        .slice(0, 3)
        .map((r) => Object.values(r.data).join(" "))
        .join(" "),
    );

    results.push({
      appendixNumber,
      titleVi: titleText || `Phu luc ${appendixNumber}`,
      appendixType,
      columns: mergedColumns,
      rows: mergedRows,
      sortOrder: hi + 1,
    });
  }

  return results;
}
