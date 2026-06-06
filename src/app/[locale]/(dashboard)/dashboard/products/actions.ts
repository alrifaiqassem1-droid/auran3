'use server';

import { revalidatePath } from 'next/cache';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { productSchema } from '@/lib/validators/product';
import type { ProductFormValues } from '@/lib/validators/product';
import { logAudit } from '@/lib/audit';

type ActionResult<T = undefined> =
  | { ok: true; data?: T; error?: never }
  | { ok: false; error: string; data?: never };

async function getTenantId(supabase: Awaited<ReturnType<typeof createServerClient>>): Promise<string | null> {
  const { data } = await supabase.rpc('auth_tenant_ids');
  return data?.[0] ?? null;
}

async function hasManagerRole(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
  tenantId: string,
): Promise<boolean> {
  const { data } = await supabase.rpc('has_role', {
    p_roles: ['owner', 'manager'],
    p_tenant: tenantId,
  });
  return data === true;
}

export async function createProduct(
  values: ProductFormValues,
): Promise<ActionResult<{ id: string }>> {
  const parsed = productSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'بيانات غير صحيحة' };
  }

  const supabase = await createServerClient();
  const tenantId = await getTenantId(supabase);
  if (!tenantId) return { ok: false, error: 'جلسة غير صالحة' };

  if (!(await hasManagerRole(supabase, tenantId))) {
    return { ok: false, error: 'لا تملك الصلاحية لإضافة منتجات' };
  }

  const { name, barcode, unit, category_id, cost_price, sell_price, vat_inclusive, low_stock_threshold, is_active } = parsed.data;

  const { data, error } = await supabase
    .from('products')
    .insert({
      name,
      barcode: barcode || null,
      unit,
      category_id: category_id || null,
      cost_price,
      sell_price,
      vat_inclusive,
      low_stock_threshold,
      is_active,
      tenant_id: tenantId,
    })
    .select('id')
    .single();

  if (error) {
    return { ok: false, error: 'فشل إنشاء المنتج' };
  }

  revalidatePath('/dashboard/products');
  void logAudit({ tenant_id: tenantId, action: 'create', entity: 'product', entity_id: data.id, details: { name: parsed.data.name } });
  return { ok: true, data: { id: data.id } };
}

export async function updateProduct(
  id: string,
  values: ProductFormValues,
): Promise<ActionResult> {
  const parsed = productSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'بيانات غير صحيحة' };
  }

  const supabase = await createServerClient();
  const tenantId = await getTenantId(supabase);
  if (!tenantId) return { ok: false, error: 'جلسة غير صالحة' };

  if (!(await hasManagerRole(supabase, tenantId))) {
    return { ok: false, error: 'لا تملك الصلاحية لتعديل المنتجات' };
  }

  const { name, barcode, unit, category_id, cost_price, sell_price, vat_inclusive, low_stock_threshold, is_active } = parsed.data;

  const { error } = await supabase
    .from('products')
    .update({
      name,
      barcode: barcode || null,
      unit,
      category_id: category_id || null,
      cost_price,
      sell_price,
      vat_inclusive,
      low_stock_threshold,
      is_active,
    })
    .eq('id', id)
    .eq('tenant_id', tenantId);

  if (error) {
    return { ok: false, error: 'فشل تحديث المنتج' };
  }

  revalidatePath('/dashboard/products');
  revalidatePath(`/dashboard/products/${id}`);
  void logAudit({ tenant_id: tenantId, action: 'update', entity: 'product', entity_id: id, details: { name: parsed.data.name } });
  return { ok: true };
}

export async function toggleActive(
  id: string,
  isActive: boolean,
): Promise<ActionResult> {
  const supabase = await createServerClient();
  const tenantId = await getTenantId(supabase);
  if (!tenantId) return { ok: false, error: 'جلسة غير صالحة' };

  if (!(await hasManagerRole(supabase, tenantId))) {
    return { ok: false, error: 'لا تملك الصلاحية' };
  }

  const { error } = await supabase
    .from('products')
    .update({ is_active: isActive })
    .eq('id', id)
    .eq('tenant_id', tenantId);

  if (error) return { ok: false, error: 'فشل تحديث الحالة' };

  revalidatePath('/dashboard/products');
  return { ok: true };
}

export async function updateProductPrice(
  id: string,
  sellPrice: number,
): Promise<ActionResult> {
  if (!id || sellPrice <= 0) return { ok: false, error: 'بيانات غير صحيحة' };

  const supabase = await createServerClient();
  const tenantId = await getTenantId(supabase);
  if (!tenantId) return { ok: false, error: 'جلسة غير صالحة' };

  if (!(await hasManagerRole(supabase, tenantId))) {
    return { ok: false, error: 'لا تملك الصلاحية لتعديل الأسعار' };
  }

  const { error } = await supabase
    .from('products')
    .update({ sell_price: sellPrice })
    .eq('id', id)
    .eq('tenant_id', tenantId);

  if (error) return { ok: false, error: 'فشل تحديث السعر' };

  revalidatePath('/dashboard/products');
  revalidatePath(`/dashboard/products/${id}`);
  void logAudit({ tenant_id: tenantId, action: 'update', entity: 'product', entity_id: id, details: { sell_price: sellPrice } });
  return { ok: true };
}

export async function deleteProduct(id: string): Promise<ActionResult> {
  const supabase = await createServerClient();
  const tenantId = await getTenantId(supabase);
  if (!tenantId) return { ok: false, error: 'جلسة غير صالحة' };

  if (!(await hasManagerRole(supabase, tenantId))) {
    return { ok: false, error: 'لا تملك الصلاحية لحذف المنتجات' };
  }

  const { error } = await supabase
    .from('products')
    .delete()
    .eq('id', id)
    .eq('tenant_id', tenantId);

  if (error) {
    return { ok: false, error: 'فشل حذف المنتج' };
  }

  revalidatePath('/dashboard/products');
  void logAudit({ tenant_id: tenantId, action: 'delete', entity: 'product', entity_id: id });
  return { ok: true };
}
