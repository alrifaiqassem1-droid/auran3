import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { getSession } from '@/lib/auth/get-session';
import { AppShell } from '@/components/dashboard/app-shell';
import { ErrorBoundary } from '@/components/system/error-boundary';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, memberships } = await getSession();
  if (!user) redirect('/login');

  if (memberships.length === 0) {
    const t = await getTranslations('Dashboard');
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-3 p-6 text-center">
        <p className="text-xs font-black tracking-[0.3em] text-primary">AURAN</p>
        <h1 className="text-xl font-bold">{t('noPermission')}</h1>
        <p className="max-w-xs text-sm text-muted-foreground">{t('noPermissionDesc')}</p>
      </div>
    );
  }

  const name =
    (user.user_metadata?.full_name as string | undefined) ||
    user.email?.split('@')[0] ||
    'User';

  return (
    <ErrorBoundary>
      <AppShell user={{ name, id: user.id, email: user.email ?? '' }} memberships={memberships}>
        {children}
      </AppShell>
    </ErrorBoundary>
  );
}
