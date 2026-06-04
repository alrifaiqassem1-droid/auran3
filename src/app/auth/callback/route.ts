import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import type { Database } from '@/types/database.types';

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');

  if (!code) {
    return NextResponse.redirect(`${origin}/auth/error?reason=missing_code`);
  }

  const cookieStore = await cookies();

  // Build the response FIRST — exchangeCodeForSession will call setAll, and
  // we must write those session cookies onto the response we ultimately return.
  // Without this the browser never receives the cookies and every subsequent
  // getUser() call finds no session.
  let response = NextResponse.redirect(`${origin}/dashboard`);

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !data.user) {
    console.error('[auth/callback] exchange error:', error);
    return NextResponse.redirect(
      `${origin}/auth/error?reason=${encodeURIComponent(error?.message ?? 'exchange_failed')}`
    );
  }

  // Decide destination: existing user (membership row) → dashboard
  //                     new Google user (no membership) → onboarding
  const { data: membership } = await supabase
    .from('memberships')
    .select('id')
    .eq('user_id', data.user.id)
    .maybeSingle();

  const destination = membership ? '/dashboard' : '/auth/onboarding';

  // Rebuild the redirect to point at the correct destination, then
  // re-copy every cookie that was written during exchangeCodeForSession.
  const finalResponse = NextResponse.redirect(`${origin}${destination}`);
  response.cookies.getAll().forEach((c) => {
    finalResponse.cookies.set(c);
  });
  return finalResponse;
}
