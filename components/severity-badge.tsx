import { cn } from '@/lib/utils';
import type { Severity } from '@/lib/types';

const STYLES: Record<Severity, { dot: string; badge: string; label: string }> = {
  CRITICAL: {
    dot: 'bg-red-500',
    badge: 'bg-red-500/15 text-red-400 ring-1 ring-red-500/30',
    label: 'Critical',
  },
  WARNING: {
    dot: 'bg-amber-500',
    badge: 'bg-amber-500/15 text-amber-400 ring-1 ring-amber-500/30',
    label: 'Warning',
  },
  INFO: {
    dot: 'bg-sky-500',
    badge: 'bg-sky-500/15 text-sky-400 ring-1 ring-sky-500/30',
    label: 'Info',
  },
};

export function SeverityBadge({ severity }: { severity: Severity }) {
  const s = STYLES[severity];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide',
        s.badge
      )}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full', s.dot)} />
      {s.label}
    </span>
  );
}

export { STYLES as severityStyles };
