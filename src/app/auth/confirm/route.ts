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
    return NextResponse.redirect(`${origin}/login?error=invalid_token`);
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
