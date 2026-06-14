import { Suspense } from 'react';
import { getTranslations } from 'next-intl/server';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { getBranchContext } from '@/lib/auth/branch-context';
import { ProductList, ProductListSkeleton } from '@/components/products/product-list';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Products' });
  return { title: t('pageTitle') };
}

async function ProductsData() {
  const ctx = await getBranchContext();
  if (!ctx) {
    return <div className="text-center text-muted-foreground py-12">لا توجد بيانات</div>;
  }
  const { activeBranchId, tenantId } = ctx;

  const supabase = await createServerClient();

  const [{ data: products }, { data: categories }] = await Promise.all([
    supabase
      .from('products')
      .select(`
        id, name, barcode, unit, category_id,
        categories(id, name),
        cost_price, sell_price, vat_inclusive,
        low_stock_threshold, is_active,
        expiry_critical_days, expiry_warning_days
      `)
      .eq('tenant_id', tenantId)
      .order('name', { ascending: true }),
    supabase
      .from('categories')
      .select('id, name, default_critical_days, default_warning_days')
      .eq('tenant_id', tenantId)
      .order('name', { ascending: true }),
  ]);

  // حساب إجمالي المخزون لكل منتج — مُصفَّى حسب الفرع النشط
  const batchQ = supabase
    .from('stock_batches')
    .select('product_id, quantity')
    .eq('tenant_id', tenantId)
    .gt('quantity', 0);
  const { data: batches } = await (activeBranchId ? batchQ.eq('branch_id', activeBranchId) : batchQ);

  const stockMap: Record<string, number> = {};
  for (const b of batches ?? []) {
    stockMap[b.product_id] = (stockMap[b.product_id] ?? 0) + b.quantity;
  }

  const enriched = (products ?? []).map((p) => ({
    ...p,
    categories: Array.isArray(p.categories) ? p.categories[0] ?? null : (p.categories as { id: string; name: string } | null),
    stock_total: stockMap[p.id] ?? 0,
  }));

  return (
    <ProductList
      products={enriched as Parameters<typeof ProductList>[0]['products']}
      categories={categories ?? []}
    />
  );
}

export default async function ProductsPage() {
  const t = await getTranslations('Products');

  return (
    <div className="container max-w-5xl py-6 px-4">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">{t('pageTitle')}</h1>
        <p className="text-muted-foreground text-sm mt-1">{t('pageSubtitle')}</p>
      </div>
      <Suspense fallback={<ProductListSkeleton />}>
        <ProductsData />
      </Suspense>
    </div>
  );
}
