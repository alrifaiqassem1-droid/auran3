import { cn } from '@/lib/utils';

function ShimmerOverlay() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 bg-gradient-to-r from-transparent via-black/[0.04] to-transparent dark:via-white/[0.04] animate-[shimmer_1.8s_ease-in-out_infinite]"
    />
  );
}

function ShimmerCard({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-xl bg-[#f0eeea] dark:bg-[#161617]',
        className,
      )}
    >
      <ShimmerOverlay />
    </div>
  );
}

function ShimmerBar({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded bg-[#f0eeea] dark:bg-[#161617]',
        className,
      )}
    >
      <ShimmerOverlay />
    </div>
  );
}

/** Cards-only skeleton — used as Suspense fallback inside the page (header stays visible). */
export function BentoSkeletonCards() {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
      {/* Row 1 mobile: 2 small square cards. Desktop: each spans 2 of 4 cols, equal halves */}
      <ShimmerCard className="col-span-1 aspect-square lg:col-span-2 lg:aspect-auto lg:h-[136px]" />
      <ShimmerCard className="col-span-1 aspect-square lg:col-span-2 lg:aspect-auto lg:h-[136px]" />
      {/* Row 2 mobile: full-width wide card. Desktop: 3/4 width large */}
      <ShimmerCard className="col-span-2 h-[136px] lg:col-span-3" />
      {/* Row 3 mobile: full-width medium card. Desktop: 1/4 width */}
      <ShimmerCard className="col-span-2 h-[136px] lg:col-span-1" />
    </div>
  );
}

/** Full-page skeleton — used by loading.tsx and route-level loading state. */
export function BentoSkeleton() {
  return (
    <div className="p-4 lg:p-6 max-w-4xl mx-auto">
      <div className="mb-6 space-y-2">
        <ShimmerBar className="h-3 w-14" />
        <ShimmerBar className="h-8 w-48" />
      </div>
      <BentoSkeletonCards />
    </div>
  );
}
