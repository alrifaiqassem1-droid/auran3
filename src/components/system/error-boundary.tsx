'use client';

import React from 'react';

interface Props {
  children: React.ReactNode;
}
interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('[AURAN] client error:', error.message);
      console.error('[AURAN] stack:', error.stack);
      console.error('[AURAN] component stack:', info.componentStack?.slice(0, 600));
    }
  }

  render() {
    if (this.state.hasError) {
      const { error } = this.state;
      const isDev = process.env.NODE_ENV === 'development';
      return (
        <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-4 p-6 text-center">
          <p className="text-xs font-black tracking-[0.3em] text-primary">AURAN</p>
          <h1 className="text-xl font-bold">حدث خطأ غير متوقع</h1>

          {error && (
            <div className="w-full max-w-sm rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-start">
              <p className="break-all font-mono text-xs font-semibold text-destructive">
                {error.message || String(error)}
              </p>
              {isDev && error.stack && (
                <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap break-all text-[10px] text-destructive/70">
                  {error.stack}
                </pre>
              )}
            </div>
          )}

          <p className="max-w-xs text-sm text-muted-foreground">
            يرجى إعادة تحميل الصفحة. إذا استمرت المشكلة تواصل مع الدعم.
          </p>
          <button
            onClick={() => {
              this.setState({ hasError: false, error: null });
              window.location.reload();
            }}
            className="mt-2 rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground"
          >
            إعادة التحميل
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
