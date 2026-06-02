import { getTranslations } from 'next-intl/server';
import { getMatchableProducts } from './actions';
import { PosImportLazy } from '@/components/import/pos-import-lazy';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Import' });
  return { title: t('pageTitle') };
}

export default async function ImportPage() {
  const [t, products] = await Promise.all([
    getTranslations('Import'),
    getMatchableProducts(),
  ]);

  return (
    <div className="container max-w-2xl px-4 py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">{t('pageTitle')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('pageSubtitle')}</p>
      </div>
      <PosImportLazy products={products} />
    </div>
  );
}
