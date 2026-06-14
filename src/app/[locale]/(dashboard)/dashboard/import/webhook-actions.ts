'use server';

// Server actions for webhook endpoint management.
// The underlying RPCs (generate_webhook_secret / revoke_webhook_endpoint)
// run _guard(owner/manager) internally, so no extra role check is needed here.

import { createClient } from '@/lib/supabase/server';
import { getBranchContext } from '@/lib/auth/branch-context';

export interface WebhookListItem {
  id: string;
  label: string;
  secret_prefix: string;
  is_active: boolean;
  last_used_at: string | null;
  created_at: string;
}

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

// List endpoints for a branch (no secret — only prefix + status).
export async function listWebhooks(branchId: string): Promise<Result<WebhookListItem[]>> {
  if (!branchId) return { ok: false, error: 'NO_BRANCH' };
  const ctx = await getBranchContext();
  if (!ctx || !ctx.allowedBranchIds.includes(branchId)) return { ok: false, error: 'UNAUTHORIZED' };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('webhook_endpoints')
    .select('id, label, secret_prefix, is_active, last_used_at, created_at')
    .eq('branch_id', branchId)
    .order('created_at', { ascending: false });

  if (error) return { ok: false, error: error.message };
  return { ok: true, data: (data ?? []) as WebhookListItem[] };
}

// Create a new endpoint. Returns the plaintext secret ONCE — never retrievable again.
export async function createWebhook(
  branchId: string,
  label: string,
): Promise<Result<{ endpoint_id: string; secret: string }>> {
  if (!branchId) return { ok: false, error: 'NO_BRANCH' };
  const ctx = await getBranchContext();
  if (!ctx || !ctx.allowedBranchIds.includes(branchId)) return { ok: false, error: 'UNAUTHORIZED' };
  const trimmed = (label ?? '').trim();
  if (!trimmed) return { ok: false, error: 'NO_LABEL' };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('generate_webhook_secret', {
    p_branch: branchId,
    p_label: trimmed,
  });

  if (error) return { ok: false, error: error.message };
  const row = Array.isArray(data) ? data[0] : data;
  if (!row?.secret) return { ok: false, error: 'NO_SECRET_RETURNED' };
  return { ok: true, data: { endpoint_id: row.endpoint_id, secret: row.secret } };
}

// Soft-disable an endpoint.
export async function revokeWebhook(endpointId: string): Promise<Result<null>> {
  if (!endpointId) return { ok: false, error: 'NO_ENDPOINT' };
  const supabase = await createClient();
  const { error } = await supabase.rpc('revoke_webhook_endpoint', {
    p_endpoint: endpointId,
  });

  if (error) return { ok: false, error: error.message };
  return { ok: true, data: null };
}
