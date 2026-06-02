import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { getAuditLog } from './actions';
import { AuditClient } from '@/components/reports/audit-client';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Audit' });
  return { title: t('pageTitle') };
}

export default async function AuditPage() {
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

  const { entries } = await getAuditLog({}, 200);

  return (
    <div className="container max-w-4xl px-4 py-6">
      <AuditClient initialEntries={entries} />
    </div>
  );
}
