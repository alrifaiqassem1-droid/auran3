import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { Database } from '@/types/database.types';

export async function GET(request: Request) {
  const url    = new URL(request.url);
  const code   = url.searchParams.get('code');
  const origin = url.origin;

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=missing_code`);
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

  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

  if (exchangeError) {
    console.error('[auth/callback] exchangeCodeForSession error:', exchangeError.message);
    return NextResponse.redirect(`${origin}/login?error=oauth_failed`);
  }

  const { data: { user } } = await supabase.auth.getUser();

  if (user) {
    const fullName  = (user.user_metadata?.full_name    as string | undefined)
                   || (user.user_metadata?.name         as string | undefined)
                   || '';
    const company   = (user.user_metadata?.company_name as string | undefined)
                   || 'My Company';

    try {
      const { error: rpcError } = await supabase.rpc('bootstrap_tenant', {
        p_user_id:   user.id,
        p_full_name: fullName,
        p_company:   company,
      });
      if (rpcError) {
        // Log but never block — tenant may already exist (returning user)
        console.error('[auth/callback] bootstrap_tenant error:', rpcError.message);
      }
    } catch (err) {
      console.error('[auth/callback] bootstrap_tenant threw:', err);
    }
  }

  return NextResponse.redirect(`${origin}/dashboard`);
}
