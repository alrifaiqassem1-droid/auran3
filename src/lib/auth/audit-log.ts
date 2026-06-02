import { createAdminClient } from '@/lib/supabase/admin';

export type AuditAction =
  | 'login'
  | 'signup'
  | 'logout'
  | 'failed_login'
  | 'email_verified'
  | 'blocked_attempt';

type AuditEntry = {
  email?:        string;
  ip_address?:   string;
  user_agent?:   string;
  action:        AuditAction;
  success:       boolean;
  user_id?:      string;
  is_suspicious?: boolean;
  metadata?:     Record<string, unknown>;
};

// Audit logging must never throw — it's a fire-and-forget side-effect.
export async function logAuditEvent(entry: AuditEntry) {
  try {
    const admin = createAdminClient();
    await admin.from('auth_audit_log').insert(entry);
  } catch {
    // Intentionally silent: audit failures must not disrupt the auth flow.
  }
}
