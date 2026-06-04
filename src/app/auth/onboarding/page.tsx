'use client';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion } from 'framer-motion';
import { Loader2, Eye, EyeOff, Check, X } from 'lucide-react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { ThemeToggle } from '@/components/theme-toggle';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { User } from '@supabase/supabase-js';

// ── Inline translations (page is outside next-intl routing) ──────────────────

const T = {
  ar: {
    title: 'أكمل حسابك',
    subtitle: 'خطوة أخيرة لبدء استخدام أوران',
    company: 'اسم الشركة / المتجر',
    companyPlaceholder: 'مثال: متجر الأمانة',
    companyRequired: 'اسم الشركة مطلوب (حرفان على الأقل)',
    password: 'كلمة المرور',
    submit: 'ابدأ الاستخدام',
    rules: {
      passwordTooShort:       '12 حرفاً على الأقل',
      passwordNeedsUppercase: 'حرف كبير واحد على الأقل',
      passwordNeedsNumber:    'رقم واحد على الأقل',
      passwordNeedsSpecial:   'رمز خاص واحد على الأقل (!@#$...)',
    },
    genericError: 'حدث خطأ، يرجى المحاولة مجدداً',
  },
  en: {
    title: 'Complete your account',
    subtitle: 'One last step to start using AURAN',
    company: 'Company / Store name',
    companyPlaceholder: 'e.g. Al Amanah Store',
    companyRequired: 'Company name is required (min 2 characters)',
    password: 'Password',
    submit: 'Start using AURAN',
    rules: {
      passwordTooShort:       'At least 12 characters',
      passwordNeedsUppercase: 'At least one uppercase letter',
      passwordNeedsNumber:    'At least one number',
      passwordNeedsSpecial:   'At least one special character (!@#$...)',
    },
    genericError: 'Something went wrong, please try again',
  },
} as const;

type Locale = keyof typeof T;

const PASSWORD_RULES: Array<{ key: keyof (typeof T)['en']['rules']; test: (p: string) => boolean }> = [
  { key: 'passwordTooShort',       test: (p) => p.length >= 12 },
  { key: 'passwordNeedsUppercase', test: (p) => /[A-Z]/.test(p) },
  { key: 'passwordNeedsNumber',    test: (p) => /[0-9]/.test(p) },
  { key: 'passwordNeedsSpecial',   test: (p) => /[^A-Za-z0-9]/.test(p) },
];

// ── Schema ────────────────────────────────────────────────────────────────────

const onboardingSchema = z.object({
  companyName: z.string().min(2).max(80),
  password: z.string()
    .min(12, 'passwordTooShort')
    .regex(/[A-Z]/, 'passwordNeedsUppercase')
    .regex(/[0-9]/, 'passwordNeedsNumber')
    .regex(/[^A-Za-z0-9]/, 'passwordNeedsSpecial'),
});
type OnboardingInput = z.infer<typeof onboardingSchema>;

// ── Helpers ───────────────────────────────────────────────────────────────────

function getLocale(): Locale {
  if (typeof document === 'undefined') return 'ar';
  const m = document.cookie.match(/(?:^|;\s*)NEXT_LOCALE=([^;]+)/);
  return m?.[1] === 'en' ? 'en' : 'ar';
}

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] } },
};

// ── Page ──────────────────────────────────────────────────────────────────────

