'use client';

import { useTranslations } from 'next-intl';
import { X, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatAED } from '@/lib/pricing';

export interface CartItem {
  product_id: string;
  product_name: string;
  unit: 'pcs' | 'kg';
  quantity: number;
  cost_price: number;
  expiry_date: string | null;
  lot_number: string | null;
}

interface Props {
  line: CartItem;
  onEdit: () => void;
  onRemove: () => void;
}

export function ReceiveLine({ line, onEdit, onRemove }: Props) {
  const t = useTranslations('Receiving');
  const total = line.quantity * line.cost_price;
  const qtyLabel = `${line.quantity} ${line.unit === 'kg' ? 'kg' : 'pcs'}`;

  return (
    <div className="flex items-center gap-3 rounded-xl border bg-card px-3 py-2.5">
      <button
        onClick={onEdit}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 active:scale-95 transition-transform"
        aria-label="Edit"
      >
        <Package className="h-4 w-4 text-primary" />
      </button>

      <button className="flex-1 min-w-0 text-start" onClick={onEdit}>
        <p className="font-medium text-sm truncate leading-tight">{line.product_name}</p>
        <p className="text-[11px] text-muted-foreground tabular-nums mt-0.5">
          {qtyLabel}
          {line.expiry_date && <> · {line.expiry_date}</>}
          {line.lot_number && <> · {line.lot_number}</>}
          {' · '}{formatAED(total)}
        </p>
      </button>

      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
        onClick={onRemove}
        aria-label={t('removeItem')}
      >
        <X className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
