import { createAdminClient } from '@/lib/supabase/admin';

type RateLimitResult =
  | { blocked: false }
  | { blocked: true; retryAfterMin: number };

export async function checkRateLimit(
  identifier: string,
  action: string,
  maxAttempts = 5,
  windowMin = 15
): Promise<RateLimitResult> {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin.rpc('check_rate_limit', {
      p_identifier: identifier,
      p_action:     action,
      p_max:        maxAttempts,
      p_window_min: windowMin,
    });
    if (error || !data) return { blocked: false };
    const result = data as { blocked: boolean; retry_after_min: number };
    if (result.blocked) return { blocked: true, retryAfterMin: result.retry_after_min };
    return { blocked: false };
  } catch {
    return { blocked: false }; // fail open — never break auth flow
  }
}

export async function recordAttempt(identifier: string, action: string) {
  try {
    const admin = createAdminClient();
    await admin.from('rate_limit_attempts').insert({ identifier, action });
  } catch { /* non-fatal */ }
}

export async function checkSuspiciousIp(ip: string): Promise<boolean> {
  try {
    const admin = createAdminClient();
    const { data } = await admin.rpc('check_suspicious_ip', { p_ip: ip });
    return Boolean(data);
  } catch {
    return false;
  }
}
