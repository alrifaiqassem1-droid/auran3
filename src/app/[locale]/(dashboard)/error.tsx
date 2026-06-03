'use client';

import { useEffect } from 'react';

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') {
      console.error('[AURAN] dashboard error:', error.message);
      console.error('[AURAN] stack:', error.stack);
    }
  }, [error]);

  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-4 p-6 text-center">
      <p className="text-xs font-black tracking-[0.3em] text-primary">AURAN</p>
      <h1 className="text-xl font-bold">حدث خطأ غير متوقع</h1>

      <div className="w-full max-w-sm rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-start">
        <p className="break-all font-mono text-xs font-semibold text-destructive">
          {error.message || 'Unknown error'}
        </p>
        {error.digest && (
          <p className="mt-1 font-mono text-[10px] text-destructive/60">
            digest: {error.digest}
          </p>
        )}
      </div>

      <p className="max-w-xs text-sm text-muted-foreground">
        يرجى إعادة تحميل الصفحة. إذا استمرت المشكلة تواصل مع الدعم.
      </p>
      <button
        onClick={reset}
        className="mt-2 rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground"
      >
        إعادة المحاولة
      </button>
    </div>
  );
}
