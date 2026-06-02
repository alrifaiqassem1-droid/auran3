'use server';

import { createClient as createServerClient } from '@/lib/supabase/server';

export async function getSuppliers(): Promise<{ id: string; name: string }[]> {
  const supabase = await createServerClient();
  const { data: tenantIds } = await supabase.rpc('auth_tenant_ids');
  const tenantId: string | undefined = tenantIds?.[0];
  if (!tenantId) return [];

  const { data } = await supabase
    .from('suppliers')
    .select('id, name')
    .eq('tenant_id', tenantId)
    .order('name');
  return (data as { id: string; name: string }[]) ?? [];
}
