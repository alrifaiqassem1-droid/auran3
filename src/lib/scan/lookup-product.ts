import { createClient } from '@/lib/supabase/client';
import type { Product } from '@/types/db';

export async function lookupProduct(
  barcode: string,
  tenantId: string
): Promise<Product | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('barcode', barcode)
    .eq('tenant_id', tenantId)
    .eq('is_active', true)
    .maybeSingle();

  if (error || !data) return null;
  return data as Product;
}
