'use client';

import { forwardRef } from 'react';
import { useTranslations } from 'next-intl';
import { CheckCircle2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { CountItemRow } from '@/app/[locale]/(dashboard)/dashboard/count/actions';

interface Props {
  item: CountItemRow;
  onChange: (productId: string, qty: number) => void;
  onConfirm?: (productId: string) => void;
  canSeeExpected: boolean;
}

function diffBadge(diff: number) {
  if (Math.abs(diff) < 0.001) return null;
  const cls =
    Math.abs(diff) <= 2
      ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
      : 'bg-rose-500/15 text-rose-600 dark:text-rose-400';
  return (
    <span className={cn('rounded-md px-1.5 py-0.5 text-[11px] font-semibold tabular-nums', cls)}>
      {diff > 0 ? '+' : ''}
      {new Intl.NumberFormat('en-US', { maximumFractionDigits: 3 }).format(diff)}
    </span>
  );
}

export const CountLine = forwardRef<HTMLInputElement, Props>(function CountLine(
  { item, onChange, onConfirm, canSeeExpected },
  ref,
) {
  const t = useTranslations('Count');
  const diff = item.counted_qty - item.expected_qty;
  const fmt = (n: number) =>
    new Intl.NumberFormat('en-US', { maximumFractionDigits: 3 }).format(n);

  return (
    <div className="flex items-center gap-3 rounded-xl border border-border/60 bg-card px-3 py-3 transition-colors hover:border-border">
      {/* Left: product info */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-sm font-semibold leading-tight">{item.product_name}</span>
          <Badge variant="secondary" className="shrink-0 px-1.5 py-0 text-[10px] uppercase">
            {item.product_unit}
          </Badge>
        </div>

        {canSeeExpected && (
          <div className="mt-1.5 flex items-center gap-2 text-[11px] text-muted-foreground">
            <span>
              {t('expected')}:{' '}
              <span className="font-medium tabular-nums text-foreground">{fmt(item.expected_qty)}</span>
            </span>
            {item.counted_qty > 0 && diffBadge(diff)}
          </div>
        )}
      </div>

      {/* Right: quantity input + confirm button */}
      <div className="flex shrink-0 items-center gap-1.5">
        <input
          ref={ref}
          type="number"
          inputMode="decimal"
          min="0"
          step="0.001"
          value={item.counted_qty || ''}
          placeholder="0"
          className={cn(
            'h-12 w-20 shrink-0 rounded-xl border border-border/60 bg-muted/30',
            'text-center text-lg font-bold tabular-nums',
            'focus:border-primary focus:bg-background focus:outline-none focus:ring-2 focus:ring-primary/20',
            'transition-colors',
          )}
          onChange={(e) => {
            const val = parseInt(e.target.value, 10) || 0;
            onChange(item.product_id, Math.max(0, val));
          }}
          onFocus={(e) => e.target.select()}
        />
        {item.counted_qty > 0 && onConfirm && (
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-10 w-10 shrink-0 rounded-xl bg-emerald-500/15 text-emerald-600 hover:bg-emerald-500/25 hover:text-emerald-700 dark:text-emerald-400"
            onClick={() => onConfirm(item.product_id)}
            aria-label={t('countedLabel')}
          >
            <CheckCircle2 className="h-5 w-5" />
          </Button>
        )}
      </div>
    </div>
  );
});
