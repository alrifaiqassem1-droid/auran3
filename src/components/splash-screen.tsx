'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { ScanLine } from 'lucide-react';

export function SplashScreen() {
  const t = useTranslations('Splash');
  const [visible, setVisible] = useState(false);
  const [fading, setFading] = useState(false);

  // Show once per browser session — never on repeat navigations
  useEffect(() => {
    if (!sessionStorage.getItem('auran_splash')) {
      sessionStorage.setItem('auran_splash', '1');
      setVisible(true);
    }
  }, []);

  if (!visible) return null;

  return (
    <div
      role="status"
      aria-label={t('loading')}
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-black select-none"
      style={{
        opacity: fading ? 0 : 1,
        transition: fading ? 'opacity 0.4s ease' : undefined,
        pointerEvents: fading ? 'none' : undefined,
      }}
      onTransitionEnd={() => { if (fading) setVisible(false); }}
    >
      {/* Pulse rings + icon */}
      <div className="relative flex items-center justify-center">
        {/* Outer ring */}
        <div
          aria-hidden
          className="absolute h-40 w-40 rounded-full"
          style={{
            background: 'rgba(239,159,39,0.15)',
            animation: 'pulse-ring 3s ease-in-out infinite',
          }}
        />
        {/* Inner ring */}
        <div
          aria-hidden
          className="absolute h-28 w-28 rounded-full"
          style={{
            background: 'rgba(239,159,39,0.25)',
            animation: 'pulse-ring 2.5s ease-in-out 0.3s infinite',
          }}
        />
        {/* Icon container — 44px rounded square */}
        <div className="relative flex h-11 w-11 items-center justify-center rounded-xl bg-[#EF9F27]/10 border border-[#EF9F27]/20">
          <ScanLine className="h-5 w-5 text-[#EF9F27]" />
        </div>
      </div>

      {/* AURAN + subtitle */}
      <div className="mt-8 flex flex-col items-center gap-1.5">
        <span
          className="text-sm font-black text-[#EF9F27]"
          style={{ letterSpacing: '6px' }}
        >
          AURAN
        </span>
        <span className="text-[10px] font-medium tracking-[0.25em] text-white/35 uppercase">
          {t('tagline')}
        </span>
      </div>

      {/* Progress bar — fade-out triggered by onAnimationEnd (not setTimeout) */}
      <div className="mt-7 h-[2px] w-[120px] overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-gradient-to-r from-[#EF9F27]/50 to-[#EF9F27]"
          style={{ animation: 'splash-progress 3.5s ease-in-out forwards' }}
          onAnimationEnd={() => setFading(true)}
        />
      </div>

      {/* Loading text */}
      <p className="mt-3 text-[11px] tracking-wide text-white/35">
        {t('loading')}
      </p>
    </div>
  );
}
