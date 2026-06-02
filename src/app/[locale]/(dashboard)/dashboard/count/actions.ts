'use server';

import { createClient as createServerClient } from '@/lib/supabase/server';
import { upsertCountItemSchema } from '@/lib/validators/count';
import { rpcOpenCount, rpcUpsertCountItem } from '@/lib/supabase/typed-rpc';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CountProduct {
  id: string;
  name: string;
  unit: string;
  barcode: string | null;
  cost_price: number;
}

export interface CountItemRow {
  id: string;
  product_id: string;
  product_name: string;
  product_unit: string;
  product_barcode: string | null;
  product_cost: number;
  expected_qty: number;
  counted_qty: number;
}

export interface CountSessionSummary {
  id: string;
  status: string;
  created_at: string;
  closed_at: string | null;
}

export interface CountSessionDetail extends CountSessionSummary {
  branch_id: string;
  items: CountItemRow[];
}

// ─── Queries ─────────────────────────────────────────────────────────────────

export async function getProductsForCount(): Promise<CountProduct[]> {
  const supabase = await createServerClient();
  const { data: tenantIds } = await supabase.rpc('auth_tenant_ids');
  const tenantId: string | undefined = tenantIds?.[0];
  if (!tenantId) return [];

  const { data } = await supabase
    .from('products')
    .select('id, name, unit, barcode, cost_price')
    .eq('tenant_id', tenantId)
    .eq('is_active', true)
    .order('name');
  return (data as CountProduct[]) ?? [];
}

export async function getCountSessions(): Promise<CountSessionSummary[]> {
  const supabase = await createServerClient();
  const { data: tenantIds } = await supabase.rpc('auth_tenant_ids');
  const tenantId: string | undefined = tenantIds?.[0];
  if (!tenantId) return [];

  const { data } = await supabase
    .from('inventory_counts')
    .select('id, status, created_at, closed_at')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .limit(30);
  return (data as CountSessionSummary[]) ?? [];
}

export async function getCountSessionDetails(
  countId: string,
): Promise<CountSessionDetail | null> {
  const supabase = await createServerClient();

  const { data: session } = await supabase
    .from('inventory_counts')
    .select('id, status, created_at, closed_at, branch_id')
    .eq('id', countId)
    .single();
  if (!session) return null;

  const { data: items } = await supabase
    .from('inventory_count_items')
    .select('id, product_id, expected_qty, counted_qty, products(name, unit, barcode, cost_price)')
    .eq('count_id', countId)
    .order('created_at', { ascending: true });

  return {
    id: session.id,
    status: session.status,
    created_at: session.created_at,
    closed_at: session.closed_at,
    branch_id: session.branch_id,
    items: ((items ?? []) as unknown[]).map((item) => {
      const i = item as {
        id: string;
        product_id: string;
        expected_qty: number;
        counted_qty: number;
        products: { name: string; unit: string; barcode: string | null; cost_price: number } | null;
      };
      return {
        id: i.id,
        product_id: i.product_id,
        product_name: i.products?.name ?? '',
        product_unit: i.products?.unit ?? 'pcs',
        product_barcode: i.products?.barcode ?? null,
        product_cost: i.products?.cost_price ?? 0,
        expected_qty: Number(i.expected_qty),
        counted_qty: Number(i.counted_qty),
      };
    }),
  };
}

// ─── Mutations ────────────────────────────────────────────────────────────────

export async function openCount(
  branchId: string,
): Promise<{ ok: boolean; countId?: string; error?: string }> {
  const supabase = await createServerClient();
  const { data, error } = await rpcOpenCount(supabase, branchId);
  if (error) return { ok: false, error: error.message };
  return { ok: true, countId: data ?? undefined };
}

export async function upsertCountItem(input: {
  count_id: string;
  product_id: string;
  counted_qty: number;
}): Promise<{ ok: boolean; expected_qty?: number; error?: string }> {
  const parsed = upsertCountItemSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message };
  }

  const supabase = await createServerClient();
  const { data, error } = await rpcUpsertCountItem(supabase, {
    count_id:   parsed.data.count_id,
    product_id: parsed.data.product_id,
    counted:    parsed.data.counted_qty,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true, expected_qty: data?.expected_qty };
}
