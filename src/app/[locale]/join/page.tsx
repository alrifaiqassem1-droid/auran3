import { Suspense } from 'react';
import { JoinClient } from './join-client';

export default function JoinPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-[100dvh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    }>
      <JoinClient />
    </Suspense>
  );
}
