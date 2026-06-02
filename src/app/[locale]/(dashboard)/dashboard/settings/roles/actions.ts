'use server';

import { createClient as createServerClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { logAudit } from '@/lib/audit';
import { revalidatePath } from 'next/cache';

// ─── Types ────────────────────────────────────────────────────

export interface RolePermissions {
  products:  { view: boolean; add: boolean; edit: boolean; delete: boolean };
  receiving: { view: boolean; add: boolean };
  inventory: { view: boolean; add: boolean };
  damage:    { view: boolean; add: boolean };
  reports:   { view: boolean };
  prices:    { view: boolean };
  staff:     { view: boolean; add: boolean; edit: boolean; delete: boolean };
}

export interface CustomRole {
  id:          string;
  name:        string;
  permissions: RolePermissions;
  created_at:  string;
  member_count: number;
}

export interface StaffMember {
  id:             string;   // membership id
  user_id:        string;
  user_name:      string | null;
  user_email:     string | null;
  role:           string;   // owner/manager/staff
  custom_role_id: string | null;
  custom_role_name: string | null;
  joined_at:      string;
}

export interface Invitation {
  id:              string;
  email:           string;
  custom_role_id:  string | null;
  custom_role_name: string | null;
  default_role:    string;
  expires_at:      string;
  created_at:      string;
}

// ─── Helpers ──────────────────────────────────────────────────

async function getOwnerContext() {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: tenantIds } = await supabase.rpc('auth_tenant_ids');
  const tenantId: string | undefined = tenantIds?.[0];
  if (!tenantId) return null;

  // Verify owner role
  const { data: membership } = await supabase
    .from('memberships')
    .select('role')
    .eq('user_id', user.id)
    .eq('tenant_id', tenantId)
    .single();

  if (membership?.role !== 'owner') return null;
  return { supabase, tenantId, userId: user.id };
}

// ─── Queries ──────────────────────────────────────────────────

