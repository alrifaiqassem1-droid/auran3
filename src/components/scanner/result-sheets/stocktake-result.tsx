'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Package, ClipboardList } from 'lucide-react';
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

// ─── Types ────────────────────────────────────────────────────────────────────

type Props = {
  open:    boolean;
  onClose: () => void;
  barcode: string;
  product: Product | null;
};

// ─── StocktakeResultSheet ─────────────────────────────────────────────────────

export function StocktakeResultSheet({ open, onClose, barcode, product }: Props) {
  const t                                    = useTranslations('Scanner');
  const { activeMembership, activeBranchId } = useActiveBranch();
  const tenantId                             = activeMembership?.tenant_id;

  const [expectedQty, setExpectedQty] = useState<number | null>(null);
  const [countedQty,  setCountedQty]  = useState(0);
  const [submitting,  setSubmitting]  = useState(false);

  // Fetch expected stock from DB
  useEffect(() => {
    if (!open || !product || !tenantId || !activeBranchId) {
      setExpectedQty(null);
      return;
    }
    createClient()
      .from('stock_batches')
      .select('quantity')
      .eq('product_id', product.id)
      .eq('branch_id', activeBranchId)
      .eq('tenant_id', tenantId)
      .gt('quantity', 0)
      .then(({ data }) => setExpectedQty(data?.reduce((s, b) => s + b.quantity, 0) ?? 0));
  }, [open, product?.id, tenantId, activeBranchId]);

  useEffect(() => {
    if (open) setCountedQty(0);
  }, [open]);

  const diff = expectedQty !== null ? countedQty - expectedQty : null;

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
      <SheetContent side="bottom" className="max-h-[75dvh] overflow-y-auto rounded-t-[20px] pb-safe">
        {product ? (
          <>
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

            <Separator className="mb-4" />

            <div className="space-y-4 pb-4">
              {/* Expected vs counted */}
              <div className="grid grid-cols-3 gap-3 rounded-xl bg-muted/50 p-3">
                <div className="text-center">
                  <p className="text-[10px] text-muted-foreground mb-1">{t('expectedQty')}</p>
                  <p className="text-lg font-bold tabular-nums">
                    {expectedQty ?? '—'}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-[10px] text-muted-foreground mb-1">{t('countedQty')}</p>
                  <p className="text-lg font-bold tabular-nums text-blue-500">{countedQty}</p>
                </div>
                <div className="text-center">
                  <p className="text-[10px] text-muted-foreground mb-1">{t('difference')}</p>
                  <p className={cn(
                    'text-lg font-bold tabular-nums',
                    diff === null ? '' :
                    diff > 0 ? 'text-emerald-500' :
                    diff < 0 ? 'text-red-500' : 'text-muted-foreground',
                  )}>
                    {diff !== null ? (diff > 0 ? `+${diff}` : diff) : '—'}
                  </p>
                </div>
              </div>

              {/* Counted qty input */}
              <div>
                <p className="mb-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  {t('countedQty')}
                </p>
                <Input
                  type="number"
                  inputMode={product.unit === 'kg' ? 'decimal' : 'numeric'}
                  step={product.unit === 'kg' ? '0.001' : '1'}
                  min="0"
                  value={countedQty}
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => {
                    const v = product.unit === 'kg'
                      ? parseFloat(e.target.value)
                      : parseInt(e.target.value, 10) || 0;
                    if (!isNaN(v) && v >= 0) setCountedQty(v);
                  }}
                  className="h-11 text-center text-base font-bold tabular-nums"
                />
              </div>

              <Button
                className="h-12 w-full rounded-xl bg-blue-600 text-sm font-semibold hover:bg-blue-700"
                onClick={handleSubmit}
                disabled={submitting}
              >
                {submitting ? '...' : t('confirmCount')}
              </Button>
            </div>
          </>
        ) : (
          <div className="py-8 text-center">
            <Package className="h-10 w-10 mx-auto text-muted-foreground/30 mb-3" />
            <p className="text-sm font-medium text-muted-foreground">{t('productNotFound')}</p>
            {barcode && <p className="mt-1 font-mono text-xs text-muted-foreground/60">{barcode}</p>}
            <Button variant="outline" className="mt-4 rounded-xl" onClick={onClose}>
              {t('searchManuallyBtn')}
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
