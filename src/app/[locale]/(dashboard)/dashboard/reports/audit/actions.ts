'use server';

import { createClient as createServerClient } from '@/lib/supabase/server';

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

export async function getAuditLog(
  filters: AuditFilters = {},
  limit = 100,
): Promise<{ entries: AuditEntry[]; isOwner: boolean }> {
  const supabase = await createServerClient();
  const { data: tenantIds } = await supabase.rpc('auth_tenant_ids');
  const tenantId: string | undefined = tenantIds?.[0];
  if (!tenantId) return { entries: [], isOwner: false };

  const { data: membership } = await supabase
    .from('memberships')
    .select('role')
    .eq('tenant_id', tenantId)
    .single();

  const isOwner = membership?.role === 'owner';

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
    entries: (data ?? []) as AuditEntry[],
    isOwner,
  };
}
