import type { AuditIssue, Severity } from './types';

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const ANALYSIS_MODEL = 'llama-3.1-8b-instant';
const SUMMARY_MODEL = 'llama-3.3-70b-versatile';
const MODEL = ANALYSIS_MODEL;
const CHUNK_SIZE = 20;
const INTER_CHUNK_DELAY_MS = 5000;
const RATE_LIMIT_RETRY_DELAY_MS = 15000;

const SYSTEM_PROMPT =
  'You are an expert industrial automation QA auditor reviewing PLC panel wiring/termination lists. Given the following termination list data, identify issues such as: duplicate terminal or address numbers, missing or blank descriptions/wire tags, inconsistent naming conventions across similar entries, and any other data quality anomalies an experienced panel engineer would flag. For each issue found, respond with a JSON array where each item has: row (the row number), severity (CRITICAL, WARNING, or INFO), issueType (short label), and explanation (one sentence). Only flag genuine issues — do not invent problems in clean data. Respond with ONLY the JSON array, nothing else.';

const SUMMARY_PROMPT =
  'You are an expert industrial automation QA auditor. Given a list of issues found in a PLC panel wiring/termination list, write a concise executive summary in Markdown. Use clear headings (##), short paragraphs, and bullet lists where helpful. Cover: the overall data quality, the most critical findings, recurring patterns, and recommended next steps. Keep it under 300 words. Respond with ONLY the Markdown.';

const VALID_SEVERITIES: Severity[] = ['CRITICAL', 'WARNING', 'INFO'];

interface GroqChoice {
  message?: { content?: string };
}

interface GroqResponse {
  choices?: GroqChoice[];
}

class RateLimitError extends Error {
  constructor() {
    super('Groq API rate limit exceeded (429).');
    this.name = 'RateLimitError';
  }
}

export interface AnalyzeProgress {
  phase: 'analyzing' | 'summarizing' | 'done';
  done: number;
  total: number;
  startRow: number;
  endRow: number;
  totalRows: number;
}

function getApiKey(): string {
  const key = process.env.GROQ_API_KEY;
  if (!key) {
    throw new Error(
      'GROQ_API_KEY is not set. Add it to the environment before running an audit.'
    );
  }
  return key;
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(timer);
        reject(new DOMException('Aborted', 'AbortError'));
      },
      { once: true }
    );
  });
}

// Strip markdown code fences and surrounding prose to extract a JSON array.
function extractJsonArray(text: string): string {
  let t = text.trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) t = fence[1].trim();
  const start = t.indexOf('[');
  const end = t.lastIndexOf(']');
  if (start !== -1 && end !== -1 && end > start) {
    t = t.slice(start, end + 1);
  }
  return t;
}

function parseIssues(jsonText: string): AuditIssue[] {
  const text = extractJsonArray(jsonText);
  const parsed = JSON.parse(text);
  if (!Array.isArray(parsed)) {
    throw new Error('AI response was not a JSON array.');
  }
  return parsed
    .map((item: unknown): AuditIssue | null => {
      if (typeof item !== 'object' || item === null) return null;
      const obj = item as Record<string, unknown>;
      const row = Number(obj.row);
      const severity = String(obj.severity ?? '').toUpperCase() as Severity;
      const issueType = String(obj.issueType ?? '').trim();
      const explanation = String(obj.explanation ?? '').trim();
      if (
        !Number.isFinite(row) ||
        row < 1 ||
        !VALID_SEVERITIES.includes(severity) ||
        !issueType ||
        !explanation
      ) {
        return null;
      }
      return { row: Math.round(row), severity, issueType, explanation };
    })
    .filter((x): x is AuditIssue => x !== null);
}

async function callGroq(
  apiKey: string,
  userContent: string,
  signal?: AbortSignal
): Promise<string> {
  const res = await fetch(GROQ_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: ANALYSIS_MODEL,
      temperature: 0,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userContent },
      ],
    }),
    signal,
  });

  if (res.status === 429) {
    throw new RateLimitError();
  }

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(
      `Groq API request failed (${res.status}). ${detail.slice(0, 200)}`
    );
  }

  const data: GroqResponse = await res.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error('Groq API returned an empty response.');
  }
  return content;
}

// Call Groq, retrying once on 429 (after a long wait) and once on bad JSON.
// A second 429 after the retry re-throws RateLimitError so the caller can
// skip the chunk and continue with partial results.
async function callGroqWithRetry(
  apiKey: string,
  userContent: string,
  signal?: AbortSignal
): Promise<AuditIssue[]> {
  let raw: string;
  try {
    raw = await callGroq(apiKey, userContent, signal);
  } catch (err) {
    if (err instanceof RateLimitError) {
      await sleep(RATE_LIMIT_RETRY_DELAY_MS, signal);
      raw = await callGroq(apiKey, userContent, signal);
    } else {
      throw err;
    }
  }

  try {
    return parseIssues(raw);
  } catch {
    const retry = await callGroq(
      apiKey,
      `${userContent}\n\nIMPORTANT: Respond with ONLY a valid JSON array. No prose, no code fences.`,
      signal
    );
    return parseIssues(retry);
  }
}

