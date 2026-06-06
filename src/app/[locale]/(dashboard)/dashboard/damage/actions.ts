'use server';

import { createClient as createServerClient } from '@/lib/supabase/server';
import type { BatchLike } from '@/lib/stock/fefo';

export interface ProductOption {
  id: string;
  name: string;
  unit: string;
  barcode: string | null;
}

export async function getProductsForDamage(): Promise<ProductOption[]> {
  const supabase = await createServerClient();
  const { data: tenantIds } = await supabase.rpc('auth_tenant_ids');
  const tenantId: string | undefined = tenantIds?.[0];
  if (!tenantId) return [];

  const { data } = await supabase
    .from('products')
    .select('id, name, unit, barcode')
    .eq('tenant_id', tenantId)
    .eq('is_active', true)
    .order('name');
  return (data as ProductOption[]) ?? [];
}

export async function getBatchesForProduct(
  productId: string,
  branchId: string,
): Promise<BatchLike[]> {
  const supabase = await createServerClient();
  const { data: tenantIds } = await supabase.rpc('auth_tenant_ids');
  const tenantId: string | undefined = tenantIds?.[0];
  if (!tenantId) return [];

  const { data } = await supabase
    .from('stock_batches')
    .select('id, quantity, expiry_date, received_at')
    .eq('product_id', productId)
    .eq('branch_id', branchId)
    .eq('tenant_id', tenantId)
    .gt('quantity', 0)
    .order('expiry_date', { ascending: true, nullsFirst: false })
    .order('received_at', { ascending: true });

  return (data as BatchLike[]) ?? [];
}
