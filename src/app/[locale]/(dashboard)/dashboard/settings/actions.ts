'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

const profileSchema = z.object({
  fullName: z.string().min(1, 'الاسم مطلوب').max(100, 'الاسم طويل جداً'),
  phone:    z.string().max(20, 'رقم الهاتف طويل جداً').optional(),
});

const tenantSchema = z.object({
  name: z.string().min(1, 'اسم الشركة مطلوب').max(80, 'اسم الشركة طويل جداً'),
  trn:  z.string().max(20, 'رقم التسجيل طويل جداً').optional(),
});

type ActionResult = { ok: true } | { ok: false; error: string };

async function getAuthenticatedUser(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;
  return user;
}

async function getOwnerTenantId(supabase: Awaited<ReturnType<typeof createClient>>): Promise<string | null> {
  const { data: tenantIds } = await supabase.rpc('auth_tenant_ids');
  const tenantId = tenantIds?.[0] ?? null;
  if (!tenantId) return null;
  const { data } = await supabase.rpc('has_role', { p_roles: ['owner'], p_tenant: tenantId });
  return data === true ? tenantId : null;
}

export async function updateProfile(
  fullName: string,
  phone: string,
): Promise<ActionResult> {
  const parsed = profileSchema.safeParse({ fullName, phone: phone.trim() || undefined });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'بيانات غير صالحة' };

  const supabase = await createClient();
  const user = await getAuthenticatedUser(supabase);
  if (!user) return { ok: false, error: 'جلسة غير صالحة' };

  const { error } = await supabase
    .from('profiles')
    .upsert({ id: user.id, full_name: parsed.data.fullName.trim(), phone: parsed.data.phone?.trim() ?? '' });

  if (error) return { ok: false, error: 'فشل حفظ الملف الشخصي' };

  revalidatePath('/dashboard/settings');
  return { ok: true };
}

export async function updateTenant(
  name: string,
  trn: string,
): Promise<ActionResult> {
  const parsed = tenantSchema.safeParse({ name, trn: trn.trim() || undefined });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'بيانات غير صالحة' };

  const supabase = await createClient();
  const user = await getAuthenticatedUser(supabase);
  if (!user) return { ok: false, error: 'جلسة غير صالحة' };

  const tenantId = await getOwnerTenantId(supabase);
  if (!tenantId) return { ok: false, error: 'لا تملك الصلاحية لتعديل بيانات الشركة' };

  const { error } = await supabase
    .from('tenants')
    .update({ name: parsed.data.name.trim(), trn: parsed.data.trn?.trim() ?? null })
    .eq('id', tenantId);

  if (error) return { ok: false, error: 'فشل حفظ بيانات الشركة' };

  revalidatePath('/dashboard/settings');
  return { ok: true };
}
