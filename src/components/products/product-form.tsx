'use client';

import { useEffect, useTransition } from 'react';
import { useForm, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { useTranslations } from 'next-intl';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';

import { productSchema, type ProductFormValues } from '@/lib/validators/product';
import { createProduct, updateProduct } from '@/app/[locale]/(dashboard)/dashboard/products/actions';
import { PriceVatFields } from './price-vat-fields';
import { CategorySelect } from './category-select';

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
  cost_price: number;
  sell_price: number;
  vat_inclusive: boolean;
  low_stock_threshold: number;
  is_active: boolean;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product?: Product;
  categories: Category[];
  prefillBarcode?: string;
  variant?: 'dialog' | 'sheet';
}

export function ProductForm({ open, onOpenChange, product, categories, prefillBarcode, variant = 'dialog' }: Props) {
  const t = useTranslations('Products');
  const [isPending, startTransition] = useTransition();

  const form = useForm<ProductFormValues>({
    resolver: zodResolver(productSchema) as Resolver<ProductFormValues>,
    defaultValues: {
      name: '',
      barcode: prefillBarcode ?? '',
      unit: 'pcs',
      category_id: '',
      cost_price: 0,
      sell_price: 0,
      vat_inclusive: true,
      low_stock_threshold: 0,
      is_active: true,
    },
  });

  useEffect(() => {
    if (product) {
      form.reset({
        name: product.name,
        barcode: product.barcode ?? '',
        unit: product.unit,
        category_id: product.category_id ?? '',
        cost_price: product.cost_price,
        sell_price: product.sell_price,
        vat_inclusive: product.vat_inclusive,
        low_stock_threshold: product.low_stock_threshold,
        is_active: product.is_active,
      });
    } else if (open) {
      form.reset({
        name: '',
        barcode: prefillBarcode ?? '',
        unit: 'pcs',
        category_id: '',
        cost_price: 0,
        sell_price: 0,
        vat_inclusive: true,
        low_stock_threshold: 0,
        is_active: true,
      });
    }
  }, [product, open, prefillBarcode, form]);

  function onSubmit(values: ProductFormValues) {
    startTransition(async () => {
      const res = product
        ? await updateProduct(product.id, values)
        : await createProduct(values);

      if (res.ok) {
        toast.success(product ? t('updateSuccess') : t('createSuccess'));
        onOpenChange(false);
      } else {
        toast.error(res.error);
      }
    });
  }

  const formBody = (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
    >
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-2">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('name')}</FormLabel>
                <FormControl>
                  <Input placeholder={t('namePlaceholder')} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="grid grid-cols-2 gap-3">
            <FormField
              control={form.control}
              name="barcode"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('barcode')}</FormLabel>
                  <FormControl>
                    <Input placeholder={t('barcodePlaceholder')} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="unit"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('unit')}</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="pcs">{t('unitPcs')}</SelectItem>
                      <SelectItem value="kg">{t('unitKg')}</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="category_id"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('category')}</FormLabel>
                <FormControl>
                  <CategorySelect
                    categories={categories}
                    value={field.value ?? ''}
                    onChange={field.onChange}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <PriceVatFields control={form.control} />

          <FormField
            control={form.control}
            name="low_stock_threshold"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('lowStockThreshold')}</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    step="0.001"
                    min="0"
                    inputMode="decimal"
                    placeholder="0"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="is_active"
            render={({ field }) => (
              <FormItem className="flex items-center gap-3">
                <FormControl>
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </FormControl>
                <FormLabel className="!mt-0 cursor-pointer">{t('isActive')}</FormLabel>
              </FormItem>
            )}
          />

          <div className="flex gap-2 pt-2">
            <Button type="submit" className="flex-1" disabled={isPending}>
              {isPending ? t('saving') : product ? t('saveChanges') : t('addProduct')}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              {t('cancel')}
            </Button>
          </div>
        </form>
      </Form>
    </motion.div>
  );

  if (variant === 'sheet') {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" className="rounded-t-[24px] max-h-[90dvh] overflow-y-auto pb-safe">
          <SheetHeader className="mb-2">
            <SheetTitle>
              {product ? t('editProduct') : t('addProduct')}
            </SheetTitle>
          </SheetHeader>
          {formBody}
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {product ? t('editProduct') : t('addProduct')}
          </DialogTitle>
        </DialogHeader>
        {formBody}
      </DialogContent>
    </Dialog>
  );
}
