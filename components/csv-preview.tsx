import { CheckCircle2, AlertCircle } from 'lucide-react';
import type { ParsedCsv } from '@/lib/types';
import { cn } from '@/lib/utils';

export function CsvPreview({ csv }: { csv: ParsedCsv }) {
  if (csv.rowCount === 0 && csv.preambleRows.length === 0) return null;

  const previewRows = csv.rows.slice(0, 50);
  const truncated = csv.rows.length > previewRows.length;
  const hasPreamble = csv.preambleRows.length > 0;
  const maxCols = Math.max(
    csv.headers.length,
    ...csv.preambleRows.map((r) => r.length),
    ...previewRows.map((r) => r.length)
  );

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <div className="flex flex-col gap-2 border-b border-border bg-[hsl(222_22%_12%)] px-4 py-2.5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Raw Data Preview
          </span>
          {hasPreamble ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-medium text-amber-400 ring-1 ring-amber-500/30">
              <AlertCircle className="h-3 w-3" />
              {csv.preambleRows.length} preamble row
              {csv.preambleRows.length > 1 ? 's' : ''} skipped
            </span>
          ) : null}
        </div>
        <span className="font-mono text-xs text-muted-foreground">
          {csv.rows.length} rows · {csv.headers.length} cols
          {truncated ? ' · showing first 50' : ''}
        </span>
      </div>

      <div className="flex items-center gap-1.5 border-b border-border bg-primary/5 px-4 py-2">
        <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
        <span className="text-xs text-muted-foreground">
          Header detected on line{' '}
          <span className="font-mono font-medium text-primary">
            {csv.headerRowNumber}
          </span>
        </span>
      </div>

      <div className="max-h-80 overflow-auto">
        <table className="w-full border-collapse text-xs">
          <thead className="sticky top-0">
            <tr className="bg-[hsl(222_22%_13%)] text-left">
              <th className="border-b border-border px-3 py-2 font-mono font-medium text-muted-foreground">
                #
              </th>
              {Array.from({ length: maxCols }).map((_, i) => (
                <th
                  key={i}
                  className="whitespace-nowrap border-b border-border px-3 py-2 font-mono font-medium text-foreground"
                >
                  {csv.headers[i] ?? ''}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {hasPreamble &&
              csv.preambleRows.map((row, ri) => (
                <tr
                  key={`p-${ri}`}
                  className="border-b border-border/40 bg-amber-500/5 text-muted-foreground/50 line-through last:border-0"
                >
                  <td className="px-3 py-1.5 font-mono text-muted-foreground/70">
                    {ri + 1}
                  </td>
                  {Array.from({ length: maxCols }).map((_, ci) => (
                    <td
                      key={ci}
                      className={cn(
                        'whitespace-nowrap px-3 py-1.5 font-mono',
                        (row[ci] ?? '').trim() === '' && 'no-underline'
                      )}
                    >
                      {row[ci] ?? ''}
                    </td>
                  ))}
                </tr>
              ))}
            {previewRows.map((row, ri) => (
              <tr
                key={ri}
                className="border-b border-border/40 last:border-0 hover:bg-accent/30"
              >
                <td className="px-3 py-1.5 font-mono text-muted-foreground/70">
                  {csv.headerRowNumber + ri + 1}
                </td>
                {Array.from({ length: maxCols }).map((_, ci) => (
                  <td
                    key={ci}
                    className="whitespace-nowrap px-3 py-1.5 font-mono text-muted-foreground"
                  >
                    {row[ci] ?? ''}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
