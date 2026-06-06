'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Package, ShoppingCart } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { useActiveBranch } from '@/hooks/use-active-branch';
import { enqueueAndRun } from '@/lib/offline/queue';
import type { OpType } from '@/lib/offline/db';
import { formatAED } from '@/lib/pricing';
import { cn } from '@/lib/utils';
import type { Product } from '@/types/db';

// ─── Types ────────────────────────────────────────────────────────────────────

type PaymentMethod = 'cash' | 'card' | 'credit';

type Props = {
  open:    boolean;
  onClose: () => void;
  barcode: string;
  product: Product | null;
};

// ─── QuicksaleResultSheet ─────────────────────────────────────────────────────

export function QuicksaleResultSheet({ open, onClose, barcode, product }: Props) {
  const t                                    = useTranslations('Scanner');
  const { activeMembership, activeBranchId } = useActiveBranch();

  const [qty,           setQty]           = useState(1);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [submitting,    setSubmitting]    = useState(false);

  useEffect(() => {
    if (open) { setQty(1); setPaymentMethod('cash'); }
  }, [open]);

  const total = product ? qty * product.sell_price : 0;

  async function handleSubmit() {
    if (!product || !activeBranchId) return;
    setSubmitting(true);
    try {
      const res = await enqueueAndRun('record_sale' as unknown as OpType, {
        branch_id:      activeBranchId,
        product_id:     product.id,
        quantity:       qty,
        payment_method: paymentMethod,
        total_amount:   total,
      });
      if (res.ok) {
        toast.success(t('saleConfirmed'));
        onClose();
      } else {
        toast.error(res.error ?? 'Failed to record sale');
      }
    } finally {
      setSubmitting(false);
    }
  }

  const PAYMENTS: { key: PaymentMethod; label: string }[] = [
    { key: 'cash',   label: t('paymentCash')   },
    { key: 'card',   label: t('paymentCard')   },
    { key: 'credit', label: t('paymentCredit') },
  ];

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="bottom" className="max-h-[80dvh] overflow-y-auto rounded-t-[20px] pb-safe">
        {product ? (
          <>
            <SheetHeader className="pb-3">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-500/10">
                  <ShoppingCart className="h-5 w-5 text-amber-500" />
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

            {/* Price */}
            <div className="mb-4 rounded-xl bg-muted/50 px-4 py-3">
              <p className="text-[11px] text-muted-foreground">{t('sellPrice')}</p>
              <p className="text-xl font-bold tabular-nums">{formatAED(product.sell_price)}</p>
              {product.vat_inclusive && (
                <p className="text-[10px] text-muted-foreground">{t('vatIncluded')}</p>
              )}
            </div>

            <Separator className="mb-4" />

            <div className="space-y-4 pb-4">
              {/* Quantity */}
              <div>
                <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Qty
                </p>
                <Input
                  type="number"
                  inputMode={product.unit === 'kg' ? 'decimal' : 'numeric'}
                  step={product.unit === 'kg' ? '0.001' : '1'}
                  min="0.001"
                  value={qty}
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => {
                    const v = product.unit === 'kg'
                      ? parseFloat(e.target.value)
                      : parseInt(e.target.value, 10) || 0;
                    if (!isNaN(v) && v > 0) setQty(v);
                  }}
                  className="h-11 text-center text-base font-bold tabular-nums"
                />
              </div>

              {/* Payment method */}
              <div>
                <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Payment
                </p>
                <div className="flex gap-2">
                  {PAYMENTS.map(({ key, label }) => (
                    <button
                      key={key}
                      onClick={() => setPaymentMethod(key)}
                      className={cn(
                        'flex-1 rounded-xl border py-2.5 text-sm font-semibold transition-colors',
                        paymentMethod === key
                          ? 'border-amber-500 bg-amber-500/15 text-amber-600'
                          : 'border-border/60 text-muted-foreground hover:border-border',
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Total */}
              <div className="flex items-center justify-between rounded-xl bg-muted/60 px-4 py-3">
                <span className="text-sm text-muted-foreground">Total</span>
                <span className="text-xl font-bold tabular-nums">{formatAED(total)}</span>
              </div>

              <Button
                className="h-12 w-full rounded-xl bg-amber-500 text-sm font-semibold hover:bg-amber-600 text-white"
                onClick={handleSubmit}
                disabled={submitting}
              >
                {submitting ? '...' : t('confirmSale')}
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
