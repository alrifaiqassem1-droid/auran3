import { getTranslations } from 'next-intl/server';
import { ExpiryClient } from '@/components/expiry/expiry-client';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Expiry' });
  return { title: t('pageTitle') };
}

export default function ExpiryPage() {
  return <ExpiryClient />;
}
