import { cn } from '@/lib/utils';

/* ─── primitives ─────────────────────────────────────────────────────────── */

function S({ className }: { className?: string }) {
  return <div className={cn('shimmer-auto', className)} />;
}

/* ─── TopBar skeleton (52px — mirrors TopBar exactly) ────────────────────── */
export function TopBarSkeleton() {
  return (
    <div className="flex h-[52px] shrink-0 items-center justify-between border-b border-border/40 bg-[#fafaf8] dark:bg-[#0d0d0d] px-3">
      <div className="flex items-center gap-1.5">
        <S className="h-7 w-7 !rounded-lg" />
        <S className="h-7 w-[52px] !rounded-lg" />
      </div>
      <div className="flex items-center gap-2.5">
        <S className="h-7 w-[110px] !rounded-lg" />
        <S className="h-4 w-14 !rounded" />
      </div>
    </div>
  );
}

/* ─── BottomNav skeleton (64px+safe-area — mirrors BottomNav exactly) ───── */
export function BottomNavSkeleton() {
  return (
    <div
      aria-hidden
      className="fixed bottom-0 inset-x-0 z-40 flex items-center justify-around border-t border-border/40 bg-[#fafaf8] dark:bg-[#0d0d0d] px-2 md:hidden"
      style={{
        height: 'calc(64px + env(safe-area-inset-bottom, 0px))',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}
    >
      {/* Home */}
      <div className="flex flex-1 flex-col items-center justify-center gap-1">
        <S className="h-8 w-8 !rounded-lg" />
        <S className="h-2.5 w-8 !rounded" />
      </div>
      {/* Receiving */}
      <div className="flex flex-1 flex-col items-center justify-center gap-1">
        <S className="h-8 w-8 !rounded-lg" />
        <S className="h-2.5 w-10 !rounded" />
      </div>
      {/* SCAN FAB */}
      <div className="flex flex-1 items-center justify-center">
        <div className="relative -top-3 h-12 w-12 rounded-full bg-[#EF9F27]/20 ring-[3px] ring-[#fafaf8] dark:ring-[#0d0d0d]" />
      </div>
      {/* Inventory */}
      <div className="flex flex-1 flex-col items-center justify-center gap-1">
        <S className="h-8 w-8 !rounded-lg" />
        <S className="h-2.5 w-8 !rounded" />
      </div>
      {/* More */}
      <div className="flex flex-1 flex-col items-center justify-center gap-1">
        <S className="h-8 w-8 !rounded-lg" />
        <S className="h-2.5 w-8 !rounded" />
      </div>
    </div>
  );
}

/* ─── KPI cards grid — used as Suspense fallback inside page.tsx ─────────── */
export function BentoSkeletonCards() {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
      {/* Row 1 mobile: 2 square cards. Desktop: each spans 2/4 cols */}
      <S className="col-span-1 aspect-square lg:col-span-2 lg:aspect-auto lg:h-[136px]" />
      <S className="col-span-1 aspect-square lg:col-span-2 lg:aspect-auto lg:h-[136px]" />
      {/* Row 2 mobile: wide. Desktop: 3/4 width */}
      <S className="col-span-2 h-[136px] lg:col-span-3" />
      {/* Row 3 mobile: medium. Desktop: 1/4 width */}
      <S className="col-span-2 h-[136px] lg:col-span-1" />
    </div>
  );
}

/* ─── Content area (header + cards) — used by loading.tsx inside AppShell ── */
export function BentoSkeletonContent() {
  return (
    <div className="p-4 lg:p-6 max-w-4xl mx-auto">
      <div className="mb-6 space-y-2">
        <S className="h-3 w-14 !rounded" />
        <S className="h-8 w-48 !rounded-lg" />
      </div>
      <BentoSkeletonCards />
    </div>
  );
}

/* ─── Full-page standalone skeleton (TopBar + content + BottomNav) ───────── */
export function BentoSkeleton() {
  return (
    <div className="flex h-[100dvh] flex-col">
      <TopBarSkeleton />
      <div className="flex-1 overflow-hidden">
        <BentoSkeletonContent />
      </div>
      <BottomNavSkeleton />
    </div>
  );
}
