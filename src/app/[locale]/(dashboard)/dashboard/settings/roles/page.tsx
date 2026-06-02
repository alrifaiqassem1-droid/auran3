import { getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { getRolesAndStaff } from './actions';
import { RolesClient } from '@/components/settings/roles-client';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Roles' });
  return { title: t('pageTitle') };
}

export default async function RolesPage() {
  const supabase = await createServerClient();
  const { data: tenantIds } = await supabase.rpc('auth_tenant_ids');
  const tenantId: string | undefined = tenantIds?.[0];
  if (!tenantId) redirect('/dashboard');

  const { data: membership } = await supabase
    .from('memberships')
    .select('role')
    .eq('tenant_id', tenantId)
    .single();

  if (membership?.role !== 'owner') redirect('/dashboard');

  const data = await getRolesAndStaff();
  if (!data) redirect('/dashboard');

  return (
    <div className="container max-w-3xl px-4 py-6">
      <RolesClient
        initialRoles={data.roles}
        initialStaff={data.staff}
        initialInvitations={data.invitations}
      />
    </div>
  );
}
