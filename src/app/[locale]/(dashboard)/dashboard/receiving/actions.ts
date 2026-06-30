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

// Returns the ID of the "Initial Stock" supplier, creating it if it doesn't exist.
export async function getOrCreateInitialStockSupplier(): Promise<string | null> {
  const supabase = await createServerClient();
  const { data: tenantIds } = await supabase.rpc('auth_tenant_ids');
  const tenantId: string | null = (tenantIds as string[] | null)?.[0] ?? null;
  if (!tenantId) return null;

  const SUPPLIER_NAME = 'مخزون افتتاحي';

  const { data: existing } = await supabase
    .from('suppliers')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('name', SUPPLIER_NAME)
    .maybeSingle();

  if (existing?.id) return existing.id;

  const { data: created } = await supabase
    .from('suppliers')
    .insert({ name: SUPPLIER_NAME, tenant_id: tenantId })
    .select('id')
    .single();

  return created?.id ?? null;
}
