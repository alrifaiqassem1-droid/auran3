'use server';

import { createClient as createServerClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { logAudit } from '@/lib/audit';
import { revalidatePath } from 'next/cache';
import type { Json } from '@/types/database.types';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

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
  id:           string;
  name:         string;
  permissions:  RolePermissions;
  created_at:   string;
  member_count: number;
}

export interface StaffMember {
  id:               string;  // membership id
  user_id:          string;
  user_name:        string | null;
  user_email:       string | null;
  role:             string;
  custom_role_id:   string | null;
  custom_role_name: string | null;
  joined_at:        string;
}

export interface Invitation {
  id:               string;
  email:            string;
  custom_role_id:   string | null;
  custom_role_name: string | null;
  default_role:     string;
  expires_at:       string;
  created_at:       string;
}

// ─── Join-result shapes (Supabase returns nested objects for FK joins) ─────

type MembershipRow = {
  id: string;
  user_id: string;
  role: string;
  custom_role_id: string | null;
  created_at: string;
  profiles: { full_name: string | null } | null;
  custom_roles: { name: string } | null;
};

type InvitationRow = {
  id: string;
  email: string;
  custom_role_id: string | null;
  default_role: string;
  expires_at: string;
  created_at: string;
  custom_roles: { name: string } | null;
};

// ─── Helpers ──────────────────────────────────────────────────

async function getOwnerContext() {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: tenantIds } = await supabase.rpc('auth_tenant_ids');
  const tenantId: string | undefined = tenantIds?.[0];
  if (!tenantId) return null;

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

  const [rolesRes, membershipsRes, invRes] = await Promise.all([
    supabase
      .from('custom_roles')
      .select('id, name, permissions, created_at')
      .eq('tenant_id', tenantId)
      .order('created_at'),
    supabase
      .from('memberships')
      .select('id, user_id, role, custom_role_id, created_at, profiles(full_name), custom_roles(name)')
      .eq('tenant_id', tenantId)
      .order('created_at'),
    supabase
      .from('invitations')
      .select('id, email, custom_role_id, default_role, expires_at, created_at, custom_roles(name)')
      .eq('tenant_id', tenantId)
      .is('accepted_at', null)
      .order('created_at', { ascending: false }),
  ]);

  // Fetch member emails via admin API (not in profiles table)
  const admin = createAdminClient();
  const membershipRows = (membershipsRes.data ?? []) as unknown as MembershipRow[];
  const userIds = membershipRows.map((m) => m.user_id);
  const emailMap = new Map<string, string>();

  if (userIds.length > 0) {
    try {
      const { data: users } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
      for (const u of users?.users ?? []) {
        if (u.email) emailMap.set(u.id, u.email);
      }
    } catch { /* ignore */ }
  }

  // Count members per custom role
  const memberCountMap = new Map<string, number>();
  for (const m of membershipRows) {
    if (m.custom_role_id) {
      memberCountMap.set(m.custom_role_id, (memberCountMap.get(m.custom_role_id) ?? 0) + 1);
    }
  }

  const roles: CustomRole[] = (rolesRes.data ?? []).map((r) => ({
    id:           r.id,
    name:         r.name,
    permissions:  r.permissions as unknown as RolePermissions,
    created_at:   r.created_at,
    member_count: memberCountMap.get(r.id) ?? 0,
  }));

  const staff: StaffMember[] = membershipRows.map((m) => ({
    id:               m.id,
    user_id:          m.user_id,
    user_name:        m.profiles?.full_name ?? null,
    user_email:       emailMap.get(m.user_id) ?? null,
    role:             m.role,
    custom_role_id:   m.custom_role_id,
    custom_role_name: m.custom_roles?.name ?? null,
    joined_at:        m.created_at,
  }));

  const invRows = (invRes.data ?? []) as unknown as InvitationRow[];
  const invitations: Invitation[] = invRows.map((inv) => ({
    id:               inv.id,
    email:            inv.email,
    custom_role_id:   inv.custom_role_id,
    custom_role_name: inv.custom_roles?.name ?? null,
    default_role:     inv.default_role,
    expires_at:       inv.expires_at,
    created_at:       inv.created_at,
  }));

  return { roles, staff, invitations };
}

