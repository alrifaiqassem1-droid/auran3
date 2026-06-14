import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { getSession } from '@/lib/auth/get-session';
import { getBranches } from './actions';
import { BranchesClient } from '@/components/settings/branches-client';

type Props = { params: Promise<{ locale: string }> };

export default async function BranchesPage({ params }: Props) {
  const { locale } = await params;
  const { memberships } = await getSession();
  const m = memberships[0];

  if (!m || !['owner', 'manager'].includes(m.role)) {
    redirect(`/${locale}/dashboard/settings`);
  }

  const [branches, t] = await Promise.all([getBranches(), getTranslations('Settings')]);

  return (
    <main className="min-h-screen bg-background pb-24 px-4 pt-4">
      <div className="max-w-lg mx-auto space-y-6">
        <div>
          <h1 className="text-xl font-bold">{t('branches')}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t('branchesSubtitle')}</p>
        </div>
        <BranchesClient initialBranches={branches} isOwner={m.role === 'owner'} />
      </div>
    </main>
  );
}
