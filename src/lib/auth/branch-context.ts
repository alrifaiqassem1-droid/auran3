import { cache } from 'react';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { getSession } from '@/lib/auth/get-session';

export type BranchContext = {
  activeBranchId: string | null;
  allowedBranchIds: string[];
  canSwitchBranches: boolean;
  tenantId: string;
  role: 'owner' | 'manager' | 'staff';
};

/**
 * Server-only utility (not a server action). Call from server components and
 * server actions to resolve which branch the current user is operating in.
 *
 * Resolution order for activeBranchId:
 *   1. Cookie "auran_active_branch" — written by the client on every branch
 *      switch, so it is available to the first server render after hydration.
 *   2. The tenant's default branch (is_default = true).
 *   3. The first branch returned for the tenant.
 */
export const getBranchContext = cache(async (): Promise<BranchContext | null> => {
  const { user, memberships } = await getSession();
  if (!user || !memberships.length) return null;

  const m = memberships[0];
  const tenantId = m.tenant_id;
  const role = m.role;

  // Read the cookie the client writes whenever the active branch changes.
  const cookieStore = await cookies();
  const cookieValue = cookieStore.get('auran_active_branch')?.value ?? null;

  let allowedBranchIds: string[];
  let defaultBranchId: string | null = null;

  // Owners and managers see all tenant branches regardless of their membership's branch_id.
  // (The register_tenant trigger sets owner branch_id = first branch, not null — so we
  //  cannot rely on branch_id === null to detect full-access users.)
  if (m.role === 'owner' || m.role === 'manager') {
    const supabase = await createClient();
    const { data: branches } = await supabase
      .from('branches')
      .select('id, is_default')
      .eq('tenant_id', tenantId)
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: true });

    const list = branches ?? [];
    allowedBranchIds = list.map(b => b.id);
    defaultBranchId = list.find(b => b.is_default)?.id ?? list[0]?.id ?? null;
  } else {
    // Staff scoped to a single branch — allowed = that branch only.
    allowedBranchIds = [m.branch_id ?? ''].filter(Boolean);
    defaultBranchId = m.branch_id;
  }

  // Use the cookie if it refers to a branch this user is allowed to see;
  // otherwise fall back to the default / first branch.
  const activeBranchId =
    cookieValue && allowedBranchIds.includes(cookieValue)
      ? cookieValue
      : defaultBranchId;

  return {
    activeBranchId,
    allowedBranchIds,
    canSwitchBranches: allowedBranchIds.length > 1,
    tenantId,
    role,
  };
});
