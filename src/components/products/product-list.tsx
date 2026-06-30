'use client';

import { useState, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { Search, Plus, PackageOpen, FileUp } from 'lucide-react';
import { motion } from 'framer-motion';

import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';

import { ProductCard } from './product-card';
import { ProductForm } from './product-form';
import { ProductImportDialog } from './product-import-dialog';

interface Category {
  id: string;
  name: string;
  default_critical_days?: number;
  default_warning_days?: number;
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
  products: Product[];
  categories: Category[];
}

export function ProductList({ products, categories }: Props) {
  const t = useTranslations('Products');
  const tImport = useTranslations('ProductImport');

  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterUnit, setFilterUnit] = useState('all');

  const [formOpen, setFormOpen] = useState(false);
  const [editProduct, setEditProduct] = useState<Product | undefined>(undefined);
  const [importOpen, setImportOpen] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((p) => {
      if (q && !p.name.toLowerCase().includes(q) && !(p.barcode ?? '').toLowerCase().includes(q)) return false;
      if (filterCategory !== 'all' && p.category_id !== filterCategory) return false;
      if (filterStatus === 'active' && !p.is_active) return false;
      if (filterStatus === 'inactive' && p.is_active) return false;
      if (filterUnit !== 'all' && p.unit !== filterUnit) return false;
      return true;
    });
  }, [products, search, filterCategory, filterStatus, filterUnit]);

  function openAdd() {
    setEditProduct(undefined);
    setFormOpen(true);
  }

  function openEdit(p: Product) {
    setEditProduct(p);
    setFormOpen(true);
  }

  return (
    <>
      <div className="flex items-center gap-2 mb-4">
        <div className="relative flex-1">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            className="ps-9"
            placeholder={t('searchPlaceholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setImportOpen(true)}
          className="gap-1 shrink-0"
        >
          <FileUp className="h-4 w-4" />
          <span className="hidden sm:inline">{tImport('importCsv')}</span>
        </Button>
        <Button size="sm" onClick={openAdd} className="gap-1 shrink-0">
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">{t('addProduct')}</span>
        </Button>
      </div>

      <div className="flex gap-2 mb-4 flex-wrap">
        <Select value={filterCategory} onValueChange={setFilterCategory}>
          <SelectTrigger className="h-8 text-xs w-36">
            <SelectValue placeholder={t('allCategories')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('allCategories')}</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="h-8 text-xs w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('allStatus')}</SelectItem>
            <SelectItem value="active">{t('active')}</SelectItem>
            <SelectItem value="inactive">{t('inactive')}</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filterUnit} onValueChange={setFilterUnit}>
          <SelectTrigger className="h-8 text-xs w-28">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('allUnits')}</SelectItem>
            <SelectItem value="pcs">{t('unitPcs')}</SelectItem>
            <SelectItem value="kg">{t('unitKg')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center justify-center py-16 text-center"
        >
          <PackageOpen className="h-12 w-12 text-muted-foreground/40 mb-4" />
          <p className="text-muted-foreground mb-4">
            {products.length === 0 ? t('noProducts') : t('noResults')}
          </p>
          {products.length === 0 && (
            <Button onClick={openAdd} variant="outline" size="sm">
              <Plus className="h-4 w-4 me-2" />
              {t('addFirstProduct')}
            </Button>
          )}
        </motion.div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((p, i) => (
            <ProductCard key={p.id} product={p} index={i} onEdit={openEdit} />
          ))}
        </div>
      )}

      <ProductForm
        open={formOpen}
        onOpenChange={setFormOpen}
        product={editProduct}
        categories={categories}
      />

      <ProductImportDialog open={importOpen} onOpenChange={setImportOpen} />

      {/* FAB for mobile */}
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ delay: 0.3, type: 'spring', stiffness: 260, damping: 20 }}
        className="fixed bottom-24 end-4 sm:hidden z-40"
      >
        <Button
          size="icon"
          className="h-14 w-14 rounded-full shadow-lg"
          onClick={openAdd}
        >
          <Plus className="h-6 w-6" />
        </Button>
      </motion.div>
    </>
  );
}

export function ProductListSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Skeleton className="h-10 flex-1" />
        <Skeleton className="h-10 w-20" />
      </div>
      <div className="flex gap-2">
        <Skeleton className="h-8 w-36" />
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-8 w-28" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-xl" />
        ))}
      </div>
    </div>
  );
}
