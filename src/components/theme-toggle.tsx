'use client';
import { useRef, useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import { AnimatePresence, motion } from 'framer-motion';
import { Moon, Sun } from 'lucide-react';

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const ref = useRef<HTMLButtonElement>(null);
  const isDark = resolvedTheme === 'dark';

  useEffect(() => { setMounted(true); }, []);

  if (!mounted) {
    return <div className="h-7 w-7 rounded-lg bg-black/5 dark:bg-white/[0.08]" />;
  }

  const toggle = async () => {
    const next = isDark ? 'light' : 'dark';
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!ref.current || !document.startViewTransition || reduce) {
      setTheme(next);
      return;
    }
    await document.startViewTransition(() => setTheme(next)).ready;
    const { top, left, width, height } = ref.current.getBoundingClientRect();
    const x = left + width / 2, y = top + height / 2;
    const end = Math.hypot(Math.max(left, innerWidth - left), Math.max(top, innerHeight - top));
    document.documentElement.animate(
      { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${end}px at ${x}px ${y}px)`] },
      { duration: 650, easing: 'cubic-bezier(0.65,0,0.35,1)', pseudoElement: '::view-transition-new(root)' }
    );
  };

  return (
    <button
      ref={ref}
      onClick={toggle}
      aria-label="Toggle theme"
      className="flex h-7 w-7 items-center justify-center rounded-lg bg-black/5 dark:bg-white/[0.08] hover:bg-black/10 dark:hover:bg-white/[0.12] transition-colors duration-200 text-foreground/60 dark:text-white/60"
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={isDark ? 'moon' : 'sun'}
          initial={{ rotate: -90, opacity: 0, scale: 0.5 }}
          animate={{ rotate: 0, opacity: 1, scale: 1 }}
          exit={{ rotate: 90, opacity: 0, scale: 0.5 }}
          transition={{ duration: 0.25 }}
        >
          {isDark ? <Moon className="h-3.5 w-3.5" /> : <Sun className="h-3.5 w-3.5" />}
        </motion.span>
      </AnimatePresence>
    </button>
  );
}
