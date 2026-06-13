'use client';

import { useState, useTransition } from 'react';
import { motion } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { MoreVertical, Pencil, Trash2, ToggleLeft, ToggleRight } from 'lucide-react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { formatAED, formatQty } from '@/lib/pricing';
import { toggleActive, deleteProduct } from '@/app/[locale]/(dashboard)/dashboard/products/actions';

interface Category {
  id: string;
  name: string;
}

interface Product {
  id: string;
  name: string;
  barcode: string | null;
  unit: 'pcs' | 'kg';
  category_id: string | null;
  categories: Category | null;
  cost_price: number;
  sell_price: number;
  vat_inclusive: boolean;
  low_stock_threshold: number;
  is_active: boolean;
  stock_total: number;
  expiry_critical_days: number | null;
  expiry_warning_days: number | null;
}

interface Props {
  product: Product;
  index: number;
  onEdit: (product: Product) => void;
}

export function ProductCard({ product, index, onEdit }: Props) {
  const t = useTranslations('Products');
  const [isPending, startTransition] = useTransition();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const isLowStock = product.stock_total <= product.low_stock_threshold && product.low_stock_threshold > 0;

  function handleToggleActive() {
    startTransition(async () => {
      const res = await toggleActive(product.id, !product.is_active);
      if (!res.ok) toast.error(res.error);
    });
  }

  function handleDelete() {
    if (!showDeleteConfirm) {
      setShowDeleteConfirm(true);
      setTimeout(() => setShowDeleteConfirm(false), 3000);
      return;
    }
    startTransition(async () => {
      const res = await deleteProduct(product.id);
      if (res.ok) toast.success(t('deleteSuccess'));
      else toast.error(res.error);
    });
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1], delay: index * 0.04 }}
      className={`relative rounded-xl border bg-card p-4 shadow-sm transition-opacity ${
        !product.is_active ? 'opacity-60' : ''
      } ${isPending ? 'pointer-events-none opacity-50' : ''}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="font-semibold text-sm truncate">{product.name}</span>
            <Badge variant={product.unit === 'kg' ? 'secondary' : 'outline'} className="text-xs shrink-0">
              {product.unit === 'kg' ? t('unitKg') : t('unitPcs')}
            </Badge>
            {!product.is_active && (
              <Badge variant="secondary" className="text-xs shrink-0">
                {t('inactive')}
              </Badge>
            )}
          </div>

          {product.barcode && (
            <p className="text-xs text-muted-foreground font-mono mb-2">{product.barcode}</p>
          )}

          {product.categories && (
            <p className="text-xs text-muted-foreground mb-2">{product.categories.name}</p>
          )}

          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-baseline gap-1">
              <span className="text-base font-bold tabular-nums">{formatAED(product.sell_price)}</span>
              {product.vat_inclusive && (
                <span className="text-xs text-muted-foreground">{t('vatIncl')}</span>
              )}
            </div>

            <div className={`flex items-center gap-1 text-xs rounded-full px-2 py-0.5 ${
              isLowStock
                ? 'bg-destructive/10 text-destructive'
                : 'bg-muted text-muted-foreground'
            }`}>
              {isLowStock && <span className="w-1.5 h-1.5 rounded-full bg-destructive inline-block" />}
              <span className="tabular-nums">{formatQty(product.stock_total, product.unit)}</span>
            </div>
          </div>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onEdit(product)}>
              <Pencil className="h-4 w-4 me-2" />
              {t('edit')}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleToggleActive}>
              {product.is_active
                ? <><ToggleLeft className="h-4 w-4 me-2" />{t('deactivate')}</>
                : <><ToggleRight className="h-4 w-4 me-2" />{t('activate')}</>
              }
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={handleDelete}
              className={showDeleteConfirm ? 'text-destructive focus:text-destructive' : ''}
            >
              <Trash2 className="h-4 w-4 me-2" />
              {showDeleteConfirm ? t('confirmDelete') : t('delete')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </motion.div>
  );
}