export async function getRolesAndStaff(): Promise<{
  roles: CustomRole[];
  staff: StaffMember[];
  invitations: Invitation[];
} | null> {
  const supabase = await createServerClient();
  const { data: tenantIds } = await supabase.rpc('auth_tenant_ids');
  const tenantId: string | undefined = tenantIds?.[0];
  if (!tenantId) return null;

  // custom_roles, invitations are new tables not yet in database.types.ts
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;

  const [rolesRes, membershipsRes, invRes] = await Promise.all([
    db.from('custom_roles').select('id, name, permissions, created_at').eq('tenant_id', tenantId).order('created_at'),
    db.from('memberships').select('id, user_id, role, custom_role_id, created_at, profiles(full_name), custom_roles(name)').eq('tenant_id', tenantId).order('created_at'),
    db.from('invitations').select('id, email, custom_role_id, default_role, expires_at, created_at, custom_roles(name)').eq('tenant_id', tenantId).is('accepted_at', null).order('created_at', { ascending: false }),
  ]);

  type MRow = {
    id: string; user_id: string; role: string; custom_role_id: string | null; created_at: string;
    profiles: { full_name: string | null } | null;
    custom_roles: { name: string } | null;
  };

  type InvRow = {
    id: string; email: string; custom_role_id: string | null; default_role: string;
    expires_at: string; created_at: string;
    custom_roles: { name: string } | null;
  };

  // Fetch emails via admin client
  const admin = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const userIds = ((membershipsRes.data ?? []) as any[]).map((m: any) => (m as MRow).user_id);
  const emailMap = new Map<string, string>();

  if (userIds.length > 0) {
    try {
      const { data: users } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
      for (const u of users?.users ?? []) {
        if (u.email) emailMap.set(u.id, u.email);
      }
    } catch { /* ignore */ }
  }

  // Count members per role
  const memberCountMap = new Map<string, number>();
  for (const m of (membershipsRes.data ?? []) as MRow[]) {
    if (m.custom_role_id) {
      memberCountMap.set(m.custom_role_id, (memberCountMap.get(m.custom_role_id) ?? 0) + 1);
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const roles: CustomRole[] = ((rolesRes.data ?? []) as any[]).map((r: any) => ({
    id:          r.id,
    name:        r.name,
    permissions: r.permissions as RolePermissions,
    created_at:  r.created_at,
    member_count: memberCountMap.get(r.id) ?? 0,
  }));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const staff: StaffMember[] = ((membershipsRes.data ?? []) as any[]).map((m: any) => {
    const row = m as MRow;
    return {
      id:              row.id,
      user_id:         row.user_id,
      user_name:       row.profiles?.full_name ?? null,
      user_email:      emailMap.get(row.user_id) ?? null,
      role:            row.role,
      custom_role_id:  row.custom_role_id,
      custom_role_name: row.custom_roles?.name ?? null,
      joined_at:       row.created_at,
    };
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const invitations: Invitation[] = ((invRes.data ?? []) as any[]).map((inv: any) => {
    const row = inv as InvRow;
    return {
      id:              row.id,
      email:           row.email,
      custom_role_id:  row.custom_role_id,
      custom_role_name: row.custom_roles?.name ?? null,
      default_role:    row.default_role,
      expires_at:      row.expires_at,
      created_at:      row.created_at,
    };
  });

  return { roles, staff, invitations };
}

// ─── Mutations ────────────────────────────────────────────────

export async function createRole(
  name: string,
  permissions: RolePermissions,
): Promise<{ ok: boolean; error?: string }> {
  const ctx = await getOwnerContext();
  if (!ctx) return { ok: false, error: 'غير مخوّل' };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (ctx.supabase as any).from('custom_roles').insert({
    tenant_id: ctx.tenantId, name: name.trim(), permissions,
  });

  if (error) return { ok: false, error: error.message };

  await logAudit({ tenant_id: ctx.tenantId, action: 'create', entity: 'custom_role', details: { name } });
  revalidatePath('/dashboard/settings/roles');
  return { ok: true };
}

export async function updateRole(
  id: string,
  name: string,
  permissions: RolePermissions,
): Promise<{ ok: boolean; error?: string }> {
  const ctx = await getOwnerContext();
  if (!ctx) return { ok: false, error: 'غير مخوّل' };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (ctx.supabase as any).from('custom_roles')
    .update({ name: name.trim(), permissions })
    .eq('id', id).eq('tenant_id', ctx.tenantId);

  if (error) return { ok: false, error: error.message };

  await logAudit({ tenant_id: ctx.tenantId, action: 'update', entity: 'custom_role', entity_id: id, details: { name } });
  revalidatePath('/dashboard/settings/roles');
  return { ok: true };
}

export async function deleteRole(id: string): Promise<{ ok: boolean; error?: string }> {
  const ctx = await getOwnerContext();
  if (!ctx) return { ok: false, error: 'غير مخوّل' };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (ctx.supabase as any).from('custom_roles')
    .delete().eq('id', id).eq('tenant_id', ctx.tenantId);

  if (error) return { ok: false, error: error.message };

  await logAudit({ tenant_id: ctx.tenantId, action: 'delete', entity: 'custom_role', entity_id: id });
  revalidatePath('/dashboard/settings/roles');
  return { ok: true };
}

export async function updateMemberRole(
  membershipId: string,
  customRoleId: string | null,
  defaultRole: 'owner' | 'manager' | 'staff',
): Promise<{ ok: boolean; error?: string }> {
  const ctx = await getOwnerContext();
  if (!ctx) return { ok: false, error: 'غير مخوّل' };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (ctx.supabase as any).from('memberships')
    .update({ role: defaultRole, custom_role_id: customRoleId })
    .eq('id', membershipId).eq('tenant_id', ctx.tenantId);

  if (error) {
    const msg = error.message.includes('AURAN_LAST_OWNER')
      ? 'لا يمكن تغيير دور آخر مالك'
      : error.message;
    return { ok: false, error: msg };
  }

  await logAudit({
    tenant_id: ctx.tenantId,
    action: 'role_change',
    entity: 'membership',
    entity_id: membershipId,
    details: { defaultRole, customRoleId },
  });
  revalidatePath('/dashboard/settings/roles');
  return { ok: true };
}

export async function removeMember(membershipId: string): Promise<{ ok: boolean; error?: string }> {
  const ctx = await getOwnerContext();
  if (!ctx) return { ok: false, error: 'غير مخوّل' };

  const { error } = await ctx.supabase.from('memberships')
    .delete().eq('id', membershipId).eq('tenant_id', ctx.tenantId);

  if (error) {
    const msg = error.message.includes('AURAN_LAST_OWNER')
      ? 'لا يمكن حذف آخر مالك'
      : error.message;
    return { ok: false, error: msg };
  }

  await logAudit({ tenant_id: ctx.tenantId, action: 'remove_staff', entity: 'membership', entity_id: membershipId });
  revalidatePath('/dashboard/settings/roles');
  return { ok: true };
}

export async function sendInvitation(
  email: string,
  defaultRole: 'manager' | 'staff',
  customRoleId: string | null,
): Promise<{ ok: boolean; token?: string; error?: string }> {
  const ctx = await getOwnerContext();
  if (!ctx) return { ok: false, error: 'غير مخوّل' };

  // Delete expired/existing pending invite for this email
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const dbAny = ctx.supabase as any;
  await dbAny.from('invitations')
    .delete()
    .eq('tenant_id', ctx.tenantId)
    .eq('email', email.toLowerCase().trim());

  const { data, error } = await dbAny.from('invitations')
    .insert({
      tenant_id:      ctx.tenantId,
      email:          email.toLowerCase().trim(),
      custom_role_id: customRoleId,
      default_role:   defaultRole,
      invited_by:     ctx.userId,
    })
    .select('token')
    .single();

  if (error) return { ok: false, error: error.message };

  await logAudit({ tenant_id: ctx.tenantId, action: 'invite', entity: 'membership', details: { email, defaultRole } });
  revalidatePath('/dashboard/settings/roles');
  return { ok: true, token: (data as { token: string }).token };
}

export async function cancelInvitation(invitationId: string): Promise<{ ok: boolean; error?: string }> {
  const ctx = await getOwnerContext();
  if (!ctx) return { ok: false, error: 'غير مخوّل' };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (ctx.supabase as any).from('invitations')
    .delete().eq('id', invitationId).eq('tenant_id', ctx.tenantId);

  if (error) return { ok: false, error: error.message };
  revalidatePath('/dashboard/settings/roles');
  return { ok: true };
}

export async function acceptInvitation(token: string): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'يجب تسجيل الدخول أولاً' };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;
  const { data: inv } = await db
    .from('invitations')
    .select('id, tenant_id, custom_role_id, default_role, expires_at')
    .eq('token', token)
    .is('accepted_at', null)
    .single();

  if (!inv) return { ok: false, error: 'الدعوة غير صالحة أو منتهية' };
  if (new Date(inv.expires_at) < new Date()) return { ok: false, error: 'انتهت صلاحية الدعوة' };

  // Create membership — cast to bypass custom_role_id type (new column)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: mErr } = await (supabase as any).from('memberships').insert({
    user_id:        user.id,
    tenant_id:      inv.tenant_id,
    role:           inv.default_role,
    custom_role_id: inv.custom_role_id,
  });

  if (mErr && !mErr.message.includes('duplicate')) {
    return { ok: false, error: mErr.message };
  }

  // Mark invitation as accepted
  await db.from('invitations')
    .update({ accepted_at: new Date().toISOString() })
    .eq('id', inv.id);

  return { ok: true };
}
