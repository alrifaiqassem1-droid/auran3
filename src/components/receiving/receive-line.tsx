'use client';

import { useTranslations } from 'next-intl';
import { X, Package } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export interface CartItem {
  product_id: string;
  product_name: string;
  unit: 'pcs' | 'kg';
  quantity: number;
  cost_price: number;
  expiry_date: string | null;
}

interface Props {
  line: CartItem;
  onChange: (updated: Partial<CartItem>) => void;
  onRemove: () => void;
}

export function ReceiveLine({ line, onChange, onRemove }: Props) {
  const t = useTranslations('Receiving');
  const isKg = line.unit === 'kg';

  return (
    <div className="rounded-xl border bg-card p-3 space-y-3">
      {/* Product header row */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
            <Package className="h-4 w-4 text-primary" />
          </div>
          <p className="font-medium text-sm truncate leading-tight">{line.product_name}</p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0.5">
            {isKg ? t('unitKg') : t('unitPcs')}
          </Badge>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-destructive"
            onClick={onRemove}
            aria-label={t('removeItem')}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Editable fields */}
      <div className="grid grid-cols-3 gap-2">
        {/* Quantity */}
        <div>
          <p className="text-[10px] text-muted-foreground mb-1">{t('quantity')}</p>
          <Input
            type="number"
            inputMode={isKg ? 'decimal' : 'numeric'}
            step={isKg ? '0.001' : '1'}
            min="0.001"
            value={line.quantity}
            onFocus={(e) => e.target.select()}
            onChange={(e) => {
              const val = isKg
                ? parseFloat(e.target.value)
                : parseInt(e.target.value, 10) || 0;
              if (!isNaN(val) && val > 0) onChange({ quantity: val });
            }}
            className="h-8 text-sm text-center tabular-nums"
          />
        </div>

        {/* Cost price */}
        <div>
          <p className="text-[10px] text-muted-foreground mb-1">{t('costPrice')}</p>
          <Input
            type="number"
            inputMode="decimal"
            step="0.001"
            min="0"
            value={line.cost_price}
            onFocus={(e) => e.target.select()}
            onChange={(e) => {
              const val = parseFloat(e.target.value);
              if (!isNaN(val) && val >= 0) onChange({ cost_price: val });
            }}
            className="h-8 text-sm text-center tabular-nums"
          />
        </div>

        {/* Expiry date */}
        <div>
          <p className="text-[10px] text-muted-foreground mb-1">{t('expiryDate')}</p>
          <Input
            type="date"
            value={line.expiry_date ?? ''}
            onChange={(e) => onChange({ expiry_date: e.target.value || null })}
            className="h-8 text-[11px] px-2"
          />
        </div>
      </div>
    </div>
  );
}
