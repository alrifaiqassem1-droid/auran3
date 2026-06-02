'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { acceptInvitation } from '@/app/[locale]/(dashboard)/dashboard/settings/roles/actions';

export function JoinClient() {
  const params = useSearchParams();
  const router = useRouter();
  const token  = params.get('token') ?? '';

  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [error, setError]   = useState('');

  useEffect(() => {
    if (!token) { setStatus('error'); setError('رابط الدعوة غير صالح'); return; }

    acceptInvitation(token).then((res) => {
      if (res.ok) {
        setStatus('success');
        setTimeout(() => router.push('/dashboard'), 2000);
      } else {
        setStatus('error');
        setError(res.error ?? 'فشل قبول الدعوة');
      }
    });
  }, [token, router]);

  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-6 p-6 text-center">
      {status === 'loading' && (
        <>
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
          <p className="text-lg font-semibold">جارٍ معالجة الدعوة...</p>
        </>
      )}
      {status === 'success' && (
        <>
          <CheckCircle2 className="h-16 w-16 text-emerald-500" />
          <div>
            <p className="text-xl font-bold">تم قبول الدعوة!</p>
            <p className="mt-1 text-sm text-muted-foreground">جارٍ الانتقال للوحة التحكم...</p>
          </div>
        </>
      )}
      {status === 'error' && (
        <>
          <XCircle className="h-16 w-16 text-destructive" />
          <div>
            <p className="text-xl font-bold">فشل القبول</p>
            <p className="mt-1 text-sm text-muted-foreground">{error}</p>
          </div>
          <Button onClick={() => router.push('/dashboard')} className="rounded-xl">
            الذهاب للوحة التحكم
          </Button>
        </>
      )}
    </div>
  );
}
