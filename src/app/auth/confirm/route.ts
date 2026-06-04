import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { EmailOtpType } from '@supabase/supabase-js';
import { logAuditEvent } from '@/lib/auth/audit-log';
import { getClientInfo } from '@/lib/auth/get-client-info';
import type { Database } from '@/types/database.types';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const token_hash = url.searchParams.get('token_hash');
  const type       = url.searchParams.get('type') as EmailOtpType | null;
  const origin     = url.origin;

  if (!token_hash || !type) {
    return NextResponse.redirect(`${origin}/login?error=missing_token`);
  }

  const cookieStore = await cookies();
  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll:  () => cookieStore.getAll(),
        setAll: (toSet) => {
          try { toSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options)); }
          catch { /* server component context */ }
        },
      },
    }
  );

  const { data, error } = await supabase.auth.verifyOtp({ type, token_hash });

  if (error) {
    console.error('[auth/confirm] verifyOtp error:', error.message, error);
    return NextResponse.redirect(`${origin}/login?error=invalid_token`);
  }

  // Get the verified user to access their id and metadata
  const { data: { user } } = await supabase.auth.getUser();

  if (user) {
    const fullName    = (user.user_metadata?.full_name    as string | undefined) ?? '';
    const companyName = (user.user_metadata?.company_name as string | undefined) ?? '';

    if (fullName && companyName) {
      try {
        const { error: rpcError } = await supabase.rpc('bootstrap_tenant', {
          p_company:   companyName,
          p_full_name: fullName,
          p_user_id:   user.id,
        });
        if (rpcError) {
          // Log but never block — tenant may already exist (link clicked twice)
          console.error('[auth/confirm] bootstrap_tenant error:', rpcError.message, rpcError);
        }
      } catch (err) {
        console.error('[auth/confirm] bootstrap_tenant threw:', err);
      }
    }
  }

  const { ip, userAgent } = await getClientInfo();
  await logAuditEvent({
    email:      data.user?.email,
    ip_address: ip,
    user_agent: userAgent,
    action:     'email_verified',
    success:    true,
    user_id:    data.user?.id,
  });

  return NextResponse.redirect(`${origin}/dashboard?celebration=true`);
}
