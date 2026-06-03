'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Package, Truck, TriangleAlert, ExternalLink } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Link } from '@/i18n/navigation';
import { createClient } from '@/lib/supabase/client';
import { useActiveBranch } from '@/hooks/use-active-branch';
import type { Product } from '@/types/db';

type Props = {
  open:         boolean;
  onClose:      () => void;
  barcode:      string;
  product:      Product | null;
  onAddProduct: (barcode: string) => void;
};

export function ScanResultSheet({ open, onClose, barcode, product, onAddProduct }: Props) {
  const t       = useTranslations('Scanner');
  const { activeMembership } = useActiveBranch();
  const tenantId = activeMembership?.tenant_id;

  const [totalStock, setTotalStock] = useState<number | null>(null);

  useEffect(() => {
    if (!open || !product || !tenantId) { setTotalStock(null); return; }
    createClient()
      .from('stock_batches')
      .select('quantity')
      .eq('product_id', product.id)
      .eq('tenant_id', tenantId)
      .gt('quantity', 0)
      .then(({ data }) => setTotalStock(data?.reduce((s, b) => s + b.quantity, 0) ?? 0));
  }, [open, product?.id, tenantId]);

  function StockBadge() {
    if (totalStock === null || !product) return null;
    const th = product.low_stock_threshold ?? 0;
    if (totalStock <= 0)  return <Badge className="border-red-500/30     bg-red-500/15     text-red-400     text-[10px]">{t('outOfStock')}</Badge>;
    if (totalStock <= th) return <Badge className="border-amber-500/30   bg-amber-500/15   text-amber-400   text-[10px]">{t('lowStock')}</Badge>;
    return                       <Badge className="border-emerald-500/30 bg-emerald-500/15 text-emerald-400 text-[10px]">{t('inStock')}</Badge>;
  }

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="bottom" className="max-h-[70dvh] overflow-y-auto rounded-t-[20px] pb-safe">
        {product ? (
          <>
            <SheetHeader className="pb-4">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                  <Package className="h-5 w-5 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <SheetTitle className="truncate text-start text-base leading-tight">
                      {product.name}
                    </SheetTitle>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <Badge variant="secondary" className="text-[11px] capitalize">{product.unit}</Badge>
                      <StockBadge />
                    </div>
                  </div>
                  {barcode && (
                    <p className="mt-0.5 font-mono text-xs text-muted-foreground">{barcode}</p>
                  )}
                </div>
              </div>
            </SheetHeader>

            <div className="grid grid-cols-3 gap-2">
              <Link href={`/dashboard/receiving?barcode=${barcode}`} onClick={onClose}>
                <Button variant="outline" className="h-auto w-full flex-col gap-1.5 px-1 py-3" size="sm">
                  <Truck className="h-4 w-4 text-emerald-500" />
                  <span className="text-center text-[10px] leading-tight">{t('receive')}</span>
                </Button>
              </Link>
              <Link href={`/dashboard/damaged?barcode=${barcode}`} onClick={onClose}>
                <Button variant="outline" className="h-auto w-full flex-col gap-1.5 px-1 py-3" size="sm">
                  <TriangleAlert className="h-4 w-4 text-rose-500" />
                  <span className="text-center text-[10px] leading-tight">{t('damage')}</span>
                </Button>
              </Link>
              <Link href={`/dashboard/products/${product.id}`} onClick={onClose}>
                <Button variant="outline" className="h-auto w-full flex-col gap-1.5 px-1 py-3" size="sm">
                  <ExternalLink className="h-4 w-4 text-primary" />
                  <span className="text-center text-[10px] leading-tight">{t('details')}</span>
                </Button>
              </Link>
            </div>
          </>
        ) : (
          <>
            <SheetHeader className="pb-4">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-muted">
                  <Package className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <SheetTitle className="text-start text-base">{t('unknownBarcode')}</SheetTitle>
                  {barcode && (
                    <p className="mt-0.5 font-mono text-xs text-muted-foreground">{barcode}</p>
                  )}
                </div>
              </div>
            </SheetHeader>
            <Button
              className="h-12 w-full gap-2 rounded-xl"
              onClick={() => onAddProduct(barcode)}
            >
              {t('addNewProduct')}
            </Button>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
