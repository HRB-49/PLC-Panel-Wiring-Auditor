'use client';

import { useRef, useState } from 'react';
import {
  FileBarChart,
  Download,
  RotateCcw,
  Loader2,
  ScanSearch,
  Sparkles,
  FileText,
} from 'lucide-react';
import { Sidebar } from '@/components/sidebar';
import { UploadZone } from '@/components/upload-zone';
import { CsvPreview } from '@/components/csv-preview';
import { SummaryCards } from '@/components/summary-cards';
import { ResultsTable } from '@/components/results-table';
import { Markdown } from '@/components/markdown';
import { parseCsv, toCsv } from '@/lib/csv';
import type { AnalyzeResponse, AnalyzeProgressEvent, ParsedCsv } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

type AppState = 'empty' | 'preview' | 'loading' | 'results' | 'error';

interface ProgressState {
  phase: 'analyzing' | 'summarizing';
  done: number;
  total: number;
  startRow: number;
  endRow: number;
}

export default function Home() {
  const [state, setState] = useState<AppState>('empty');
  const [file, setFile] = useState<File | null>(null);
  const [csv, setCsv] = useState<ParsedCsv | null>(null);
  const [result, setResult] = useState<AnalyzeResponse | null>(null);
  const [error, setError] = useState<string>('');
  const [progress, setProgress] = useState<ProgressState | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const reset = () => {
    abortRef.current?.abort();
    setState('empty');
    setFile(null);
    setCsv(null);
    setResult(null);
    setError('');
    setProgress(null);
  };

  const handleFile = (f: File) => {
    setFile(f);
    setError('');
    f.text().then((text) => {
      const parsed = parseCsv(text);
      if (parsed.rowCount === 0) {
        setError('No data rows found in this CSV. Please check the file contents.');
        setState('error');
        return;
      }
      setCsv(parsed);
      setState('preview');
    });
  };

  const runAudit = async () => {
    if (!file) return;
    setState('loading');
    setError('');
    setProgress(null);
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/analyze', {
        method: 'POST',
        body: formData,
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Request failed (${res.status})`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let finalResult: AnalyzeResponse | null = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        for (const line of lines) {
          if (!line.trim()) continue;
          const event = JSON.parse(line);
          if (event.type === 'progress') {
            setProgress({
              phase: event.phase,
              done: event.done,
              total: event.total,
              startRow: event.startRow,
              endRow: event.endRow,
            });
          } else if (event.type === 'result') {
            finalResult = {
              issues: event.issues,
              aiSummary: event.aiSummary,
              meta: event.meta,
            };
          } else if (event.type === 'error') {
            throw new Error(event.error);
          }
        }
      }

      if (finalResult) {
        setResult(finalResult);
        setState('results');
      } else {
        throw new Error('No result received from the analysis.');
      }
    } catch (err) {
      if ((err as Error).name === 'AbortError') return;
      setError(err instanceof Error ? err.message : 'Analysis failed.');
      setState('error');
    } finally {
      setProgress(null);
    }
  };

  const downloadReport = () => {
    if (!result) return;
    const csvText = toCsv(result.issues);
    const blob = new Blob([csvText], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `wiring-audit-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <main className="flex-1 overflow-x-hidden">
        <Header />

        <div className="mx-auto max-w-6xl px-6 py-8">
          {state === 'empty' && <EmptyState onFile={handleFile} />}

          {state === 'preview' && csv && (
            <div className="space-y-6">
              <SectionHeader
                title="Review uploaded data"
                subtitle="Confirm the parsed wiring list looks correct before running the audit."
              />
              <UploadZone
                onFile={handleFile}
                selectedFile={file}
                onClear={reset}
              />
              <CsvPreview csv={csv} />
              <div className="flex items-center gap-3">
                <Button onClick={runAudit} size="lg">
                  <ScanSearch className="mr-2 h-4 w-4" />
                  Run Audit
                </Button>
                <Button variant="outline" onClick={reset}>
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {state === 'loading' && <LoadingState progress={progress} />}

          {state === 'results' && result && csv && (
            <div className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <SectionHeader
                  title="Audit Report"
                  subtitle={`${result.meta.rowsAnalyzed} rows analyzed by ${result.meta.model} · ${result.issues.length} issues found · ${new Date(result.meta.analyzedAt).toLocaleString()}`}
                />
                <div className="flex items-center gap-2">
                  <Button variant="outline" onClick={downloadReport}>
                    <Download className="mr-2 h-4 w-4" />
                    Download Report as CSV
                  </Button>
                  <Button variant="ghost" onClick={reset}>
                    <RotateCcw className="mr-2 h-4 w-4" />
                    New Audit
                  </Button>
                </div>
              </div>

              <SummaryCards issues={result.issues} />

              {result.aiSummary && (
                <Card className="border-border bg-card p-6">
                  <div className="mb-4 flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-primary" />
                    <h3 className="text-sm font-semibold uppercase tracking-wider text-foreground">
                      AI Audit Summary
                    </h3>
                  </div>
                  <Markdown content={result.aiSummary} className="space-y-1" />
                </Card>
              )}

              <div className="space-y-2">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                  Findings
                </h3>
                <ResultsTable issues={result.issues} />
              </div>

              <div className="space-y-2">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                  Source Data
                </h3>
                <CsvPreview csv={csv} />
              </div>
            </div>
          )}

          {state === 'error' && (
            <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-red-500/40 bg-red-500/5 py-16 text-center">
              <p className="text-sm font-medium text-red-400">Could not process the file</p>
              <p className="mt-1 max-w-md text-sm text-muted-foreground">{error}</p>
              <Button variant="outline" className="mt-4" onClick={reset}>
                Try again
              </Button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function Header() {
  return (
    <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-border bg-[hsl(222_22%_9%)]/80 px-6 backdrop-blur">
      <div className="flex items-center gap-2">
        <FileBarChart className="h-5 w-5 text-primary" />
        <h1 className="text-sm font-semibold text-foreground">
          Wiring &amp; Termination Auditor
        </h1>
      </div>
      <div className="font-mono text-xs text-muted-foreground">
        pre-commissioning · v0.9
      </div>
    </header>
  );
}

function SectionHeader({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <div>
      <h2 className="text-xl font-semibold text-foreground">{title}</h2>
      {subtitle && (
        <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
      )}
    </div>
  );
}

function EmptyState({ onFile }: { onFile: (f: File) => void }) {
  return (
    <div className="space-y-6">
      <SectionHeader
        title="Upload a wiring list"
        subtitle="Drop a CSV export of your PLC panel termination list. The auditor flags data-quality issues before commissioning."
      />
      <UploadZone onFile={onFile} selectedFile={null} onClear={() => {}} />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[
          {
            title: 'Duplicate terminals',
            body: 'Detects terminal numbers reused across rows.',
          },
          {
            title: 'Missing identifiers',
            body: 'Flags rows missing wire tags or panel references.',
          },
          {
            title: 'Flexible columns',
            body: 'Recognizes common header name variations automatically.',
          },
        ].map((c) => (
          <div
            key={c.title}
            className="rounded-lg border border-border bg-card p-4"
          >
            <div className="text-sm font-medium text-foreground">{c.title}</div>
            <p className="mt-1 text-xs text-muted-foreground">{c.body}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function LoadingState({ progress }: { progress: ProgressState | null }) {
  const pct = progress && progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;
  const progressText =
    progress?.phase === 'summarizing'
      ? 'Generating AI audit summary…'
      : progress && progress.total > 1
        ? `Analyzing rows ${progress.startRow}–${progress.endRow} of ${progress.total > 1 ? '' : ''}${progress.total}…`
        : progress && progress.total === 1
          ? 'Analyzing wiring data…'
          : 'Preparing analysis…';

  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <Loader2 className="h-10 w-10 animate-spin text-primary" />
      <p className="mt-4 text-sm font-medium text-foreground">
        {progressText}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        Checking terminals, wire tags, and panel references with Groq AI.
      </p>
      {progress && progress.total > 1 && (
        <div className="mt-6 w-full max-w-md">
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all duration-500 ease-out"
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className="mt-2 text-xs font-mono text-muted-foreground">
            Batch {progress.done} of {progress.total} · {pct}%
          </p>
        </div>
      )}
    </div>
  );
}
