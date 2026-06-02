import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';

export type Membership = {
  tenant_id: string;
  branch_id: string | null;
  role: 'owner' | 'manager' | 'staff';
  tenant_name: string;
};

/** Shape returned by the Supabase join on memberships + tenants(name) */
interface MembershipRow {
  tenant_id: string;
  branch_id: string | null;
  role: 'owner' | 'manager' | 'staff';
  tenants: { name: string } | null;
}

export const getSession = cache(async () => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { user: null, memberships: [] as Membership[] };

  const { data: memberships } = await supabase
    .from('memberships')
    .select('tenant_id, branch_id, role, tenants(name)')
    .eq('user_id', user.id);

  const mapped: Membership[] = ((memberships ?? []) as MembershipRow[]).map((m) => ({
    tenant_id:   m.tenant_id,
    branch_id:   m.branch_id,
    role:        m.role,
    tenant_name: m.tenants?.name ?? '',
  }));
  return { user, memberships: mapped };
});
