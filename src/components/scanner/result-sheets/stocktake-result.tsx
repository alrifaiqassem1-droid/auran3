'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Package, ClipboardList, Loader2, Minus, Plus } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { useActiveBranch } from '@/hooks/use-active-branch';
import { enqueueAndRun } from '@/lib/offline/queue';
import { cn } from '@/lib/utils';
import type { Product } from '@/types/db';

type Props = {
  open:    boolean;
  onClose: () => void;
  barcode: string;
  product: Product | null;
};

// Strip unnecessary trailing zeros from float display
function fmtQty(n: number): string {
  return parseFloat(n.toFixed(3)).toString();
}

export function StocktakeResultSheet({ open, onClose, barcode, product }: Props) {
  const t                                    = useTranslations('Scanner');
  const { activeMembership, activeBranchId } = useActiveBranch();
  const tenantId                             = activeMembership?.tenant_id;

  const [expectedQty,  setExpectedQty]  = useState<number | null>(null);
  const [loadingStock, setLoadingStock] = useState(false);
  const [countedQty,   setCountedQty]   = useState(0);
  const [submitting,   setSubmitting]   = useState(false);

  // ── Fetch expected stock from DB when sheet opens ─────────────────────────
  useEffect(() => {
    if (!open || !product) {
      setExpectedQty(null);
      return;
    }
    if (!tenantId || !activeBranchId) {
      setExpectedQty(0);
      return;
    }
    setLoadingStock(true);
    createClient()
      .from('stock_batches')
      .select('quantity')
      .eq('product_id', product.id)
      .eq('branch_id', activeBranchId)
      .eq('tenant_id', tenantId)
      .gt('quantity', 0)
      .then(({ data }) => {
        setExpectedQty(data?.reduce((s, b) => s + b.quantity, 0) ?? 0);
        setLoadingStock(false);
      });
  }, [open, product?.id, tenantId, activeBranchId]);

  // ── Reset counter on every open ───────────────────────────────────────────
  useEffect(() => {
    if (open) setCountedQty(0);
  }, [open]);

  const isKg = product?.unit === 'kg';
  const step = isKg ? 0.1 : 1;

  // Live difference — float-safe
  const diff = expectedQty !== null
    ? parseFloat((countedQty - expectedQty).toFixed(3))
    : null;

  function decrement() {
    setCountedQty((q) => parseFloat(Math.max(0, q - step).toFixed(3)));
  }
  function increment() {
    setCountedQty((q) => parseFloat((q + step).toFixed(3)));
  }

  async function handleSubmit() {
    if (!product || !activeBranchId) return;
    setSubmitting(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const res = await enqueueAndRun('record_count' as any, {
        branch_id:   activeBranchId,
        product_id:  product.id,
        counted_qty: countedQty,
      });
      if (res.ok) {
        toast.success(t('countConfirmed'));
        onClose();
      } else {
        toast.error(res.error ?? 'Failed to record count');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="bottom" className="max-h-[80dvh] overflow-y-auto rounded-t-[20px] pb-safe">

        {product ? (
          <>
            {/* ── Product header ─────────────────────────────────────────── */}
            <SheetHeader className="pb-3">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-500/10">
                  <ClipboardList className="h-5 w-5 text-blue-500" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <SheetTitle className="truncate text-start text-base leading-tight">
                      {product.name}
                    </SheetTitle>
                    <Badge variant="secondary" className="shrink-0 text-[11px]">
                      {product.unit}
                    </Badge>
                  </div>
                  {barcode && (
                    <p className="mt-0.5 font-mono text-xs text-muted-foreground">{barcode}</p>
                  )}
                </div>
              </div>
            </SheetHeader>

            <Separator className="mb-5" />

            <div className="space-y-5 pb-4">
              {/* ── Expected / Counted / Diff summary ────────────────────── */}
              <div className="grid grid-cols-3 gap-3 rounded-xl bg-muted/50 p-3 text-center">
                {/* Expected */}
                <div>
                  <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    {t('expectedQty')}
                  </p>
                  {loadingStock ? (
                    <Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground/40" />
                  ) : (
                    <p className="text-xl font-bold tabular-nums">
                      {expectedQty !== null ? fmtQty(expectedQty) : '—'}
                    </p>
                  )}
                </div>

                {/* Counted */}
                <div>
                  <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    {t('countedQty')}
                  </p>
                  <p className="text-xl font-bold tabular-nums text-blue-500">
                    {fmtQty(countedQty)}
                  </p>
                </div>

                {/* Difference — green if surplus, red if shortage, gray if exact */}
                <div>
                  <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    {t('difference')}
                  </p>
                  <p className={cn(
                    'text-xl font-bold tabular-nums',
                    diff === null ? 'text-muted-foreground' :
                    diff  >  0   ? 'text-emerald-500'      :
                    diff  <  0   ? 'text-red-500'          :
                                   'text-muted-foreground',
                  )}>
                    {diff !== null
                      ? (diff > 0 ? `+${fmtQty(diff)}` : fmtQty(diff))
                      : '—'}
                  </p>
                </div>
              </div>

              {/* ── Actual qty stepper ────────────────────────────────────── */}
              <div>
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {t('countedQty')}
                </p>
                <div className="flex items-center gap-2">
                  {/* Decrement */}
                  <button
                    onClick={decrement}
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-border/60 bg-muted/40 active:scale-95 transition-transform"
                    aria-label="Decrease"
                  >
                    <Minus className="h-4 w-4" />
                  </button>

                  {/* Direct input */}
                  <Input
                    type="number"
                    inputMode={isKg ? 'decimal' : 'numeric'}
                    step={step}
                    min={0}
                    value={countedQty}
                    autoFocus
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => {
                      const v = isKg
                        ? parseFloat(e.target.value)
                        : parseInt(e.target.value, 10) || 0;
                      if (!isNaN(v) && v >= 0) setCountedQty(v);
                    }}
                    className="h-11 flex-1 text-center text-base font-bold tabular-nums"
                  />

                  {/* Increment */}
                  <button
                    onClick={increment}
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-border/60 bg-muted/40 active:scale-95 transition-transform"
                    aria-label="Increase"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* ── Confirm button ─────────────────────────────────────────── */}
              <Button
                className="h-12 w-full rounded-xl bg-blue-600 text-sm font-semibold hover:bg-blue-700"
                onClick={handleSubmit}
                disabled={submitting}
              >
                {submitting ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    ...
                  </span>
                ) : t('confirmCount')}
              </Button>
            </div>
          </>
        ) : (
          /* ── Product not found ─────────────────────────────────────────── */
          <div className="py-8 text-center">
            <Package className="mx-auto mb-3 h-10 w-10 text-muted-foreground/30" />
            <p className="text-sm font-medium text-muted-foreground">{t('productNotFound')}</p>
            {barcode && (
              <p className="mt-1 font-mono text-xs text-muted-foreground/60">{barcode}</p>
            )}
            <Button variant="outline" className="mt-4 rounded-xl" onClick={onClose}>
              {t('searchManuallyBtn')}
            </Button>
          </div>
        )}

      </SheetContent>
    </Sheet>
  );
}
