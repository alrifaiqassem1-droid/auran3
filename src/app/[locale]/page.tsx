'use client';
import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/theme-toggle';
import { LanguageSwitcher } from '@/components/language-switcher';
import { Link } from '@/i18n/navigation';

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  show: (i: number) => ({ opacity: 1, y: 0, transition: { delay: 0.15 * i, duration: 0.7, ease: [0.22,1,0.36,1] } }),
};

export default function LandingPage() {
  const t = useTranslations('Landing');
  return (
    <main className="relative flex min-h-[100dvh] flex-col overflow-hidden">
      <div aria-hidden className="pointer-events-none absolute left-1/2 top-1/2 -z-10 h-[42rem] w-[42rem] -translate-x-1/2 -translate-y-1/2">
        <div className="absolute inset-0 animate-aura-breathe rounded-full bg-primary/25 blur-[120px]" />
        <div className="absolute inset-12 animate-aura-spin rounded-full border border-primary/20" />
        <div className="absolute inset-28 rounded-full border border-primary/10" />
      </div>
      <header className="flex items-center justify-between p-5">
        <span className="text-sm font-semibold tracking-[0.35em] text-muted-foreground">AURAN</span>
        <div className="flex items-center gap-3"><LanguageSwitcher /><ThemeToggle /></div>
      </header>
      <section className="flex flex-1 flex-col items-center justify-center px-6 text-center">
        <motion.h1 custom={0} variants={fadeUp} initial="hidden" animate="show"
          className="bg-gradient-to-b from-foreground via-foreground to-primary bg-clip-text text-6xl font-extrabold tracking-tight text-transparent sm:text-7xl">AURAN</motion.h1>
        <motion.p custom={1} variants={fadeUp} initial="hidden" animate="show" className="mt-6 text-2xl font-bold text-primary sm:text-3xl">{t('tagline')}</motion.p>
        <motion.p custom={2} variants={fadeUp} initial="hidden" animate="show" className="mt-4 max-w-md text-sm leading-relaxed text-muted-foreground sm:text-base">{t('subtitle')}</motion.p>
        <motion.div custom={3} variants={fadeUp} initial="hidden" animate="show" className="mt-12 flex w-full max-w-xs flex-col gap-3">
          <Button size="lg" className="w-full" asChild><Link href="/signup">{t('startFree')}</Link></Button>
          <Button size="lg" variant="outline" className="w-full" asChild><Link href="/login">{t('login')}</Link></Button>
          <Button size="lg" variant="ghost" className="w-full" asChild><Link href="/signup">{t('signup')}</Link></Button>
        </motion.div>
      </section>
      <footer className="pb-6 text-center text-xs text-muted-foreground">AURAN © 2026 · Dubai</footer>
    </main>
  );
}
