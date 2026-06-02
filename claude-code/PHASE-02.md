# PHASE 02 — Authentication + Roles + Multi-Tenant

> الالتزام بـ `CONTEXT.md`. الهدف: تسجيل دخول/تسجيل/خروج عبر Supabase Auth (SSR)، حماية المسارات، وأساس multi-tenant عبر `memberships`.

## التثبيت
```bash
npm install @supabase/supabase-js @supabase/ssr zod react-hook-form @hookform/resolvers
npx shadcn@latest add input label card form
```

## متغيّرات البيئة — أنشئ `.env.local`
```
NEXT_PUBLIC_SUPABASE_URL=__من_لوحة_Supabase__
NEXT_PUBLIC_SUPABASE_ANON_KEY=__من_لوحة_Supabase__
SUPABASE_SERVICE_ROLE_KEY=__سرّي_للسيرفر_فقط__
```

## الملفات المطلوبة
```
src/lib/supabase/client.ts        (Browser client)
src/lib/supabase/server.ts        (Server client - cookies)
src/lib/supabase/middleware.ts    (تحديث الجلسة)
src/middleware.ts                 (دمج next-intl + Supabase)
src/lib/validators/auth.ts        (Zod schemas)
src/app/[locale]/(auth)/layout.tsx
src/app/[locale]/(auth)/login/page.tsx
src/app/[locale]/(auth)/signup/page.tsx
src/app/[locale]/(auth)/actions.ts        ('use server')
src/components/auth/auth-card.tsx
src/lib/auth/get-session.ts       (جلب المستخدم + عضوياته)
messages/ar.json + en.json        (أضف مفتاح "Auth")
```

---

### الكود الحرج (اكتبه حرفياً)

#### === src/lib/supabase/client.ts ===
```ts
import { createBrowserClient } from '@supabase/ssr';
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
```

#### === src/lib/supabase/server.ts ===
```ts
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(toSet) {
          try { toSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options)); }
          catch { /* called from a Server Component */ }
        },
      },
    }
  );
}
```

#### === src/lib/supabase/middleware.ts ===
```ts
import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function updateSession(request: NextRequest, response: NextResponse) {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll(toSet) {
          toSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    }
  );
  const { data: { user } } = await supabase.auth.getUser();
  return { user, response };
}
```

#### === src/middleware.ts (دمج i18n + Supabase) ===
```ts
import createMiddleware from 'next-intl/middleware';
import { NextResponse, type NextRequest } from 'next/server';
import { routing } from './i18n/routing';
import { updateSession } from './lib/supabase/middleware';

const intlMiddleware = createMiddleware(routing);
const PROTECTED = ['/dashboard'];     // المسارات المحمية (بدون بادئة اللغة)
const AUTH_PAGES = ['/login', '/signup'];

export async function middleware(request: NextRequest) {
  const response = intlMiddleware(request);
  const { user } = await updateSession(request, response);

  const path = request.nextUrl.pathname.replace(/^\/(ar|en)/, '') || '/';
  const isProtected = PROTECTED.some((p) => path.startsWith(p));
  const isAuthPage = AUTH_PAGES.some((p) => path.startsWith(p));

  if (isProtected && !user) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }
  if (isAuthPage && user) {
    const url = request.nextUrl.clone();
    url.pathname = '/dashboard';
    return NextResponse.redirect(url);
  }
  return response;
}
export const config = { matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'] };
```

#### === src/lib/validators/auth.ts ===
```ts
import { z } from 'zod';
export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});
export const signupSchema = loginSchema.extend({
  fullName: z.string().min(2),
  companyName: z.string().min(2),   // اسم الشركة = tenant جديد
});
export type LoginInput = z.infer<typeof loginSchema>;
export type SignupInput = z.infer<typeof signupSchema>;
```

#### === src/lib/auth/get-session.ts ===
```ts
import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';

export type Membership = {
  tenant_id: string; branch_id: string | null;
  role: 'owner' | 'manager' | 'staff'; tenant_name: string;
};

export const getSession = cache(async () => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { user: null, memberships: [] as Membership[] };

  // ملاحظة: جدول memberships يُنشأ في PHASE 03. قبلها أعد مصفوفة فارغة بأمان.
  const { data: memberships } = await supabase
    .from('memberships')
    .select('tenant_id, branch_id, role, tenants(name)')
    .eq('user_id', user.id);

  const mapped = (memberships ?? []).map((m: any) => ({
    tenant_id: m.tenant_id, branch_id: m.branch_id, role: m.role,
    tenant_name: m.tenants?.name ?? '',
  }));
  return { user, memberships: mapped as Membership[] };
});
```

---

### مواصفات الـ UI و الـ Actions (نفّذها بنفس أناقة Landing)

**`(auth)/actions.ts`** (`'use server'`):
- `signIn(input)`: تحقّق Zod → `supabase.auth.signInWithPassword` → عند النجاح `redirect('/dashboard')`، عند الفشل أعد `{ error }`.
- `signUp(input)`: تحقّق Zod → `supabase.auth.signUp` → ثم **استدعِ RPC `bootstrap_tenant`** (تُعرّف في PHASE 03) التي تنشئ tenant + branch افتراضي + membership(owner) للمستخدم. عند النجاح `redirect('/dashboard')`.
- `signOut()`: `supabase.auth.signOut()` → `redirect('/login')`.
- كل دالة تُعيد `{ ok, error? }` وتستخدم رسائل i18n.

**صفحات Login/Signup:**
- استخدم React Hook Form + `zodResolver` + مكونات shadcn (Input/Label/Card/Form).
- صمّمها بنفس هوية AURAN: خلفية الهالة الخافتة، بطاقة زجاجية `bg-card/60 backdrop-blur`، حركة دخول `fadeUp`.
- زرّا اللغة والثيم في الأعلى (أعد استخدام المكونات الموجودة).
- حالات: تحميل (spinner داخل الزر)، خطأ (toast أحمر عبر Sonner)، نجاح (toast أخضر + تحويل).
- روابط تنقّل بين login/signup عبر `@/i18n/navigation` Link.
- ربط أزرار Landing الثلاثة بصفحات `/login` و `/signup`.

**مفاتيح i18n الجديدة (أضفها في ar.json و en.json تحت "Auth"):**
`title, loginTitle, signupTitle, email, password, fullName, companyName, loginCta, signupCta, haveAccount, noAccount, loginSuccess, signupSuccess, invalidCredentials, genericError`.

---

## التحقق
- زيارة `/dashboard` بدون تسجيل → تحويل إلى `/login`.
- بعد تسجيل الدخول → الوصول مسموح.
- `npm run build` ينجح.
- يعمل RTL/LTR + Dark/Light.

> ⚠️ `bootstrap_tenant` و جدول `memberships` يُنشآن في PHASE 03. إن نفّذت P2 قبل P3، اجعل `signUp` تكتفي بإنشاء المستخدم وأضف TODO لاستدعاء RPC، ثم أكمله بعد P3.
