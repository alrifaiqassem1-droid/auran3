'use client';
import { useState, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Loader2, Eye, EyeOff } from 'lucide-react';
import { AuthCard } from '@/components/auth/auth-card';
import { GoogleButton } from '@/components/auth/google-button';
import { PasswordStrength } from '@/components/auth/password-strength';
import { HCaptchaWidget, type HCaptchaHandle } from '@/components/auth/hcaptcha-widget';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Link } from '@/i18n/navigation';
import { signupSchema, type SignupInput } from '@/lib/validators/auth';
import { signUp } from '../actions';

export default function SignupPage() {
  const t = useTranslations('Auth');
  const [loading, setLoading]           = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const captchaRef = useRef<HCaptchaHandle>(null);

  const form = useForm<SignupInput>({
    resolver: zodResolver(signupSchema),
    defaultValues: { email: '', password: '', fullName: '', companyName: '' },
  });

  const password = form.watch('password');

  async function onSubmit(data: SignupInput) {
    setLoading(true);
    const result = await signUp(data, captchaToken ?? undefined);
    setLoading(false);

    if (result?.ok === false) {
      captchaRef.current?.reset();
      setCaptchaToken(null);

      const errKey = result.error as string;
      const knownKeys = ['genericError', 'emailAlreadyUsed', 'tooManyAttempts',
        'passwordTooShort', 'passwordNeedsUppercase', 'passwordNeedsNumber', 'passwordNeedsSpecial'];
      const msg = knownKeys.includes(errKey) ? t(errKey as Parameters<typeof t>[0]) : t('genericError');
      toast.error(msg);
    }
  }

  return (
    <AuthCard title={t('signupTitle')}>
      <GoogleButton />

      <div className="flex items-center gap-3 my-5">
        <div className="flex-1 h-px bg-border" />
        <span className="text-xs text-muted-foreground">{t('continueWithEmail')}</span>
        <div className="flex-1 h-px bg-border" />
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="fullName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('fullName')}</FormLabel>
                <FormControl>
                  <Input autoComplete="name" className="rounded-xl h-11" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="companyName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('companyName')}</FormLabel>
                <FormControl>
                  <Input className="rounded-xl h-11" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('email')}</FormLabel>
                <FormControl>
                  <Input
                    type="email"
                    autoComplete="email"
                    dir="ltr"
                    placeholder="you@example.com"
                    className="rounded-xl h-11"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('password')}</FormLabel>
                <FormControl>
                  <div className="relative">
                    <Input
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      dir="ltr"
                      className="rounded-xl h-11 pe-10"
                      {...field}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(s => !s)}
                      className="absolute end-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </FormControl>
                <PasswordStrength password={password} />
                <FormMessage />
              </FormItem>
            )}
          />

          <HCaptchaWidget
            ref={captchaRef}
            onVerify={setCaptchaToken}
            onExpire={() => setCaptchaToken(null)}
          />

          <Button type="submit" className="w-full mt-2 rounded-xl" disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : t('signupCta')}
          </Button>
        </form>
      </Form>
      <p className="mt-4 text-center text-sm text-muted-foreground">
        {t('haveAccount')}{' '}
        <Link href="/login" className="font-medium text-primary hover:underline">
          {t('loginCta')}
        </Link>
      </p>
    </AuthCard>
  );
}
