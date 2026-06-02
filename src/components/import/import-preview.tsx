'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { CheckCircle2, AlertTriangle, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import type { MappedRow } from '@/lib/pos/parse-csv';
import type { MatchableProduct } from '@/app/[locale]/(dashboard)/dashboard/import/actions';

export interface MatchedRow extends MappedRow {
  product_id: string | null;
  product_name_matched: string | null;
  ignored: boolean;
}

interface Props {
  rows: MatchedRow[];
  products: MatchableProduct[];
  importing: boolean;
  progress: number;
  onRowUpdate: (idx: number, productId: string | null, ignored: boolean) => void;
  onConfirm: () => void;
}

function fmt(n: number) {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 3 }).format(n);
}

function fmtAED(n: number) {
  return new Intl.NumberFormat('en-AE', { style: 'currency', currency: 'AED', numberingSystem: 'latn' }).format(n);
}

function MatchSelector({
  row,
  products,
  onSelect,
}: {
  row: MatchedRow;
  products: MatchableProduct[];
  onSelect: (id: string | null) => void;
}) {
  const t = useTranslations('Import');
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button size="sm" variant="outline" className="h-7 gap-1 text-xs">
          <Search className="h-3 w-3" />
          {t('linkManually')}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-0" align="end">
        <Command>
          <CommandInput placeholder={t('searchProduct')} />
          <CommandList className="max-h-48">
            <CommandEmpty>{t('noMatch')}</CommandEmpty>
            <CommandGroup>
              {products.map((p) => (
                <CommandItem
                  key={p.id}
                  value={p.name + (p.barcode ?? '')}
                  onSelect={() => { onSelect(p.id); setOpen(false); }}
                  className="text-xs"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">{p.name}</p>
                    {p.barcode && (
                      <p className="font-mono text-[10px] text-muted-foreground">{p.barcode}</p>
                    )}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export function ImportPreview({ rows, products, importing, progress, onRowUpdate, onConfirm }: Props) {
  const t = useTranslations('Import');

  const matched  = rows.filter((r) => r.product_id && !r.ignored).length;
  const ignored  = rows.filter((r) => r.ignored).length;
  const unmatched = rows.filter((r) => !r.product_id && !r.ignored).length;
  const totalValue = rows
    .filter((r) => !r.ignored)
    .reduce((s, r) => s + r.total, 0);

  const preview = rows.slice(0, 50);

  return (
    <div className="space-y-5">
      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 text-center">
          <p className="text-lg font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
            {new Intl.NumberFormat('en-US').format(matched)}
          </p>
          <p className="text-[11px] text-muted-foreground">{t('matched')}</p>
        </div>
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-center">
          <p className="text-lg font-bold tabular-nums text-amber-600 dark:text-amber-400">
            {new Intl.NumberFormat('en-US').format(unmatched)}
          </p>
          <p className="text-[11px] text-muted-foreground">{t('unmatched')}</p>
        </div>
        <div className="rounded-xl border border-border/60 bg-muted/20 p-3 text-center">
          <p className="text-lg font-bold tabular-nums">
            {new Intl.NumberFormat('en-US').format(rows.length)}
          </p>
          <p className="text-[11px] text-muted-foreground">{t('totalRows')}</p>
        </div>
      </div>

      {/* Total value */}
      <div className="flex items-center justify-between rounded-xl border border-border/60 bg-muted/20 px-4 py-2.5">
        <span className="text-sm text-muted-foreground">{t('totalValue')}</span>
        <span className="font-bold tabular-nums">{fmtAED(totalValue)}</span>
      </div>

      {/* Rows list */}
      <div className="max-h-72 overflow-y-auto rounded-xl border border-border/60">
        <div className="divide-y divide-border/40">
          {preview.map((row, i) => (
            <div
              key={row._idx}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 text-sm',
                row.ignored && 'opacity-40',
              )}
            >
              {/* Status icon */}
              {row.product_id ? (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
              ) : (
                <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" />
              )}

              {/* Info */}
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium">
                  {row.product_name_matched ?? row.product_name ?? row.barcode ?? `Row ${i + 1}`}
                </p>
                <p className="text-[11px] tabular-nums text-muted-foreground">
                  {fmt(row.quantity)} × {fmtAED(row.total)}
                </p>
              </div>

              {/* Actions */}
              <div className="flex shrink-0 items-center gap-1.5">
                {!row.product_id && !row.ignored && (
                  <>
                    <MatchSelector
                      row={row}
                      products={products}
                      onSelect={(id) => onRowUpdate(row._idx, id, false)}
                    />
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-xs text-muted-foreground"
                      onClick={() => onRowUpdate(row._idx, null, true)}
                    >
                      {t('ignore')}
                    </Button>
                  </>
                )}
                {row.product_id && (
                  <Badge variant="secondary" className="text-[10px]">
                    {t('linked')}
                  </Badge>
                )}
                {row.ignored && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-[10px]"
                    onClick={() => onRowUpdate(row._idx, null, false)}
                  >
                    {t('restore')}
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {rows.length > 50 && (
        <p className="text-center text-xs text-muted-foreground">
          {t('showingFirst', { n: 50, total: rows.length })}
        </p>
      )}

      {/* Import progress */}
      {importing && (
        <div className="space-y-2">
          <Progress value={progress} className="h-2" />
          <p className="text-center text-xs text-muted-foreground">{t('importing')}</p>
        </div>
      )}

      {/* Confirm button */}
      <Button
        onClick={onConfirm}
        disabled={importing || matched + unmatched === 0}
        className="h-12 w-full rounded-xl text-sm font-semibold shadow-md shadow-primary/20"
      >
        {importing ? t('importing') : t('confirmImport', { n: matched + unmatched, ignored })}
      </Button>
    </div>
  );
}
