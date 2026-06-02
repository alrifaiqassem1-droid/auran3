'use client';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { AuthCard } from '@/components/auth/auth-card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Link } from '@/i18n/navigation';
import { loginSchema, type LoginInput } from '@/lib/validators/auth';
import { signIn } from '../actions';

// Error keys returned by signIn that map to Auth translation namespace
const AUTH_ERROR_KEYS = [
  'invalidCredentials', 'tooManyAttempts', 'accountLocked', 'genericError',
] as const;
type AuthErrorKey = (typeof AUTH_ERROR_KEYS)[number];
function isAuthErrorKey(key: string): key is AuthErrorKey {
  return AUTH_ERROR_KEYS.includes(key as AuthErrorKey);
}

export default function LoginPage() {
  const t = useTranslations('Auth');
  const [loading, setLoading] = useState(false);

  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  async function onSubmit(data: LoginInput) {
    setLoading(true);
    const result = await signIn(data);
    setLoading(false);
    if (result?.ok === false) {
      const key = isAuthErrorKey(result.error) ? result.error : 'genericError';
      toast.error(t(key));
    }
  }

  return (
    <AuthCard title={t('loginTitle')}>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('email')}</FormLabel>
                <FormControl>
                  <Input type="email" autoComplete="email" dir="ltr" placeholder="you@example.com" {...field} />
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
                  <Input type="password" autoComplete="current-password" dir="ltr" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button type="submit" className="w-full mt-2" disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : t('loginCta')}
          </Button>
        </form>
      </Form>
      <p className="mt-4 text-center text-sm text-muted-foreground">
        {t('noAccount')}{' '}
        <Link href="/signup" className="font-medium text-primary hover:underline">
          {t('signupCta')}
        </Link>
      </p>
    </AuthCard>
  );
}
