/**
 * Typed wrappers for custom AURAN RPCs that are not included in the
 * auto-generated database.types.ts. Using these instead of `rpc as any`
 * gives proper return-type inference while keeping a single cast point.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

type RpcResult<T> = Promise<{ data: T | null; error: { message: string } | null }>;

export function rpcOpenCount(
  supabase: SupabaseClient,
  branchId: string,
): RpcResult<string> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (supabase.rpc as any)('open_count', { p_branch_id: branchId });
}

export function rpcUpsertCountItem(
  supabase: SupabaseClient,
  params: { count_id: string; product_id: string; counted: number },
): RpcResult<{ item_id: string; expected_qty: number }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (supabase.rpc as any)('upsert_count_item', {
    p_count_id:   params.count_id,
    p_product_id: params.product_id,
    p_counted:    params.counted,
  });
}

export function rpcCheckExpiry(
  supabase: SupabaseClient,
  branchId: string,
): RpcResult<number> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (supabase.rpc as any)('check_expiry_notifications', { p_branch_id: branchId });
}
