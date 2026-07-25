import type { AuditIssue } from '@/lib/types';
import { SeverityBadge } from './severity-badge';

export function ResultsTable({ issues }: { issues: AuditIssue[] }) {
  if (issues.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-card/50 py-16 text-center">
        <p className="text-sm font-medium text-foreground">No issues detected</p>
        <p className="mt-1 text-sm text-muted-foreground">
          The wiring list passed all automated data-quality checks.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-border bg-[hsl(222_22%_12%)] text-left text-xs uppercase tracking-wider text-muted-foreground">
              <th className="px-4 py-3 font-medium">Row</th>
              <th className="px-4 py-3 font-medium">Severity</th>
              <th className="px-4 py-3 font-medium">Issue Type</th>
              <th className="px-4 py-3 font-medium">Explanation</th>
            </tr>
          </thead>
          <tbody>
            {issues.map((issue, i) => (
              <tr
                key={`${issue.row}-${issue.issueType}-${i}`}
                className="border-b border-border/60 transition-colors last:border-0 hover:bg-accent/40"
              >
                <td className="whitespace-nowrap px-4 py-3 font-mono text-muted-foreground">
                  {issue.row}
                </td>
                <td className="px-4 py-3">
                  <SeverityBadge severity={issue.severity} />
                </td>
                <td className="whitespace-nowrap px-4 py-3 font-medium text-foreground">
                  {issue.issueType}
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {issue.explanation}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
