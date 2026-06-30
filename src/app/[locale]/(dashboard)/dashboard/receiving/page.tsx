import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { Warehouse } from 'lucide-react';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { getBranchContext } from '@/lib/auth/branch-context';
import { ReceiveCart } from '@/components/receiving/receive-cart';
import { ReceiptsHistory } from '@/components/receiving/receipts-history';
import { InitialStockSection } from '@/components/receiving/initial-stock-section';
import { getOrCreateInitialStockSupplier } from './actions';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Receiving' });
  return { title: t('pageTitle') };
}

export default async function ReceivingPage({
  searchParams,
}: {
  searchParams: Promise<{ barcode?: string; initial?: string }>;
}) {
  const { barcode, initial } = await searchParams;
  const isInitialMode = initial === 'true';

  const [ctx, supabase] = await Promise.all([getBranchContext(), createServerClient()]);
  const tenantId       = ctx?.tenantId;
  const activeBranchId = ctx?.activeBranchId;

  const empty = Promise.resolve({ data: [] });

  const receiptsQ = tenantId
    ? (() => {
        const q = supabase
          .from('goods_receipts')
          .select('id, reference, total_cost, created_at, supplier_id, suppliers(name), goods_receipt_items(id)')
          .eq('tenant_id', tenantId)
          .order('created_at', { ascending: false })
          .limit(50);
        return activeBranchId ? q.eq('branch_id', activeBranchId) : q;
      })()
    : empty;

  const [suppliersRes, categoriesRes, productsRes, receiptsRes] = await Promise.all([
    tenantId
      ? supabase.from('suppliers').select('id, name').eq('tenant_id', tenantId).order('name')
      : empty,
    tenantId
      ? supabase.from('categories').select('id, name').eq('tenant_id', tenantId).order('name')
      : empty,
    tenantId
      ? supabase
          .from('products')
          .select('id, name, unit, barcode, cost_price')
          .eq('tenant_id', tenantId)
          .eq('is_active', true)
          .order('name')
      : empty,
    receiptsQ,
  ]);

  // Resolve initial stock supplier when in initial mode
  let initialSupplierId: string | undefined;
  let initialReference: string | undefined;

  if (isInitialMode) {
    const suppId = await getOrCreateInitialStockSupplier();
    if (suppId) initialSupplierId = suppId;

    const dateStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Dubai' }).format(new Date());
    initialReference = `مخزون افتتاحي - ${dateStr}`;
  }

  const t = await getTranslations('Receiving');

  type ReceiptRow = {
    id: string;
    reference: string | null;
    total_cost: number;
    created_at: string;
    supplier_id: string | null;
    suppliers: { name: string } | null;
    goods_receipt_items: { id: string }[];
  };

  const receipts = (receiptsRes.data ?? []) as unknown as ReceiptRow[];

  const suppliers  = (suppliersRes.data as { id: string; name: string }[]) ?? [];
  const categories = (categoriesRes.data as { id: string; name: string }[]) ?? [];
  const products   = (productsRes.data as {
    id: string; name: string; unit: 'pcs' | 'kg'; barcode: string | null; cost_price: number;
  }[]) ?? [];

  return (
    <div className="container max-w-2xl px-4 py-6">
      {/* ── Page header ── */}
      <div className="mb-6 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{t('pageTitle')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('pageSubtitle')}</p>
        </div>

        {/* Show "Initial Stock" button only in normal mode */}
        {!isInitialMode && (
          <Link href="?initial=true" className="shrink-0 mt-1">
            <span className="inline-flex items-center gap-1.5 rounded-xl border border-border/60 bg-muted/40 px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
              <Warehouse className="h-3.5 w-3.5" />
              {t('initialStockBtn')}
            </span>
          </Link>
        )}
      </div>

      {/* ── Initial stock banner (only in initial mode) ── */}
      {isInitialMode && initialSupplierId && (
        <InitialStockSection
          products={products}
          supplierId={initialSupplierId}
          reference={initialReference ?? ''}
        />
      )}

      {/* ── Receive cart — key resets state when switching modes ── */}
      <ReceiveCart
        key={isInitialMode ? 'initial' : 'normal'}
        suppliers={suppliers}
        categories={categories}
        products={products}
        initialBarcode={barcode ?? null}
        initialSupplierId={initialSupplierId}
        initialReference={initialReference}
      />

      <ReceiptsHistory receipts={receipts} />
    </div>
  );
}
