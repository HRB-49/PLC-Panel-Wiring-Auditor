import type { ParsedCsv } from './types';

// Minimal RFC-4180-ish CSV parser: handles quoted fields, escaped quotes, CRLF.
function parseLine(text: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ',') {
      fields.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  fields.push(current);
  return fields.map((f) => f.trim());
}

// Split into records while respecting quoted newlines.
function splitRecords(text: string): string[] {
  const records: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (inQuotes) {
      current += char;
      if (char === '"') {
        if (text[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      }
    } else if (char === '"') {
      inQuotes = true;
      current += char;
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[i + 1] === '\n') i++;
      records.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  if (current.trim() !== '') records.push(current);
  return records;
}

// Score how "header-like" a parsed row is. A real header row has many short,
// non-empty, distinct text values (column names). A title/preamble row is
// usually one long string with mostly empty cells. Higher score = more header-like.
function headerScore(fields: string[]): number {
  const nonEmpty = fields.filter((f) => f.trim() !== '');
  if (nonEmpty.length === 0) return -Infinity;

  // Distinct non-empty values (case-insensitive)
  const seen = new Set<string>();
  let distinct = 0;
  for (const f of nonEmpty) {
    const key = f.trim().toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      distinct++;
    }
  }

  // Fraction of cells that are non-empty
  const fillRatio = nonEmpty.length / fields.length;
  // Fraction of non-empty cells that are distinct
  const distinctRatio = distinct / nonEmpty.length;
  // Header cells are short. Penalize long title strings.
  const avgLen =
    nonEmpty.reduce((sum, f) => sum + f.trim().length, 0) / nonEmpty.length;
  const lengthPenalty = avgLen > 32 ? (avgLen - 32) * 0.5 : 0;

  return fillRatio * 2 + distinctRatio * 2 - lengthPenalty;
}

// Scan the first few rows to find the real header row: the row with the highest
// headerScore among the first `maxScan` rows. Falls back to row 1 if all rows
// score equally (e.g. a single-row file).
function detectHeaderRow(records: string[][], maxScan = 5): number {
  const limit = Math.min(maxScan, records.length);
  let bestIdx = 0;
  let bestScore = -Infinity;
  for (let i = 0; i < limit; i++) {
    const score = headerScore(records[i]);
    if (score > bestScore) {
      bestScore = score;
      bestIdx = i;
    }
  }
  return bestIdx;
}

export function parseCsv(text: string): ParsedCsv {
  const normalized = text.replace(/^\uFEFF/, '');
  const records = splitRecords(normalized).filter((r) => r.trim() !== '');
  if (records.length === 0) {
    return { headers: [], rows: [], rowCount: 0, headerRowNumber: 0, preambleRows: [] };
  }

  const parsedRecords = records.map((r) => parseLine(r));
  const headerIdx = detectHeaderRow(parsedRecords);
  const headers = parsedRecords[headerIdx];
  const preambleRows = parsedRecords.slice(0, headerIdx);
  const dataRecords = parsedRecords.slice(headerIdx + 1);

  const rows = dataRecords.map((r) => {
    const fields = r.slice();
    // pad/truncate to header length so the table stays rectangular
    while (fields.length < headers.length) fields.push('');
    return fields.slice(0, headers.length);
  });

  return {
    headers,
    rows,
    rowCount: rows.length,
    headerRowNumber: headerIdx + 1, // 1-based line number in source file
    preambleRows,
  };
}

// Flexible column matching: normalize and fuzzy-find a header that looks like
// one of the expected wiring-list column names.
const ALIASES: Record<string, string[]> = {
  terminal: ['terminal', 'terminalnumber', 'term', 'termno', 'terminalno', 'terminalnum'],
  wireTag: ['wiretag', 'wire', 'tag', 'wirenumber', 'wireno', 'wireid', 'cable', 'cabletag'],
  description: ['description', 'desc', 'function', 'signal', 'remark', 'notes', 'note'],
  panel: ['panel', 'panelreference', 'panelref', 'reference', 'ref', 'location', 'cubicle'],
};

function normalizeHeader(h: string): string {
  return h.toLowerCase().replace(/[^a-z0-9]/g, '');
}

export function findColumn(
  headers: string[],
  key: keyof typeof ALIASES
): string | undefined {
  const aliases = ALIASES[key];
  const normalized = headers.map(normalizeHeader);
  for (const alias of aliases) {
    const idx = normalized.indexOf(alias);
    if (idx !== -1) return headers[idx];
  }
  for (const alias of aliases) {
    const idx = normalized.findIndex((h) => h.includes(alias));
    if (idx !== -1) return headers[idx];
  }
  return undefined;
}

export function toCsv(issues: { row: number; severity: string; issueType: string; explanation: string }[]): string {
  const escape = (v: string) => {
    const needs = v.includes(',') || v.includes('"') || v.includes('\n');
    return needs ? `"${v.replace(/"/g, '""')}"` : v;
  };
  const header = ['Row', 'Severity', 'Issue Type', 'Explanation'].join(',');
  const body = issues
    .map((i) => [String(i.row), i.severity, i.issueType, i.explanation].map(escape).join(','))
    .join('\n');
  return `${header}\n${body}`;
}
