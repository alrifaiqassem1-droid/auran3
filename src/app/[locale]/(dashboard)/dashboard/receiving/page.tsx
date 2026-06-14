import { getTranslations } from 'next-intl/server';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { getBranchContext } from '@/lib/auth/branch-context';
import { ReceiveCart } from '@/components/receiving/receive-cart';
import { ReceiptsHistory } from '@/components/receiving/receipts-history';

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
  searchParams: Promise<{ barcode?: string }>;
}) {
  const { barcode } = await searchParams;
  const [ctx, supabase] = await Promise.all([getBranchContext(), createServerClient()]);
  const tenantId = ctx?.tenantId;
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

  return (
    <div className="container max-w-2xl px-4 py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">{t('pageTitle')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('pageSubtitle')}</p>
      </div>

      <ReceiveCart
        suppliers={(suppliersRes.data as { id: string; name: string }[]) ?? []}
        categories={(categoriesRes.data as { id: string; name: string }[]) ?? []}
        products={
          (productsRes.data as {
            id: string;
            name: string;
            unit: 'pcs' | 'kg';
            barcode: string | null;
            cost_price: number;
          }[]) ?? []
        }
        initialBarcode={barcode ?? null}
      />

      <ReceiptsHistory receipts={receipts} />
    </div>
  );
}
