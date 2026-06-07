import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/get-session';
import { AppShell } from '@/components/dashboard/app-shell';
import { ErrorBoundary } from '@/components/system/error-boundary';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, memberships } = await getSession();
  if (!user) redirect('/login');

  if (memberships.length === 0) {
    redirect('/auth/onboarding');
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
