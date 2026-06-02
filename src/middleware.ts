import createMiddleware from 'next-intl/middleware';
import { NextResponse, type NextRequest } from 'next/server';
import { routing } from './i18n/routing';
import { updateSession } from './lib/supabase/middleware';

const intlMiddleware = createMiddleware(routing);

// All protected pages live under /dashboard/
const PROTECTED_PREFIX = '/dashboard';

// Auth-only pages — redirect to /dashboard when already signed in
const AUTH_ONLY = ['/login', '/signup'];

function stripLocale(pathname: string): string {
  return pathname.replace(/^\/(ar|en)(?=\/|$)/, '') || '/';
}

export async function middleware(request: NextRequest) {
  const response = intlMiddleware(request);
  const path = stripLocale(request.nextUrl.pathname);

  const isProtected = path.startsWith(PROTECTED_PREFIX);
  const isAuthOnly  = AUTH_ONLY.includes(path);

  if (!isProtected && !isAuthOnly) return response;

  const { user } = await updateSession(request, response);

  if (isProtected && !user) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  if (isAuthOnly && user) {
    const url = request.nextUrl.clone();
    url.pathname = '/dashboard';
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon\\.ico|icon-[0-9]+\\.png|manifest\\.json|sw\\.js|\\.well-known).*)' ,
  ],
};
