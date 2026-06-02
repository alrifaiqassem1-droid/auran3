'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import { createClient as createServerClient } from '@/lib/supabase/server';

export interface AuditParams {
  tenant_id: string;
  action:    string;   // create | update | delete | receive | damage | count_close | pos_import | role_change | invite | remove_staff
  entity:    string;   // product | receipt | damage | inventory_count | pos_import | membership
  entity_id?: string;
  details?:  Record<string, unknown>;
}

/**
 * Inserts a row into audit_log via service role (bypasses RLS).
 * Never throws — audit must not break the main operation.
 */
export async function logAudit(params: AuditParams): Promise<void> {
  try {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', user.id)
      .single();

    const admin = createAdminClient();
    await admin.from('audit_log').insert({
      tenant_id: params.tenant_id,
      user_id:   user.id,
      user_name: profile?.full_name ?? user.email ?? 'Unknown',
      action:    params.action,
      entity:    params.entity,
      entity_id: params.entity_id ?? null,
      details:   params.details ?? null,
    });
  } catch {
    // Silent: audit never blocks business operations
  }
}
