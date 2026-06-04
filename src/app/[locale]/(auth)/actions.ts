'use server';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { loginSchema, signupSchema, type LoginInput, type SignupInput } from '@/lib/validators/auth';
import { checkRateLimit, recordAttempt, checkSuspiciousIp } from '@/lib/auth/rate-limit';
import { logAuditEvent } from '@/lib/auth/audit-log';
import { getClientInfo } from '@/lib/auth/get-client-info';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

export async function signIn(input: LoginInput) {
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'invalidCredentials' };

  const { ip, userAgent } = await getClientInfo();

  // Account lockout: 5 failed attempts / 30 min per email
  const emailLock = await checkRateLimit(parsed.data.email, 'login', 5, 30);
  if (emailLock.blocked) {
    await logAuditEvent({
      email: parsed.data.email, ip_address: ip, user_agent: userAgent,
      action: 'blocked_attempt', success: false,
      metadata: { reason: 'account_locked', retry_after: emailLock.retryAfterMin },
    });
    return { ok: false, error: 'accountLocked', retryAfterMin: (emailLock as { blocked: true; retryAfterMin: number }).retryAfterMin };
  }

  // IP rate limit: 10 attempts / 30 min
  const ipLock = await checkRateLimit(ip, 'login', 10, 30);
  if (ipLock.blocked) {
    await logAuditEvent({
      email: parsed.data.email, ip_address: ip, user_agent: userAgent,
      action: 'blocked_attempt', success: false,
      metadata: { reason: 'ip_blocked' },
    });
    return { ok: false, error: 'tooManyAttempts' };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error) {
    await recordAttempt(parsed.data.email, 'login');
    await recordAttempt(ip, 'login');
    const isSuspicious = await checkSuspiciousIp(ip);
    await logAuditEvent({
      email: parsed.data.email, ip_address: ip, user_agent: userAgent,
      action: 'failed_login', success: false, is_suspicious: isSuspicious,
    });
    return { ok: false, error: 'invalidCredentials' };
  }

  await logAuditEvent({
    email: parsed.data.email, ip_address: ip, user_agent: userAgent,
    action: 'login', success: true, user_id: data.user?.id,
  });

  redirect('/dashboard');
}

export async function signUp(input: SignupInput, captchaToken?: string) {
  const parsed = signupSchema.safeParse(input);
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message;
    return { ok: false, error: msg || 'genericError' };
  }

  const { ip, userAgent } = await getClientInfo();

  // IP signup rate limit: 3 per hour
  const ipLimit = await checkRateLimit(ip, 'signup', 3, 60);
  if (ipLimit.blocked) {
    return { ok: false, error: 'tooManyAttempts' };
  }

  const supabase = await createClient();
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      ...(captchaToken ? { captchaToken } : {}),
      data: { full_name: parsed.data.fullName, company_name: parsed.data.companyName },
      emailRedirectTo: `${SITE_URL}/auth/confirm`,
    },
  });

  if (authError) {
    console.error('[signUp] Supabase auth error:', authError.message, authError);
    await recordAttempt(ip, 'signup');
    await logAuditEvent({
      email: parsed.data.email, ip_address: ip, user_agent: userAgent,
      action: 'signup', success: false, metadata: { error: authError.message },
    });
    if (authError.message?.toLowerCase().includes('already registered')) {
      return { ok: false, error: 'emailAlreadyUsed' };
    }
    return { ok: false, error: 'genericError' };
  }

  // bootstrap_tenant requires auth.uid() — called in /auth/confirm after verifyOtp sets the session

  await logAuditEvent({
    email: parsed.data.email, ip_address: ip, user_agent: userAgent,
    action: 'signup', success: true, user_id: authData.user?.id,
  });

  redirect('/verify-email');
}

export async function signOut() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  await supabase.auth.signOut();
  if (user?.email) {
    const { ip, userAgent } = await getClientInfo();
    await logAuditEvent({
      email: user.email, ip_address: ip, user_agent: userAgent,
      action: 'logout', success: true, user_id: user.id,
    });
  }
  redirect('/login');
}
