'use client';

import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import { CheckCircle2, Download, TrendingDown, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { formatAED } from '@/lib/pricing';
import type { CountItemRow } from '@/app/[locale]/(dashboard)/dashboard/count/actions';

interface Props {
  items: CountItemRow[];
  onNewCount?: () => void;
}

interface DiffRow {
  product_id: string;
  product_name: string;
  product_unit: string;
  product_cost: number;
  expected: number;
  counted: number;
  diff: number;
}

function fmt(n: number) {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 3 }).format(n);
}

export function CountSummary({ items, onNewCount }: Props) {
  const t = useTranslations('Count');

  const diffs: DiffRow[] = items
    .filter((i) => Math.abs(i.counted_qty - i.expected_qty) > 0.001)
    .map((i) => ({
      product_id: i.product_id,
      product_name: i.product_name,
      product_unit: i.product_unit,
      product_cost: i.product_cost,
      expected: i.expected_qty,
      counted: i.counted_qty,
      diff: i.counted_qty - i.expected_qty,
    }));

  const totalDiffValue = diffs.reduce((acc, d) => acc + d.diff * d.product_cost, 0);

  function exportCsv() {
    const headers = ['Product', 'Unit', 'Expected', 'Counted', 'Diff', 'Value (AED)'];
    const rows = diffs.map((d) => [
      d.product_name,
      d.product_unit,
      d.expected,
      d.counted,
      d.diff,
      (d.diff * d.product_cost).toFixed(3),
    ]);
    const csv = [headers, ...rows].map((r) => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `count-summary-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      className="space-y-5"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">{t('summaryTitle')}</h2>
          <p className="text-sm text-muted-foreground">{t('summarySubtitle')}</p>
        </div>
        {diffs.length > 0 && (
          <Button size="sm" variant="outline" onClick={exportCsv} className="shrink-0 gap-1.5">
            <Download className="h-3.5 w-3.5" />
            {t('exportCsv')}
          </Button>
        )}
      </div>

      {/* No diffs state */}
      {diffs.length === 0 && (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 py-10 text-center">
          <CheckCircle2 className="h-10 w-10 text-emerald-500" />
          <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
            {t('noDiffs')}
          </p>
        </div>
      )}

      {/* Diffs table */}
      {diffs.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-border/60">
          <div className="grid grid-cols-[1fr_auto_auto_auto] gap-0">
            {/* Header row */}
            <div className="col-span-4 grid grid-cols-[1fr_auto_auto_auto] gap-0 border-b border-border/60 bg-muted/40 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              <span>{t('product')}</span>
              <span className="w-16 text-end">{t('expected')}</span>
              <span className="w-16 text-end">{t('countedLabel')}</span>
              <span className="w-20 text-end">{t('diff')}</span>
            </div>

            {/* Data rows */}
            {diffs.map((d, i) => (
              <div
                key={d.product_id}
                className={cn(
                  'col-span-4 grid grid-cols-[1fr_auto_auto_auto] items-center gap-0 px-3 py-2.5 text-sm',
                  i < diffs.length - 1 && 'border-b border-border/40',
                )}
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{d.product_name}</p>
                  <p className="text-[11px] text-muted-foreground tabular-nums">
                    {t('diffValue')}: {formatAED(Math.abs(d.diff) * d.product_cost)}
                  </p>
                </div>
                <span className="w-16 text-end tabular-nums text-muted-foreground">
                  {fmt(d.expected)}
                </span>
                <span className="w-16 text-end tabular-nums font-medium">{fmt(d.counted)}</span>
                <div className="flex w-20 items-center justify-end gap-1">
                  {d.diff > 0 ? (
                    <TrendingUp className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
                  ) : (
                    <TrendingDown className="h-3.5 w-3.5 shrink-0 text-rose-500" />
                  )}
                  <span
                    className={cn(
                      'font-semibold tabular-nums',
                      d.diff > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400',
                    )}
                  >
                    {d.diff > 0 ? '+' : ''}
                    {fmt(d.diff)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Total diff value */}
      {diffs.length > 0 && (
        <div className="flex items-center justify-between rounded-xl border border-border/60 bg-muted/30 px-4 py-3">
          <span className="text-sm font-medium text-muted-foreground">{t('totalDiff')}</span>
          <span
            className={cn(
              'text-base font-bold tabular-nums',
              totalDiffValue < 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400',
            )}
          >
            {totalDiffValue >= 0 ? '+' : ''}
            {formatAED(totalDiffValue)}
          </span>
        </div>
      )}

      {/* New count button */}
      {onNewCount && (
        <Button
          onClick={onNewCount}
          variant="outline"
          className="h-12 w-full rounded-xl text-sm font-semibold"
        >
          {t('newCount')}
        </Button>
      )}
    </motion.div>
  );
}
