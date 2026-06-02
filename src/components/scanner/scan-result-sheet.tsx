'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  Package,
  Truck,
  TriangleAlert,
  ExternalLink,
  PlusCircle,
  Search,
  ShoppingCart,
} from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Link } from '@/i18n/navigation';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { useActiveBranch } from '@/hooks/use-active-branch';
import type { Product } from '@/types/db';

// ─── Types ────────────────────────────────────────────────────────────────────

type Props = {
  open:         boolean;
  onClose:      () => void;
  barcode:      string;
  product:      Product | null;
  categories:   { id: string; name: string }[];
  onAddProduct: (barcode: string) => void;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return new Intl.NumberFormat('en-US', {
    style:                 'currency',
    currency:              'AED',
    minimumFractionDigits: 2,
  }).format(n);
}

function daysUntil(dateStr: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expiry = new Date(dateStr);
  return Math.ceil((expiry.getTime() - today.getTime()) / 86_400_000);
}

// ─── ScanResultSheet ──────────────────────────────────────────────────────────

export function ScanResultSheet({
  open,
  onClose,
  barcode,
  product,
  onAddProduct,
}: Props) {
  const t                    = useTranslations('Scanner');
  const { activeMembership } = useActiveBranch();
  const tenantId             = activeMembership?.tenant_id;

  const [totalStock,    setTotalStock]    = useState<number | null>(null);
  const [nearestExpiry, setNearestExpiry] = useState<string | null>(null);

  // ── Fetch stock when sheet opens ──────────────────────────────────────────
  useEffect(() => {
    if (!open || !product || !tenantId) {
      setTotalStock(null);
      setNearestExpiry(null);
      return;
    }
    const supabase = createClient();
    supabase
      .from('stock_batches')
      .select('quantity, expiry_date')
      .eq('product_id', product.id)
      .eq('tenant_id', tenantId)
      .gt('quantity', 0)
      .order('expiry_date', { ascending: true, nullsFirst: false })
      .then(({ data }) => {
        if (!data) return;
        setTotalStock(data.reduce((s, b) => s + b.quantity, 0));
        setNearestExpiry(data.find((b) => b.expiry_date)?.expiry_date ?? null);
      });
  }, [open, product?.id, tenantId]);

  // ── Stock level badge ─────────────────────────────────────────────────────
  function StockBadge() {
    if (totalStock === null || !product) return null;
    const threshold = product.low_stock_threshold ?? 0;
    if (totalStock <= 0) {
      return (
        <Badge className="border-red-500/30 bg-red-500/15 text-red-400 text-[10px]">
          {t('outOfStock')}
        </Badge>
      );
    }
    if (totalStock <= threshold) {
      return (
        <Badge className="border-amber-500/30 bg-amber-500/15 text-amber-400 text-[10px]">
          {t('lowStock')}
        </Badge>
      );
    }
    return (
      <Badge className="border-emerald-500/30 bg-emerald-500/15 text-emerald-400 text-[10px]">
        {t('inStock')}
      </Badge>
    );
  }

  // ── Expiry warning (within 7 days) ────────────────────────────────────────
  function ExpiryWarning() {
    if (!nearestExpiry) return null;
    const days = daysUntil(nearestExpiry);
    if (days > 7) return null;
    return (
      <div className="mb-3 flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2">
        <TriangleAlert className="h-4 w-4 shrink-0 text-red-400" />
        <p className="text-sm text-red-400">
          {days <= 0 ? t('expiresToday') : t('expiresIn', { n: days })}
        </p>
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent
        side="bottom"
        className="max-h-[75dvh] overflow-y-auto rounded-t-[20px] pb-safe"
      >
        {product ? (
          <>
            {/* Header */}
            <SheetHeader className="pb-3">
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
                      <Badge variant="secondary" className="text-[11px] capitalize">
                        {product.unit === 'kg' ? t('unitKg') : t('unitPcs')}
                      </Badge>
                      <StockBadge />
                    </div>
                  </div>
                  {barcode && (
                    <p className="mt-0.5 font-mono text-xs text-muted-foreground">{barcode}</p>
                  )}
                </div>
              </div>
            </SheetHeader>

            {/* Expiry warning */}
            <ExpiryWarning />

            {/* Price grid */}
            <div className="mb-4 grid grid-cols-2 gap-3 rounded-xl bg-muted/50 p-3">
              <div>
                <p className="text-[11px] text-muted-foreground">{t('sellPrice')}</p>
                <p className="text-lg font-bold tabular-nums">{fmt(product.sell_price)}</p>
                {product.vat_inclusive && (
                  <p className="text-[10px] text-muted-foreground">{t('vatIncluded')}</p>
                )}
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground">{t('costPrice')}</p>
                <p className="text-lg font-bold tabular-nums">{fmt(product.cost_price)}</p>
              </div>
            </div>

            <Separator className="mb-4" />

            {/* 4 action buttons */}
            <div className="grid grid-cols-4 gap-2">
              <Link href={`/dashboard/receiving?barcode=${barcode}`} onClick={onClose}>
                <Button
                  variant="outline"
                  className="h-auto w-full flex-col gap-1 px-1 py-3"
                  size="sm"
                >
                  <Truck className="h-4 w-4 text-emerald-500" />
                  <span className="text-center text-[10px] leading-tight">{t('receive')}</span>
                </Button>
              </Link>

              <Link href={`/dashboard/damaged?barcode=${barcode}`} onClick={onClose}>
                <Button
                  variant="outline"
                  className="h-auto w-full flex-col gap-1 px-1 py-3"
                  size="sm"
                >
                  <TriangleAlert className="h-4 w-4 text-rose-500" />
                  <span className="text-center text-[10px] leading-tight">{t('damage')}</span>
                </Button>
              </Link>

              <Button
                variant="outline"
                className="h-auto flex-col gap-1 px-1 py-3"
                size="sm"
                onClick={() => { onClose(); toast.info('Coming soon'); }}
              >
                <ShoppingCart className="h-4 w-4 text-blue-500" />
                <span className="text-center text-[10px] leading-tight">{t('quickSale')}</span>
              </Button>

              <Link href={`/dashboard/products/${product.id}`} onClick={onClose}>
                <Button
                  variant="outline"
                  className="h-auto w-full flex-col gap-1 px-1 py-3"
                  size="sm"
                >
                  <ExternalLink className="h-4 w-4 text-primary" />
                  <span className="text-center text-[10px] leading-tight">{t('details')}</span>
                </Button>
              </Link>
            </div>
          </>
        ) : (
          /* ── Not found ── */
          <>
            <SheetHeader className="pb-4">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-muted">
                  <Package className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <SheetTitle className="text-start text-base">
                    {t('unknownBarcode')}
                  </SheetTitle>
                  {barcode && (
                    <p className="mt-0.5 font-mono text-xs text-muted-foreground">{barcode}</p>
                  )}
                </div>
              </div>
            </SheetHeader>

            <p className="mb-4 text-sm text-muted-foreground">{t('notFoundDesc')}</p>

            <div className="grid grid-cols-2 gap-3">
              <Button
                className="h-12 gap-2 rounded-xl"
                onClick={() => onAddProduct(barcode)}
              >
                <PlusCircle className="h-4 w-4" />
                {t('addNewProduct')}
              </Button>
              <Link
                href={`/dashboard/products?search=${encodeURIComponent(barcode)}`}
                onClick={onClose}
              >
                <Button variant="outline" className="h-12 w-full gap-2 rounded-xl">
                  <Search className="h-4 w-4" />
                  {t('searchManuallyBtn')}
                </Button>
              </Link>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
