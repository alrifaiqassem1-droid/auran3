import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { getCountSessionDetails, getProductsForCount } from '../actions';
import { CountSession } from '@/components/count/count-session';
import { CountSummary } from '@/components/count/count-summary';
import { getSession } from '@/lib/auth/get-session';
import type { CountItemRow } from '../actions';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Count' });
  return { title: t('sessionTitle') };
}

export default async function CountSessionPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { id } = await params;

  const sessionData = await getSession();
  const membership = sessionData?.memberships?.[0];
  const canSeeExpected = membership?.role === 'owner' || membership?.role === 'manager';

  const [session, products] = await Promise.all([
    getCountSessionDetails(id),
    getProductsForCount(),
  ]);

  if (!session) notFound();

  // Closed session — show static summary
  if (session.status === 'closed') {
    const t = await getTranslations('Count');
    return (
      <div className="container max-w-2xl px-4 py-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">{t('summaryTitle')}</h1>
          <p className="mt-1 text-sm text-muted-foreground tabular-nums">
            {new Intl.DateTimeFormat('en-US', {
              day: '2-digit',
              month: 'short',
              year: 'numeric',
              timeZone: 'Asia/Dubai',
            }).format(new Date(session.created_at))}
          </p>
        </div>
        <CountSummary items={session.items as CountItemRow[]} />
      </div>
    );
  }

  // Open session — live count UI
  return (
    <CountSession
      countId={session.id}
      initialItems={session.items as CountItemRow[]}
      products={products}
      branchId={session.branch_id}
      canSeeExpected={canSeeExpected}
    />
  );
}