export default function OnboardingPage() {
  const [locale, setLocale]             = useState<Locale>('ar');
  const [user, setUser]                 = useState<User | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading]           = useState(false);
  const [checking, setChecking]         = useState(true);

  const t   = T[locale];
  const dir = locale === 'ar' ? 'rtl' : 'ltr';

  const form = useForm<OnboardingInput>({
    resolver: zodResolver(onboardingSchema),
    defaultValues: { companyName: '', password: '' },
  });

  const password = form.watch('password');

  useEffect(() => {
    setLocale(getLocale());

    const supabase = createClient();

    // Use getUser() (server-validated) as the primary check.
    // Fall back to getSession() before redirecting to /login — this avoids
    // a false bounce when cookies have just been written but the async
    // getUser() network call races the hydration on the first render.
    supabase.auth.getUser().then(async ({ data: { user: verifiedUser } }) => {
      let resolvedUser = verifiedUser;

      if (!resolvedUser) {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) {
          window.location.replace('/login');
          return;
        }
        resolvedUser = session.user;
      }

      setUser(resolvedUser);

      const { data: membership } = await supabase
        .from('memberships')
        .select('id')
        .eq('user_id', resolvedUser.id)
        .maybeSingle();

      if (membership) {
        window.location.replace('/dashboard');
      } else {
        setChecking(false);
      }
    });
  }, []);

  async function onSubmit(data: OnboardingInput) {
    if (!user) return;
    setLoading(true);

    const supabase = createClient();

    const { error: pwError } = await supabase.auth.updateUser({ password: data.password });
    if (pwError) {
      console.error('[onboarding] updateUser error:', pwError.message);
      toast.error(t.genericError);
      setLoading(false);
      return;
    }

    const fullName = (user.user_metadata?.full_name as string | undefined)
                  || (user.user_metadata?.name      as string | undefined)
                  || '';

    const { error: rpcError } = await supabase.rpc('bootstrap_tenant', {
      p_user_id:   user.id,
      p_full_name: fullName,
      p_company:   data.companyName,
    });

    if (rpcError) {
      console.error('[onboarding] bootstrap_tenant error:', rpcError.message);
      // Log but don't block — treat as success; tenant creation may retry
    }

    window.location.replace('/dashboard');
  }

  // ── Loading / checking state ────────────────────────────────────────────────

  if (checking) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // ── Strength bar helpers ────────────────────────────────────────────────────

  const score    = PASSWORD_RULES.filter(r => r.test(password)).length;
  const barPct   = (score / PASSWORD_RULES.length) * 100;
  const barColor = score <= 1 ? 'bg-destructive'
                 : score <= 2 ? 'bg-amber-500'
                 : score <= 3 ? 'bg-yellow-400'
                 : 'bg-emerald-500';

  // ── Form ────────────────────────────────────────────────────────────────────

  return (
    <div dir={dir} className="relative flex min-h-[100dvh] flex-col items-center justify-center overflow-hidden p-4">
      {/* Aura glow */}
      <div aria-hidden className="pointer-events-none absolute left-1/2 top-1/2 -z-10 h-[36rem] w-[36rem] -translate-x-1/2 -translate-y-1/2">
        <div className="absolute inset-0 animate-aura-breathe rounded-full bg-primary/20 blur-[100px]" />
      </div>

      <div className="absolute start-5 top-5">
        <ThemeToggle />
      </div>

      <motion.div variants={fadeUp} initial="hidden" animate="show" className="w-full max-w-md">
        <div className="mb-6 text-center">
          <span className="text-3xl font-bold tracking-widest text-primary">AURAN</span>
        </div>

        <Card className="bg-card/60 backdrop-blur-md border-border/60 shadow-2xl">
          <CardHeader className="pb-2">
            <h1 className="text-center text-xl font-bold">{t.title}</h1>
            <p className="mt-1 text-center text-sm text-muted-foreground">{t.subtitle}</p>
          </CardHeader>

          <CardContent className="pt-4">
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">

              {/* Company name */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                  {t.company}
                </label>
                <Input
                  autoComplete="organization"
                  placeholder={t.companyPlaceholder}
                  className="rounded-xl h-11"
                  {...form.register('companyName')}
                />
                {form.formState.errors.companyName && (
                  <p className="text-xs text-destructive">{t.companyRequired}</p>
                )}
              </div>

              {/* Password */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                  {t.password}
                </label>
                <div className="relative">
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    dir="ltr"
                    className="rounded-xl h-11 pe-10"
                    {...form.register('password')}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(s => !s)}
                    className="absolute end-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>

                {/* Strength indicator */}
                {password.length > 0 && (
                  <div className="mt-2 space-y-2">
                    <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className={cn('h-full rounded-full transition-all duration-300', barColor)}
                        style={{ width: `${barPct}%` }}
                      />
                    </div>
                    <ul className="space-y-0.5">
                      {PASSWORD_RULES.map(rule => {
                        const ok = rule.test(password);
                        return (
                          <li
                            key={rule.key}
                            className={cn(
                              'flex items-center gap-1.5 text-[11px] transition-colors',
                              ok ? 'text-emerald-500' : 'text-muted-foreground'
                            )}
                          >
                            {ok ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                            {t.rules[rule.key]}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}
              </div>

              <Button type="submit" className="w-full mt-2 rounded-xl" disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : t.submit}
              </Button>
            </form>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
