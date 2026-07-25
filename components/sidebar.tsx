'use client';

import { useState } from 'react';
import {
  FileBarChart,
  Upload,
  History,
  Settings,
  ShieldCheck,
  Cpu,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const NAV = [
  { id: 'auditor', label: 'Auditor', icon: FileBarChart },
  { id: 'uploads', label: 'Uploads', icon: Upload },
  { id: 'history', label: 'History', icon: History },
  { id: 'settings', label: 'Settings', icon: Settings },
] as const;

export function Sidebar() {
  const [active, setActive] = useState<string>('auditor');

  return (
    <aside className="hidden md:flex h-screen w-60 shrink-0 flex-col border-r border-border bg-[hsl(222_22%_9%)]">
      <div className="flex h-16 items-center gap-2.5 border-b border-border px-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/15 text-primary ring-1 ring-primary/30">
          <Cpu className="h-5 w-5" />
        </div>
        <div className="leading-tight">
          <div className="text-sm font-semibold text-foreground">
            Panel Wiring
          </div>
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
            Auditor
          </div>
        </div>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-4">
        {NAV.map((item) => {
          const Icon = item.icon;
          const isActive = active === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActive(item.id)}
              className={cn(
                'flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary/15 text-primary'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground'
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {item.label}
            </button>
          );
        })}
      </nav>

      <div className="border-t border-border px-4 py-4">
        <div className="flex items-center gap-2 rounded-md bg-[hsl(222_22%_7%)] px-3 py-2.5 ring-1 ring-border">
          <ShieldCheck className="h-4 w-4 text-emerald-400" />
          <div className="text-[11px] leading-tight text-muted-foreground">
            <div className="font-medium text-foreground">Engineer Mode</div>
            <div>v0.9 · pre-commissioning</div>
          </div>
        </div>
      </div>
    </aside>
  );
}
