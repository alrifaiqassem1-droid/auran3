import { getTranslations } from 'next-intl/server';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { ReceiveCart } from '@/components/receiving/receive-cart';

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
  const supabase = await createServerClient();

  const { data: tenantIds } = await supabase.rpc('auth_tenant_ids');
  const tenantId: string | undefined = tenantIds?.[0];

  const empty = Promise.resolve({ data: [] });

  const [suppliersRes, categoriesRes, productsRes] = await Promise.all([
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
  ]);

  const t = await getTranslations('Receiving');

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
    </div>
  );
}
