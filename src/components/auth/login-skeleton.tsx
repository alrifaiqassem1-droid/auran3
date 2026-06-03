/**
 * Login page skeleton — renders inside AuthLayout (centered flex container).
 * Matches AuthCard + LoginPage dimensions exactly for zero CLS.
 * Real AURAN brand text is kept visible per spec; form fields are shimmer.
 */
export function LoginSkeleton() {
  return (
    <>
      {/* Top controls skeleton — mirrors AuthCard's absolute lang/theme toggles */}
      <div className="absolute start-5 top-5 flex items-center gap-3">
        <div className="shimmer h-7 w-[52px] !rounded-lg" />
        <div className="shimmer h-7 w-7 !rounded-lg" />
      </div>

      {/* Card area — same max-width as AuthCard */}
      <div className="w-full max-w-sm">
        {/* Real AURAN brand text (not a skeleton, per spec) */}
        <div className="mb-6 text-center">
          <span className="text-xs font-semibold tracking-[0.35em] text-muted-foreground">
            AURAN
          </span>
        </div>

        {/* Card shell — same classes as the real Card in AuthCard */}
        <div className="overflow-hidden rounded-[0.9rem] border border-border/60 bg-card/60 backdrop-blur-md shadow-2xl">
          {/* Header — matches CardHeader pb-4 */}
          <div className="flex justify-center px-6 pb-4 pt-6">
            <div className="shimmer h-7 w-28 !rounded-lg" />
          </div>

          {/* Content — matches CardContent p-6 pt-0 */}
          <div className="space-y-4 px-6 pb-6">
            {/* Email field */}
            <div className="space-y-1.5">
              <div className="shimmer h-4 w-20 !rounded" />
              <div className="shimmer h-10 w-full !rounded-lg" />
            </div>

            {/* Password field */}
            <div className="space-y-1.5">
              <div className="shimmer h-4 w-24 !rounded" />
              <div className="shimmer h-10 w-full !rounded-lg" />
            </div>

            {/* Submit button */}
            <div className="shimmer mt-2 h-10 w-full !rounded-lg" />

            {/* Signup link */}
            <div className="flex justify-center pt-0.5">
              <div className="shimmer h-4 w-40 !rounded" />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
