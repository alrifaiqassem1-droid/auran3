import { getTranslations } from 'next-intl/server';
import { getCountSessions } from './actions';
import { CountListClient } from '@/components/count/count-list-client';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Count' });
  return { title: t('pageTitle') };
}

export default async function CountPage() {
  const [t, sessions] = await Promise.all([
    getTranslations('Count'),
    getCountSessions(),
  ]);

  return (
    <div className="container max-w-2xl px-4 py-6">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{t('pageTitle')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('pageSubtitle')}</p>
        </div>
      </div>

      <CountListClient sessions={sessions} />
    </div>
  );
}
