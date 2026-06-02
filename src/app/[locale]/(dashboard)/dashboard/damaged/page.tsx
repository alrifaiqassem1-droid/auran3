import { getTranslations } from 'next-intl/server';
import { getProductsForDamage } from './actions';
import { DamageForm } from '@/components/damage/damage-form';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Damage' });
  return { title: t('pageTitle') };
}

export default async function DamagedPage({
  searchParams,
}: {
  searchParams: Promise<{ barcode?: string; product_id?: string }>;
}) {
  const { barcode, product_id } = await searchParams;
  const products = await getProductsForDamage();
  const t = await getTranslations('Damage');

  return (
    <div className="container max-w-xl px-4 py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">{t('pageTitle')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('pageSubtitle')}</p>
      </div>

      <DamageForm
        products={products}
        initialBarcode={barcode ?? null}
        initialProductId={product_id ?? null}
      />
    </div>
  );
}
