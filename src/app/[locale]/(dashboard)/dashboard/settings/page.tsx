import { getTranslations } from 'next-intl/server';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { SettingsClient } from '@/components/settings/settings-client';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Settings' });
  return { title: t('pageTitle') };
}

export default async function SettingsPage() {
  const supabase = await createServerClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: tenantIds } = await supabase.rpc('auth_tenant_ids');
  const tenantId: string | undefined = tenantIds?.[0];

  const [tenantRes, profileRes, membershipRes] = await Promise.all([
    tenantId
      ? supabase.from('tenants').select('id, name, trn, vat_rate').eq('id', tenantId).single()
      : Promise.resolve({ data: null }),
    supabase.from('profiles').select('full_name, phone').eq('id', user.id).single(),
    tenantId
      ? supabase.from('memberships').select('role').eq('user_id', user.id).eq('tenant_id', tenantId).single()
      : Promise.resolve({ data: null }),
  ]);

  return (
    <div className="container max-w-2xl px-4 py-6">
      <SettingsClient
        userId={user.id}
        email={user.email ?? ''}
        tenant={tenantRes.data as { id: string; name: string; trn: string | null; vat_rate: number } | null}
        profile={profileRes.data as { full_name: string | null; phone: string | null } | null}
        role={(membershipRes.data?.role as string) ?? 'staff'}
      />
    </div>
  );
}
