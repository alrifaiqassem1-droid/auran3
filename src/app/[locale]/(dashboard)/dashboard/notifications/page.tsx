import { getTranslations } from 'next-intl/server';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { NotificationsClient } from '@/components/notifications/notifications-client';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Notifications' });
  return { title: t('title') };
}

export default async function NotificationsPage() {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from('notifications')
    .select('id, type, title, body, is_read, created_at')
    .or(`user_id.eq.${user.id},user_id.is.null`)
    .order('created_at', { ascending: false })
    .limit(100);

  return (
    <div className="container max-w-2xl px-4 py-6">
      <NotificationsClient
        userId={user.id}
        initialItems={(data ?? []) as Parameters<typeof NotificationsClient>[0]['initialItems']}
      />
    </div>
  );
}
