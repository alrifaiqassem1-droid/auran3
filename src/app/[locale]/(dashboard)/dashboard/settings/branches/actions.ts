'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getSession } from '@/lib/auth/get-session';
import { getBranchContext } from '@/lib/auth/branch-context';

type ActionResult = { ok: true } | { ok: false; error: string };

export type BranchSummary = { id: string; name: string; is_default: boolean };

/** Returns all branches the current user is allowed to see, ordered default-first. */
export async function getMyBranches(): Promise<BranchSummary[]> {
  const ctx = await getBranchContext();
  if (!ctx || !ctx.allowedBranchIds.length) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from('branches')
    .select('id, name, is_default')
    .in('id', ctx.allowedBranchIds)
    .order('is_default', { ascending: false })
    .order('created_at', { ascending: true });
  console.log('[getMyBranches]', { allowedBranchIds: ctx.allowedBranchIds, returned: data });
  return (data ?? []) as BranchSummary[];
}

export type BranchRow = {
  id: string;
  name: string;
  address: string | null;
  is_default: boolean;
  created_at: string;
};

export async function getBranches(): Promise<BranchRow[]> {
  const { memberships } = await getSession();
  if (!memberships.length) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from('branches')
    .select('id, name, address, is_default, created_at')
    .eq('tenant_id', memberships[0].tenant_id)
    .order('is_default', { ascending: false })
    .order('created_at', { ascending: true });
  return (data ?? []) as BranchRow[];
}

export async function createBranch(name: string, address?: string): Promise<ActionResult> {
  const { memberships } = await getSession();
  const m = memberships[0];
  if (!m || !['owner', 'manager'].includes(m.role)) return { ok: false, error: 'Unauthorized' };
  const supabase = await createClient();
  const { error } = await supabase.from('branches').insert({
    tenant_id: m.tenant_id,
    name,
    address: address ?? null,
    is_default: false,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath('/dashboard/settings/branches');
  return { ok: true };
}

export async function updateBranch(id: string, name: string, address?: string): Promise<ActionResult> {
  const { memberships } = await getSession();
  const m = memberships[0];
  if (!m || !['owner', 'manager'].includes(m.role)) return { ok: false, error: 'Unauthorized' };
  const supabase = await createClient();
  const { error } = await supabase
    .from('branches')
    .update({ name, address: address ?? null })
    .eq('id', id)
    .eq('tenant_id', m.tenant_id);
  if (error) return { ok: false, error: error.message };
  revalidatePath('/dashboard/settings/branches');
  return { ok: true };
}

export async function setDefaultBranch(id: string): Promise<ActionResult> {
  const { memberships } = await getSession();
  const m = memberships[0];
  if (!m || m.role !== 'owner') return { ok: false, error: 'Unauthorized' };
  const supabase = await createClient();
  const { error: e1 } = await supabase
    .from('branches')
    .update({ is_default: false })
    .eq('tenant_id', m.tenant_id);
  if (e1) return { ok: false, error: e1.message };
  const { error: e2 } = await supabase
    .from('branches')
    .update({ is_default: true })
    .eq('id', id)
    .eq('tenant_id', m.tenant_id);
  if (e2) return { ok: false, error: e2.message };
  revalidatePath('/dashboard/settings/branches');
  return { ok: true };
}

export async function deleteBranch(id: string): Promise<ActionResult> {
  const { memberships } = await getSession();
  const m = memberships[0];
  if (!m || m.role !== 'owner') return { ok: false, error: 'Unauthorized' };
  const supabase = await createClient();
  const { data: branch } = await supabase
    .from('branches')
    .select('is_default')
    .eq('id', id)
    .single();
  if (branch?.is_default) return { ok: false, error: 'cannotDeleteDefault' };
  const { count } = await supabase
    .from('memberships')
    .select('id', { count: 'exact', head: true })
    .eq('branch_id', id);
  if (count && count > 0) return { ok: false, error: 'branchHasMembers' };
  const { error } = await supabase
    .from('branches')
    .delete()
    .eq('id', id)
    .eq('tenant_id', m.tenant_id);
  if (error) return { ok: false, error: error.message };
  revalidatePath('/dashboard/settings/branches');
  return { ok: true };
}
