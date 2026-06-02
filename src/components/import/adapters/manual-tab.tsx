'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Trash2, Check, ChevronsUpDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { useActiveBranch } from '@/hooks/use-active-branch';
import { enqueueAndRun } from '@/lib/offline/queue';
import type { MatchableProduct } from '@/app/[locale]/(dashboard)/dashboard/import/actions';
import type { PosImportRow } from '@/lib/pos/engine';

interface SaleLine {
  id: number;
  product_id: string | null;
  product_name: string;
  barcode: string | null;
  qty: string;
  total: string;
}

let _lineId = 0;
const newLine = (): SaleLine => ({ id: ++_lineId, product_id: null, product_name: '', barcode: null, qty: '', total: '' });

function fmtDate(d: Date) {
  return d.toISOString().slice(0, 16); // "2026-06-01T10:30"
}

interface Props {
  products: MatchableProduct[];
  onSuccess: (result: { matched: number; unmatched: number }) => void;
}

function ProductPicker({ value, products, onChange }: {
  value: SaleLine; products: MatchableProduct[];
  onChange: (p: MatchableProduct | null) => void;
}) {
  const t = useTranslations('Import');
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" className="h-9 w-full justify-between truncate text-start text-xs font-normal">
          <span className={cn('truncate', !value.product_name && 'text-muted-foreground')}>
            {value.product_name || t('manualProduct')}
          </span>
          <ChevronsUpDown className="ms-1 h-3.5 w-3.5 shrink-0 opacity-40" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-0" align="start">
        <Command>
          <CommandInput placeholder={t('searchProduct')} className="text-xs" />
          <CommandList className="max-h-48">
            <CommandEmpty>{t('noMatch')}</CommandEmpty>
            <CommandGroup>
              {products.map((p) => (
                <CommandItem key={p.id} value={p.name + (p.barcode ?? '')} onSelect={() => { onChange(p); setOpen(false); }} className="text-xs">
                  <Check className={cn('me-2 h-3.5 w-3.5', value.product_id === p.id ? 'opacity-100 text-primary' : 'opacity-0')} />
                  <span className="flex-1 truncate">{p.name}</span>
                  {p.barcode && <span className="font-mono text-[10px] text-muted-foreground ms-1">{p.barcode}</span>}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export function ManualTab({ products, onSuccess }: Props) {
  const t = useTranslations('Import');
  const { activeBranchId } = useActiveBranch();
  const [isPending, startTransition] = useTransition();
  const [progress, setProgress] = useState(0);

  const [date, setDate]   = useState(fmtDate(new Date()));
  const [lines, setLines] = useState<SaleLine[]>([newLine()]);

  function updateLine(id: number, patch: Partial<SaleLine>) {
    setLines((prev) => prev.map((l) => l.id === id ? { ...l, ...patch } : l));
  }

  function pickProduct(id: number, p: MatchableProduct | null) {
    updateLine(id, {
      product_id:   p?.id   ?? null,
      product_name: p?.name ?? '',
      barcode:      p?.barcode ?? null,
    });
  }

  function removeLine(id: number) {
    setLines((prev) => prev.length > 1 ? prev.filter((l) => l.id !== id) : prev);
  }

  const totalValue = lines.reduce((s, l) => s + (parseFloat(l.total) || 0), 0);
  const validLines = lines.filter((l) => parseFloat(l.qty) > 0 && parseFloat(l.total) >= 0);

  function handleSubmit() {
    if (!activeBranchId || !validLines.length) { toast.error(t('noRows')); return; }

    const soldAt = new Date(date).toISOString();
    const rows: PosImportRow[] = validLines.map((l) => ({
      product_id: l.product_id,
      barcode:    l.barcode,
      quantity:   parseFloat(l.qty),
      total:      parseFloat(l.total) || 0,
      sold_at:    soldAt,
    }));

    startTransition(async () => {
      setProgress(20);
      const res = await enqueueAndRun('apply_pos_import', {
        branch_id: activeBranchId, source: 'Manual', file_name: 'manual-entry', rows,
      } as Record<string, unknown>);
      setProgress(100);

      if (res.ok) {
        const matched   = rows.filter((r) => r.product_id).length;
        const unmatched = rows.length - matched;
        onSuccess({ matched, unmatched });
        if (res.queued) toast.success(t('importOffline'));
        else toast.success(t('importSuccess'));
      } else {
        toast.error(res.error ?? t('importError'));
        setProgress(0);
      }
    });
  }

  return (
    <div className="space-y-4">
      {/* Date */}
      <div>
        <label className="mb-1.5 block text-xs font-medium text-muted-foreground">{t('manualDate')}</label>
        <Input type="datetime-local" value={date} onChange={(e) => setDate(e.target.value)} className="h-9 text-xs tabular-nums" dir="ltr" />
      </div>

      {/* Column headers */}
      <div className="grid grid-cols-[1fr_64px_80px_32px] items-center gap-2 px-1 text-[11px] font-semibold text-muted-foreground">
        <span>{t('manualProduct')}</span>
        <span className="text-center">{t('manualQty')}</span>
        <span className="text-center">{t('manualTotal')}</span>
        <span />
      </div>

      {/* Lines */}
      <AnimatePresence initial={false}>
        <div className="space-y-2">
          {lines.map((line) => (
            <motion.div
              key={line.id}
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.15 }}
              className="overflow-hidden"
            >
              <div className="grid grid-cols-[1fr_64px_80px_32px] items-center gap-2">
                <ProductPicker value={line} products={products} onChange={(p) => pickProduct(line.id, p)} />
                <Input
                  type="number" inputMode="decimal" min="0" step="0.001" placeholder="1"
                  value={line.qty} onChange={(e) => updateLine(line.id, { qty: e.target.value })}
                  className="h-9 text-center text-xs tabular-nums"
                />
                <Input
                  type="number" inputMode="decimal" min="0" step="0.01" placeholder="0.00"
                  value={line.total} onChange={(e) => updateLine(line.id, { total: e.target.value })}
                  className="h-9 text-center text-xs tabular-nums"
                />
                <Button variant="ghost" size="icon" className="h-9 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                  onClick={() => removeLine(line.id)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </motion.div>
          ))}
        </div>
      </AnimatePresence>

      {/* Add line */}
      <Button variant="outline" size="sm" className="w-full gap-1.5 text-xs" onClick={() => setLines((p) => [...p, newLine()])}>
        <Plus className="h-3.5 w-3.5" />
        {t('manualAddLine')}
      </Button>

      {/* Summary + Submit */}
      {validLines.length > 0 && (
        <div className="flex items-center justify-between rounded-xl border border-border/60 bg-muted/20 px-4 py-2.5 text-sm">
          <span className="text-muted-foreground">{t('totalValue')}</span>
          <span className="font-bold tabular-nums">
            {new Intl.NumberFormat('en-AE', { style: 'currency', currency: 'AED', numberingSystem: 'latn' }).format(totalValue)}
          </span>
        </div>
      )}

      {isPending && <Progress value={progress} className="h-1.5" />}

      <Button
        onClick={handleSubmit}
        disabled={isPending || !validLines.length}
        className="h-11 w-full rounded-xl text-sm font-semibold shadow-md shadow-primary/20"
      >
        {isPending ? t('importing') : t('confirmImport', { n: validLines.length, ignored: 0 })}
      </Button>
    </div>
  );
}
