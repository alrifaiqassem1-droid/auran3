'use server';

import { revalidatePath } from 'next/cache';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { logAudit } from '@/lib/audit';

export interface CsvProductRow {
  name: string;
  barcode: string;
  category: string;
  cost_price: number;
  sell_price: number;
  vat_inclusive: boolean;
  unit: 'pcs' | 'kg';
}

export interface ImportSummary {
  inserted: number;
  createdCategories: number;
}

type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export async function importProductsCsv(
  rows: CsvProductRow[],
): Promise<ActionResult<ImportSummary>> {
  if (!rows.length) return { ok: false, error: 'empty' };

  const supabase = await createServerClient();

  const { data: tenantIds } = await supabase.rpc('auth_tenant_ids');
  const tenantId: string | null = (tenantIds as string[] | null)?.[0] ?? null;
  if (!tenantId) return { ok: false, error: 'session' };

  const { data: hasRole } = await supabase.rpc('has_role', {
    p_roles: ['owner', 'manager'],
    p_tenant: tenantId,
  });
  if (!hasRole) return { ok: false, error: 'forbidden' };

  // Load existing categories for this tenant
  const { data: existingCats } = await supabase
    .from('categories')
    .select('id, name')
    .eq('tenant_id', tenantId);

  const catMap = new Map<string, string>(
    (existingCats ?? []).map((c) => [c.name.toLowerCase().trim(), c.id]),
  );

  // Find unique new category names that don't exist yet
  const uniqueNewCatNames = [
    ...new Set(
      rows
        .map((r) => r.category.trim())
        .filter((n) => n !== '' && !catMap.has(n.toLowerCase())),
    ),
  ];

  // Create missing categories one by one (to get IDs)
  let createdCategories = 0;
  for (const catName of uniqueNewCatNames) {
    const { data: newCat } = await supabase
      .from('categories')
      .insert({
        name: catName,
        tenant_id: tenantId,
        default_critical_days: 7,
        default_warning_days: 30,
      })
      .select('id')
      .single();
    if (newCat) {
      catMap.set(catName.toLowerCase(), newCat.id);
      createdCategories++;
    }
  }

  // Build insert payload — tenant_id explicit for RLS
  const toInsert = rows.map((r) => ({
    name: r.name,
    barcode: r.barcode.trim() || null,
    category_id: r.category.trim()
      ? (catMap.get(r.category.toLowerCase().trim()) ?? null)
      : null,
    cost_price: r.cost_price,
    sell_price: r.sell_price,
    vat_inclusive: r.vat_inclusive,
    unit: r.unit,
    tenant_id: tenantId,
    is_active: true,
    low_stock_threshold: 0,
  }));

  const { data: inserted, error } = await supabase
    .from('products')
    .insert(toInsert)
    .select('id');

  if (error) return { ok: false, error: 'server' };

  revalidatePath('/dashboard/products');
  void logAudit({
    tenant_id: tenantId,
    action: 'create',
    entity: 'product',
    entity_id: tenantId,
    details: { csv_import: true, inserted: inserted?.length ?? 0, createdCategories },
  });

  return {
    ok: true,
    data: { inserted: inserted?.length ?? 0, createdCategories },
  };
}