// ─── Mutations ────────────────────────────────────────────────

export async function createRole(
  name: string,
  permissions: RolePermissions,
): Promise<{ ok: boolean; error?: string }> {
  const ctx = await getOwnerContext();
  if (!ctx) return { ok: false, error: 'غير مخوّل' };

  const { error } = await ctx.supabase
    .from('custom_roles')
    .insert({ tenant_id: ctx.tenantId, name: name.trim(), permissions: permissions as unknown as Json });

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

  const { error } = await ctx.supabase
    .from('custom_roles')
    .update({ name: name.trim(), permissions: permissions as unknown as Json })
    .eq('id', id)
    .eq('tenant_id', ctx.tenantId);

  if (error) return { ok: false, error: error.message };

  await logAudit({ tenant_id: ctx.tenantId, action: 'update', entity: 'custom_role', entity_id: id, details: { name } });
  revalidatePath('/dashboard/settings/roles');
  return { ok: true };
}

export async function deleteRole(id: string): Promise<{ ok: boolean; error?: string }> {
  const ctx = await getOwnerContext();
  if (!ctx) return { ok: false, error: 'غير مخوّل' };

  const { error } = await ctx.supabase
    .from('custom_roles')
    .delete()
    .eq('id', id)
    .eq('tenant_id', ctx.tenantId);

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

  const { error } = await ctx.supabase
    .from('memberships')
    .update({ role: defaultRole, custom_role_id: customRoleId })
    .eq('id', membershipId)
    .eq('tenant_id', ctx.tenantId);

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

  const { error } = await ctx.supabase
    .from('memberships')
    .delete()
    .eq('id', membershipId)
    .eq('tenant_id', ctx.tenantId);

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
): Promise<{ ok: boolean; inviteUrl?: string; error?: string }> {
  const ctx = await getOwnerContext();
  if (!ctx) return { ok: false, error: 'غير مخوّل' };

  // Delete any existing pending invite for this email first
  await ctx.supabase
    .from('invitations')
    .delete()
    .eq('tenant_id', ctx.tenantId)
    .eq('email', email.toLowerCase().trim());

  const { data, error } = await ctx.supabase
    .from('invitations')
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
  return { ok: true, inviteUrl: `${SITE_URL}/join?token=${data.token}` };
}

export async function cancelInvitation(invitationId: string): Promise<{ ok: boolean; error?: string }> {
  const ctx = await getOwnerContext();
  if (!ctx) return { ok: false, error: 'غير مخوّل' };

  const { error } = await ctx.supabase
    .from('invitations')
    .delete()
    .eq('id', invitationId)
    .eq('tenant_id', ctx.tenantId);

  if (error) return { ok: false, error: error.message };
  revalidatePath('/dashboard/settings/roles');
  return { ok: true };
}

export async function acceptInvitation(token: string): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'يجب تسجيل الدخول أولاً' };

  const { data: inv } = await supabase
    .from('invitations')
    .select('id, email, tenant_id, custom_role_id, default_role, expires_at')
    .eq('token', token)
    .is('accepted_at', null)
    .single();

  if (!inv) return { ok: false, error: 'الدعوة غير صالحة أو منتهية' };
  if (new Date(inv.expires_at) < new Date()) return { ok: false, error: 'انتهت صلاحية الدعوة' };
  if (inv.email.toLowerCase().trim() !== user.email?.toLowerCase().trim()) {
    return { ok: false, error: 'هذه الدعوة ليست لك' };
  }

  const { error: mErr } = await supabase
    .from('memberships')
    .insert({
      user_id:        user.id,
      tenant_id:      inv.tenant_id,
      role:           inv.default_role,
      custom_role_id: inv.custom_role_id,
    });

  if (mErr && !mErr.message.includes('duplicate')) {
    return { ok: false, error: mErr.message };
  }

  await supabase
    .from('invitations')
    .update({ accepted_at: new Date().toISOString() })
    .eq('id', inv.id);

  return { ok: true };
}
