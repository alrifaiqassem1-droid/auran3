'use client';

import { useWatch } from 'react-hook-form';
import type { Control, FieldValues } from 'react-hook-form';
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { priceBreakdown, formatAED } from '@/lib/pricing';
import type { ProductFormValues } from '@/lib/validators/product';
import { useTranslations } from 'next-intl';

interface Props {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  control: Control<ProductFormValues, any>;
}

export function PriceVatFields({ control }: Props) {
  const t = useTranslations('Products');

  const sellPrice = useWatch({ control, name: 'sell_price' });
  const vatInclusive = useWatch({ control, name: 'vat_inclusive' });
  const costPrice = useWatch({ control, name: 'cost_price' });

  const breakdown = priceBreakdown(Number(sellPrice) || 0, 5, vatInclusive);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <FormField
          control={control}
          name="cost_price"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('costPrice')}</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  inputMode="decimal"
                  placeholder="0.00"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={control}
          name="sell_price"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('sellPrice')}</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  inputMode="decimal"
                  placeholder="0.00"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      <FormField
        control={control}
        name="vat_inclusive"
        render={({ field }) => (
          <FormItem className="flex items-center gap-3">
            <FormControl>
              <Switch
                checked={field.value}
                onCheckedChange={field.onChange}
              />
            </FormControl>
            <FormLabel className="!mt-0 cursor-pointer">{t('vatInclusive')}</FormLabel>
          </FormItem>
        )}
      />

      {(Number(sellPrice) || 0) > 0 && (
        <div className="rounded-lg border border-border/50 bg-muted/30 p-3 text-sm space-y-1">
          <p className="text-muted-foreground text-xs font-medium mb-2">{t('vatBreakdown')}</p>
          <div className="flex justify-between">
            <span className="text-muted-foreground">{t('net')}</span>
            <span className="font-mono tabular-nums">{formatAED(breakdown.net)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">{t('vat5')}</span>
            <span className="font-mono tabular-nums text-amber-600 dark:text-amber-400">{formatAED(breakdown.vat)}</span>
          </div>
          <div className="flex justify-between border-t border-border/50 pt-1 font-semibold">
            <span>{t('gross')}</span>
            <span className="font-mono tabular-nums">{formatAED(breakdown.gross)}</span>
          </div>
          {Number(costPrice) > 0 && (
            <div className="flex justify-between pt-1 text-xs text-muted-foreground">
              <span>{t('margin')}</span>
              <span className="font-mono tabular-nums">
                {(((breakdown.net - Number(costPrice)) / Number(costPrice)) * 100).toFixed(1)}%
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
