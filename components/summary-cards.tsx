import { AlertOctagon, AlertTriangle, Info } from 'lucide-react';
import type { AuditIssue, Severity } from '@/lib/types';
import { cn } from '@/lib/utils';

const SUMMARY: {
  key: Severity;
  label: string;
  icon: typeof AlertOctagon;
  accent: string;
  ring: string;
}[] = [
  {
    key: 'CRITICAL',
    label: 'Critical',
    icon: AlertOctagon,
    accent: 'text-red-400',
    ring: 'ring-red-500/20',
  },
  {
    key: 'WARNING',
    label: 'Warnings',
    icon: AlertTriangle,
    accent: 'text-amber-400',
    ring: 'ring-amber-500/20',
  },
  {
    key: 'INFO',
    label: 'Info',
    icon: Info,
    accent: 'text-sky-400',
    ring: 'ring-sky-500/20',
  },
];

export function SummaryCards({ issues }: { issues: AuditIssue[] }) {
  const counts: Record<Severity, number> = {
    CRITICAL: 0,
    WARNING: 0,
    INFO: 0,
  };
  issues.forEach((i) => {
    counts[i.severity]++;
  });

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      {SUMMARY.map((s) => {
        const Icon = s.icon;
        const value = counts[s.key];
        return (
          <div
            key={s.key}
            className={cn(
              'flex items-center justify-between rounded-lg border border-border bg-card p-4 ring-1',
              s.ring
            )}
          >
            <div>
              <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {s.label}
              </div>
              <div className={cn('mt-1 font-mono text-3xl font-semibold', s.accent)}>
                {value}
              </div>
            </div>
            <Icon className={cn('h-8 w-8 opacity-80', s.accent)} />
          </div>
        );
      })}
    </div>
  );
}
