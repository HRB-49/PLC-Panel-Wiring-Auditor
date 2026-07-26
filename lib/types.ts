export type Severity = 'CRITICAL' | 'WARNING' | 'INFO';

export interface AuditIssue {
  row: number;
  severity: Severity;
  issueType: string;
  explanation: string;
}

export interface ParsedCsv {
  headers: string[];
  rows: string[][];
  rowCount: number;
  /** 1-based line number in the source file that was detected as the header row. */
  headerRowNumber: number;
  /** Raw parsed rows that appeared before the detected header row (preamble/title). */
  preambleRows: string[][];
}

export interface AnalyzeResponse {
  issues: AuditIssue[];
  aiSummary: string;
 partial: boolean;
  meta: {
    rowsAnalyzed: number;
    analyzedAt: string;
    model: string;
    chunked: boolean;
  };
}

export interface AnalyzeProgressEvent {
  phase: 'analyzing' | 'summarizing' | 'done';
  done: number;
  total: number;
  startRow: number;
  endRow: number;
  totalRows: number;
}
