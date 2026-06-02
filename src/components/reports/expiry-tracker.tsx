'use client';

import { useTranslations } from 'next-intl';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { ExpiryData, ExpiryBatch } from '@/app/[locale]/(dashboard)/dashboard/reports/actions';

interface Props {
  data: ExpiryData;
}

function fmt(n: number) {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 3 }).format(n);
}

function fmtDate(d: string) {
  return new Intl.DateTimeFormat('en-AE', {
    day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Dubai',
  }).format(new Date(d));
}

function DaysBadge({ days }: { days: number | null }) {
  if (days === null) return <span className="text-xs text-muted-foreground">—</span>;
  if (days < 0)
    return <span className="rounded-md bg-rose-500/15 px-1.5 py-0.5 text-[11px] font-semibold text-rose-600 dark:text-rose-400">{Math.abs(days)}d ago</span>;
  if (days === 0)
    return <span className="rounded-md bg-rose-500/15 px-1.5 py-0.5 text-[11px] font-semibold text-rose-600 dark:text-rose-400">Today</span>;
  return (
    <span className={cn(
      'rounded-md px-1.5 py-0.5 text-[11px] font-semibold tabular-nums',
      days <= 7  ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400' :
      days <= 30 ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400' :
                   'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
    )}>
      {days}d
    </span>
  );
}

function BatchList({ batches, emptyKey }: { batches: ExpiryBatch[]; emptyKey: string }) {
  const t = useTranslations('Reports');
  if (batches.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border/60 py-10 text-center">
        <p className="text-sm text-muted-foreground">{t(emptyKey as Parameters<typeof t>[0])}</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {batches.map((b) => (
        <div
          key={b.id}
          className="flex items-center gap-3 rounded-xl border border-border/60 bg-card px-3 py-2.5"
        >
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="truncate text-sm font-medium">{b.product_name}</span>
              <Badge variant="secondary" className="shrink-0 px-1.5 py-0 text-[10px] uppercase">
                {b.product_unit}
              </Badge>
            </div>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              {b.expiry_date ? fmtDate(b.expiry_date) : '—'}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-3 text-end">
            <div>
              <p className="text-xs font-bold tabular-nums">{fmt(b.quantity)}</p>
              <p className="text-[10px] text-muted-foreground">{b.product_unit}</p>
            </div>
            <DaysBadge days={b.days_left} />
          </div>
        </div>
      ))}
    </div>
  );
}

function TabCount({ n, variant }: { n: number; variant: 'danger' | 'warning' | 'safe' | 'neutral' }) {
  const cls = {
    danger:  'bg-rose-500/15 text-rose-600 dark:text-rose-400',
    warning: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
    safe:    'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
    neutral: 'bg-muted text-muted-foreground',
  }[variant];
  if (n === 0) return null;
  return (
    <span className={cn('ms-1.5 rounded-full px-1.5 py-0 text-[10px] font-bold tabular-nums', cls)}>
      {new Intl.NumberFormat('en-US').format(n)}
    </span>
  );
}

export function ExpiryTracker({ data }: Props) {
  const t = useTranslations('Reports');

  const allExpiredCritical = [...data.expired, ...data.critical];

  return (
    <div className="space-y-4">
      <Tabs defaultValue="expired">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="expired" className="text-xs">
            {t('tabExpired')}
            <TabCount n={allExpiredCritical.length} variant="danger" />
          </TabsTrigger>
          <TabsTrigger value="warning" className="text-xs">
            {t('tabNearExpiry')}
            <TabCount n={data.warning.length} variant="warning" />
          </TabsTrigger>
          <TabsTrigger value="safe" className="text-xs">
            {t('tabSafe')}
            <TabCount n={data.safe.length} variant="safe" />
          </TabsTrigger>
        </TabsList>

        <TabsContent value="expired" className="mt-4">
          <BatchList batches={allExpiredCritical} emptyKey="noExpiredItems" />
        </TabsContent>
        <TabsContent value="warning" className="mt-4">
          <BatchList batches={data.warning} emptyKey="noNearExpiryItems" />
        </TabsContent>
        <TabsContent value="safe" className="mt-4">
          <BatchList batches={data.safe} emptyKey="noSafeItems" />
        </TabsContent>
      </Tabs>
    </div>
  );
}
