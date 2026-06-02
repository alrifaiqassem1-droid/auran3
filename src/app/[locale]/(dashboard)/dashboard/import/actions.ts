'use server';

import { createClient as createServerClient } from '@/lib/supabase/server';

export interface MatchableProduct {
  id: string;
  name: string;
  barcode: string | null;
  unit: string;
}

export async function getMatchableProducts(): Promise<MatchableProduct[]> {
  const supabase = await createServerClient();
  const { data: tenantIds } = await supabase.rpc('auth_tenant_ids');
  const tenantId: string | undefined = tenantIds?.[0];
  if (!tenantId) return [];

  const { data } = await supabase
    .from('products')
    .select('id, name, barcode, unit')
    .eq('tenant_id', tenantId)
    .eq('is_active', true)
    .order('name');
  return (data as MatchableProduct[]) ?? [];
}
