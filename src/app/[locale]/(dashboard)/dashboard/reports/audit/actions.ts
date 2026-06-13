'use server';

import { createClient as createServerClient } from '@/lib/supabase/server';
import { getSession } from '@/lib/auth/get-session';

export interface AuditEntry {
  id:         string;
  user_name:  string | null;
  action:     string;
  entity:     string;
  entity_id:  string | null;
  details:    Record<string, unknown> | null;
  created_at: string;
}

export interface AuditFilters {
  userId?:    string;
  action?:    string;
  entity?:    string;
  dateFrom?:  string;
  dateTo?:    string;
}

type AuditLogResult =
  | { ok: false; error: string }
  | { ok: true; entries: AuditEntry[]; isOwner: boolean };

export async function getAuditLog(
  filters: AuditFilters = {},
  limit = 100,
): Promise<AuditLogResult> {
  const { user, memberships } = await getSession();
  if (!user) return { ok: false, error: 'unauthorized' };

  const membership = memberships[0];
  if (membership?.role !== 'owner') return { ok: false, error: 'unauthorized' };

  const supabase = await createServerClient();
  const tenantId = membership.tenant_id;

  let query = supabase
    .from('audit_log')
    .select('id, user_name, action, entity, entity_id, details, created_at')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (filters.action)   query = query.eq('action', filters.action);
  if (filters.entity)   query = query.eq('entity', filters.entity);
  if (filters.dateFrom) query = query.gte('created_at', filters.dateFrom + 'T00:00:00Z');
  if (filters.dateTo)   query = query.lte('created_at', filters.dateTo + 'T23:59:59Z');

  const { data } = await query;
  return {
    ok: true,
    entries: (data ?? []) as AuditEntry[],
    isOwner: true,
  };
}
