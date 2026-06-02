'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Package, Tag } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { formatAED } from '@/lib/pricing';
import type { Product } from '@/types/db';

// ─── Types ────────────────────────────────────────────────────────────────────

type Props = {
  open:    boolean;
  onClose: () => void;
  barcode: string;
  product: Product | null;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function margin(sell: number, cost: number): string {
  if (cost <= 0) return '—';
  return `${(((sell - cost) / cost) * 100).toFixed(1)}%`;
}

// ─── PricingResultSheet ───────────────────────────────────────────────────────

export function PricingResultSheet({ open, onClose, barcode, product }: Props) {
  const t  = useTranslations('Scanner');
  const tp = useTranslations('Products');

  const [newPrice,   setNewPrice]   = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open && product) setNewPrice(String(product.sell_price));
  }, [open, product?.id]);

  const parsedPrice = parseFloat(newPrice) || 0;
  const marginStr   = product ? margin(parsedPrice, product.cost_price) : '—';

  async function handleSave() {
    if (!product || parsedPrice <= 0) {
      toast.error('Enter a valid price');
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await createClient()
        .from('products')
        .update({ sell_price: parsedPrice })
        .eq('id', product.id);

      if (error) {
        toast.error(error.message);
      } else {
        toast.success(t('priceUpdated'));
        onClose();
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
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-purple-500/10">
                  <Tag className="h-5 w-5 text-purple-500" />
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

            {/* Current prices */}
            <div className="mb-4 grid grid-cols-2 gap-3 rounded-xl bg-muted/50 p-3">
              <div>
                <p className="text-[11px] text-muted-foreground">{tp('costPrice')}</p>
                <p className="text-lg font-bold tabular-nums">{formatAED(product.cost_price)}</p>
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground">{tp('sellPrice')}</p>
                <p className="text-lg font-bold tabular-nums">{formatAED(product.sell_price)}</p>
              </div>
            </div>

            <Separator className="mb-4" />

            <div className="space-y-4 pb-4">
              {/* New sell price */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {t('newPrice')}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {tp('margin')}:{' '}
                    <span className="font-semibold text-foreground">{marginStr}</span>
                  </p>
                </div>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 select-none text-sm text-muted-foreground">
                    AED
                  </span>
                  <Input
                    type="number"
                    inputMode="decimal"
                    step="0.001"
                    min="0"
                    value={newPrice}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => setNewPrice(e.target.value)}
                    className="h-11 pl-12 text-base font-bold tabular-nums"
                  />
                </div>
              </div>

              <Button
                className="h-12 w-full rounded-xl bg-purple-600 text-sm font-semibold hover:bg-purple-700"
                onClick={handleSave}
                disabled={submitting || parsedPrice <= 0}
              >
                {submitting ? '...' : t('savePrice')}
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
