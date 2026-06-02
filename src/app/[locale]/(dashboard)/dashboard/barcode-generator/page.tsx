import { getTranslations } from 'next-intl/server';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { getProductsForCount } from '../count/actions';
import { BarcodeGeneratorClient } from '@/components/barcode/barcode-generator-client';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'BarcodeGenerator' });
  return { title: t('pageTitle') };
}

export default async function BarcodeGeneratorPage() {
  const supabase = await createServerClient();
  const { data: tenantIds } = await supabase.rpc('auth_tenant_ids');
  const tenantId: string | undefined = tenantIds?.[0];

  const [products, tenantRes] = await Promise.all([
    getProductsForCount(),
    tenantId
      ? supabase.from('tenants').select('name').eq('id', tenantId).single()
      : Promise.resolve({ data: null }),
  ]);

  return (
    <div className="container max-w-2xl px-4 py-6">
      <BarcodeGeneratorClient
        products={products}
        companyName={(tenantRes.data as { name: string } | null)?.name ?? ''}
      />
    </div>
  );
}
