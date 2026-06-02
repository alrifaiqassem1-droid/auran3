'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Package, TriangleAlert } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { useActiveBranch } from '@/hooks/use-active-branch';
import { enqueueAndRun } from '@/lib/offline/queue';
import type { Product } from '@/types/db';

// ─── Types ────────────────────────────────────────────────────────────────────

type DamageReason = 'expired' | 'broken' | 'spoiled' | 'other';

type Props = {
  open:    boolean;
  onClose: () => void;
  barcode: string;
  product: Product | null;
};

// ─── DamageResultSheet ────────────────────────────────────────────────────────

export function DamageResultSheet({ open, onClose, barcode, product }: Props) {
  const t                                    = useTranslations('Damage');
  const ts                                   = useTranslations('Scanner');
  const { activeMembership, activeBranchId } = useActiveBranch();
  const tenantId                             = activeMembership?.tenant_id;

  const [totalStock,   setTotalStock]   = useState<number | null>(null);
  const [qty,          setQty]          = useState(1);
  const [reason,       setReason]       = useState<DamageReason>('expired');
  const [note,         setNote]         = useState('');
  const [submitting,   setSubmitting]   = useState(false);

  // Fetch stock when sheet opens
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

  // Reset form on open
  useEffect(() => {
    if (open) { setQty(1); setReason('expired'); setNote(''); }
  }, [open]);

  async function handleSubmit() {
    if (!product || !activeBranchId) return;
    setSubmitting(true);
    try {
      const res = await enqueueAndRun('record_damage', {
        branch_id:  activeBranchId,
        product_id: product.id,
        quantity:   qty,
        reason,
        note:       note.trim() || null,
      });
      if (res.ok) {
        toast.success(t('success'));
        onClose();
      } else {
        toast.error(res.error ?? t('insufficientStock'));
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
            <SheetHeader className="pb-3">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-red-500/10">
                  <TriangleAlert className="h-5 w-5 text-red-500" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <SheetTitle className="truncate text-start text-base leading-tight">
                      {product.name}
                    </SheetTitle>
                    <Badge variant="secondary" className="shrink-0 text-[11px] capitalize">
                      {product.unit}
                    </Badge>
                  </div>
                  {barcode && (
                    <p className="mt-0.5 font-mono text-xs text-muted-foreground">{barcode}</p>
                  )}
                  {totalStock !== null && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {ts('currentStock')}:{' '}
                      <span className="font-semibold text-foreground tabular-nums">
                        {totalStock} {product.unit}
                      </span>
                    </p>
                  )}
                </div>
              </div>
            </SheetHeader>

            <Separator className="mb-4" />

            <div className="space-y-4 pb-4">
              {/* Quantity */}
              <div>
                <p className="mb-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  {t('quantity')}
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

              {/* Reason */}
              <div>
                <p className="mb-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  {t('reason')}
                </p>
                <Select value={reason} onValueChange={(v) => setReason(v as DamageReason)}>
                  <SelectTrigger className="h-11">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="expired">{t('reasonExpired')}</SelectItem>
                    <SelectItem value="broken">{t('reasonBroken')}</SelectItem>
                    <SelectItem value="spoiled">{t('reasonSpoiled')}</SelectItem>
                    <SelectItem value="other">{t('reasonOther')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Note */}
              <div>
                <p className="mb-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  {t('note')}
                </p>
                <Input
                  placeholder={t('notePlaceholder')}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className="h-11"
                />
              </div>

              <Button
                className="h-12 w-full rounded-xl bg-red-500 text-sm font-semibold hover:bg-red-600"
                onClick={handleSubmit}
                disabled={submitting}
              >
                {submitting ? t('submitting') : t('submit')}
              </Button>
            </div>
          </>
        ) : (
          /* Not found */
          <>
            <SheetHeader className="pb-4">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-muted">
                  <Package className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <SheetTitle className="text-start text-base">{ts('productNotFound')}</SheetTitle>
                  {barcode && (
                    <p className="mt-0.5 font-mono text-xs text-muted-foreground">{barcode}</p>
                  )}
                </div>
              </div>
            </SheetHeader>
            <Button variant="outline" className="w-full h-12 rounded-xl" onClick={onClose}>
              {ts('searchManuallyBtn')}
            </Button>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
