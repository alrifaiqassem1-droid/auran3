'use client';
import { useTranslations } from 'next-intl';
import { Package, Truck, TriangleAlert, ExternalLink, PlusCircle, Search } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Link } from '@/i18n/navigation';
import type { Product } from '@/types/db';

type Props = {
  open:    boolean;
  onClose: () => void;
  barcode: string;
  product: Product | null;
};

function fmt(n: number) {
  return new Intl.NumberFormat('en-US', {
    style:                 'currency',
    currency:              'AED',
    minimumFractionDigits: 2,
  }).format(n);
}

export function ScanResultSheet({ open, onClose, barcode, product }: Props) {
  const t = useTranslations('Scanner');

  return (
    <Sheet open={open} onOpenChange={v => !v && onClose()}>
      <SheetContent side="bottom" className="rounded-t-[20px] pb-safe max-h-[70dvh] overflow-y-auto">

        {product ? (
          <>
            <SheetHeader className="pb-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                    <Package className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <SheetTitle className="text-start text-base leading-tight">{product.name}</SheetTitle>
                    <p className="mt-0.5 font-mono text-xs text-muted-foreground">{barcode}</p>
                  </div>
                </div>
                <Badge variant="secondary" className="shrink-0 capitalize">
                  {product.unit === 'kg' ? t('unitKg') : t('unitPcs')}
                </Badge>
              </div>
            </SheetHeader>

            {/* Price row */}
            <div className="mb-4 grid grid-cols-2 gap-3 rounded-xl bg-muted/50 p-3">
              <div>
                <p className="text-[11px] text-muted-foreground">{t('sellPrice')}</p>
                <p className="text-lg font-bold">{fmt(product.sell_price)}</p>
                {product.vat_inclusive && (
                  <p className="text-[10px] text-muted-foreground">{t('vatIncluded')}</p>
                )}
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground">{t('costPrice')}</p>
                <p className="text-lg font-bold">{fmt(product.cost_price)}</p>
              </div>
            </div>

            <Separator className="mb-4" />

            {/* Action buttons */}
            <div className="grid grid-cols-3 gap-2">
              <Link href={`/dashboard/receiving?barcode=${barcode}`} onClick={onClose}>
                <Button variant="outline" className="w-full flex-col gap-1 h-auto py-3" size="sm">
                  <Truck className="h-4 w-4 text-emerald-500" />
                  <span className="text-[11px]">{t('receive')}</span>
                </Button>
              </Link>
              <Link href={`/dashboard/damaged?barcode=${barcode}`} onClick={onClose}>
                <Button variant="outline" className="w-full flex-col gap-1 h-auto py-3" size="sm">
                  <TriangleAlert className="h-4 w-4 text-rose-500" />
                  <span className="text-[11px]">{t('damage')}</span>
                </Button>
              </Link>
              <Link href={`/dashboard/products/${product.id}`} onClick={onClose}>
                <Button variant="outline" className="w-full flex-col gap-1 h-auto py-3" size="sm">
                  <ExternalLink className="h-4 w-4 text-primary" />
                  <span className="text-[11px]">{t('details')}</span>
                </Button>
              </Link>
            </div>
          </>
        ) : (
          /* ── Not found state ── */
          <>
            <SheetHeader className="pb-4">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-muted">
                  <Package className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <SheetTitle className="text-start text-base">{t('notFound')}</SheetTitle>
                  <p className="mt-0.5 font-mono text-xs text-muted-foreground">{barcode}</p>
                </div>
              </div>
            </SheetHeader>
            <p className="mb-4 text-sm text-muted-foreground">{t('notFoundDesc')}</p>
            <div className="grid grid-cols-2 gap-3">
              <Link href={`/dashboard/products/new?barcode=${barcode}`} onClick={onClose}>
                <Button className="w-full gap-2 h-12 rounded-xl">
                  <PlusCircle className="h-4 w-4" />
                  {t('addProduct')}
                </Button>
              </Link>
              <Link href={`/dashboard/products?search=${encodeURIComponent(barcode)}`} onClick={onClose}>
                <Button variant="outline" className="w-full gap-2 h-12 rounded-xl">
                  <Search className="h-4 w-4" />
                  {t('searchManually')}
                </Button>
              </Link>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
