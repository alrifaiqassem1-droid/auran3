export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-[100dvh] flex-col items-center justify-center overflow-hidden p-4">
      <div aria-hidden className="pointer-events-none absolute left-1/2 top-1/2 -z-10 h-[36rem] w-[36rem] -translate-x-1/2 -translate-y-1/2">
        <div className="absolute inset-0 animate-aura-breathe rounded-full bg-primary/20 blur-[100px]" />
      </div>
      {children}
    </div>
  );
}