// Build the user message for a chunk of rows. Row numbers are preserved
// relative to the original data so findings map back to the source file.
function buildUserMessage(
  headers: string[],
  chunk: string[][],
  chunkStartIndex: number,
  headerRowNumber: number
): string {
  const objects = chunk.map((row, i) => {
    const obj: Record<string, string> = {};
    headers.forEach((h, ci) => {
      obj[h] = row[ci] ?? '';
    });
    const rowNumber = headerRowNumber + chunkStartIndex + i + 1;
    return JSON.stringify({ row: rowNumber, ...obj });
  });
  return `Analyze this termination list chunk (rows as JSON objects). Find data-quality issues and respond with ONLY a JSON array of issues:\n[${objects.join(',')}]`;
}

export interface AnalyzeOptions {
  signal?: AbortSignal;
  onProgress?: (progress: AnalyzeProgress) => void;
}

/**
 * analyzeWiringData
 *
 * Sends parsed PLC panel wiring/termination rows to the Groq API
 * (llama-3.1-8b-instant) for data-quality auditing. Rows are sent in
 * batches of CHUNK_SIZE with a 5-second delay between calls to respect
 * Groq's per-minute rate limits. A 429 response triggers a 15-second wait
 * and a single retry; if the retry also rate-limits, that chunk is skipped
 * and the audit continues with partial results.
 */
export async function analyzeWiringData(
  headers: string[],
  rows: string[][],
  headerRowNumber: number,
  options: AnalyzeOptions = {}
): Promise<{ issues: AuditIssue[]; chunked: boolean; partial: boolean }> {
  if (rows.length === 0) return { issues: [], chunked: false, partial: false };

  const apiKey = getApiKey();
  const { signal, onProgress } = options;

  const chunks: string[][][] = [];
  for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
    chunks.push(rows.slice(i, i + CHUNK_SIZE));
  }
  const chunked = chunks.length > 1;

  const allIssues: AuditIssue[] = [];
  let partial = false;
  for (let c = 0; c < chunks.length; c++) {
    const chunk = chunks[c];
    const startIndex = c * CHUNK_SIZE;
    const startRow = headerRowNumber + startIndex + 1;
    const endRow = Math.min(startRow + chunk.length - 1, headerRowNumber + rows.length);

    onProgress?.({
      phase: 'analyzing',
      done: c,
      total: chunks.length,
      startRow,
      endRow,
      totalRows: rows.length,
    });

    const message = buildUserMessage(headers, chunk, startIndex, headerRowNumber);
    try {
      const issues = await callGroqWithRetry(apiKey, message, signal);
      allIssues.push(...issues);
    } catch (err) {
      if (err instanceof RateLimitError) {
        partial = true;
      } else if ((err as Error).name === 'AbortError') {
        throw err;
      } else {
        throw err;
      }
    }

    onProgress?.({
      phase: 'analyzing',
      done: c + 1,
      total: chunks.length,
      startRow,
      endRow,
      totalRows: rows.length,
    });

    if (c < chunks.length - 1) {
      await sleep(INTER_CHUNK_DELAY_MS, signal);
    }
  }

  // Deduplicate identical findings (a chunk boundary can cause repeats)
  const seen = new Set<string>();
  const deduped = allIssues.filter((issue) => {
    const key = `${issue.row}|${issue.issueType}|${issue.explanation}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return { issues: deduped, chunked, partial };
}

/**
 * summarizeIssues
 *
 * Asks Groq to produce a concise Markdown executive summary of the findings.
 */
export async function summarizeIssues(
  issues: AuditIssue[],
  rowsAnalyzed: number,
  signal?: AbortSignal
): Promise<string> {
  if (issues.length === 0) {
    return '## Data Quality: Clean\n\nNo issues were detected across the termination list. All terminal numbers, wire tags, and descriptions appear consistent.';
  }

  const apiKey = getApiKey();

  const issueSummary = issues.map(
    (i) => `Row ${i.row} [${i.severity}] ${i.issueType}: ${i.explanation}`
  );

  const userContent = `A PLC panel wiring/termination list with ${rowsAnalyzed} rows was audited. ${issues.length} issues were found:\n\n${issueSummary.join('\n')}\n\nWrite the executive summary in Markdown.`;

  let raw: string;
  try {
    raw = await callGroqRaw(apiKey, SUMMARY_PROMPT, userContent, signal);
  } catch (err) {
    if (err instanceof RateLimitError) {
      await sleep(RATE_LIMIT_RETRY_DELAY_MS, signal);
      raw = await callGroqRaw(apiKey, SUMMARY_PROMPT, userContent, signal);
    } else {
      throw err;
    }
  }

  return raw.trim();
}

async function callGroqRaw(
  apiKey: string,
  systemPrompt: string,
  userContent: string,
  signal?: AbortSignal
): Promise<string> {
  const res = await fetch(GROQ_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: SUMMARY_MODEL,
      temperature: 0.3,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userContent },
      ],
    }),
    signal,
  });

  if (res.status === 429) {
    throw new RateLimitError();
  }

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(
      `Groq API request failed (${res.status}). ${detail.slice(0, 200)}`
    );
  }

  const data: GroqResponse = await res.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error('Groq API returned an empty response.');
  }
  return content;
}

export { MODEL };
