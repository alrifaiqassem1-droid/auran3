'use client';
import { useState } from 'react';
import { usePathname, Link } from '@/i18n/navigation';
import { useTranslations } from 'next-intl';
import { motion, useReducedMotion } from 'framer-motion';
import { MoreHorizontal } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { navItems, bottomPrimaryKeys, bottomSecondaryKeys } from './nav-config';
import type { UserRole } from '@/types/db';

type Props = { role: UserRole };

export function BottomNav({ role }: Props) {
  const t       = useTranslations('Nav');
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const reduced  = useReducedMotion();

  const primary   = navItems.filter((n) => bottomPrimaryKeys.includes(n.key));
  const secondary = navItems.filter(
    (n) => bottomSecondaryKeys.includes(n.key) && (!n.roles || n.roles.includes(role)),
  );

  return (
    <>
      {/*
        md:hidden  → hidden on tablet & desktop (sidebar takes over)
        Height accounts for iOS safe-area so the home-indicator isn't covered.
        Items are centered in the top 4rem; safe-area is additional padding below.
      */}
      <nav
        className="fixed bottom-0 inset-x-0 z-40 flex items-stretch border-t border-border/50 bg-background/95 backdrop-blur-md md:hidden"
        style={{
          height: 'calc(4rem + env(safe-area-inset-bottom, 0px))',
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
          willChange: 'transform',   /* GPU layer → no iOS Safari jitter */
        }}
      >
        {/* ── 5 primary items ──────────────────────────────── */}
        {primary.map((item) => {
          const Icon = item.icon;
          const isActive =
            pathname === item.href ||
            (item.href !== '/dashboard' && pathname.startsWith(item.href));

          /* FAB — scan button (golden, floats above nav) */
          if (item.isFab) {
            return (
              <div key={item.key} className="flex flex-1 items-center justify-center">
                <Link
                  href={item.href as string}
                  className={cn(
                    'relative -top-5 flex h-14 w-14 items-center justify-center rounded-full',
                    'bg-primary shadow-lg shadow-primary/40',
                    'ring-4 ring-background',          /* white ring separates from nav */
                    'transition-transform active:scale-95',
                  )}
                >
                  <Icon className="h-6 w-6 text-primary-foreground" />
                </Link>
              </div>
            );
          }

          return (
            <Link
              key={item.key}
              href={item.href as string}
              className={cn(
                'flex flex-1 flex-col items-center justify-center gap-0.5 text-xs font-medium transition-colors',
                isActive ? 'text-primary' : 'text-muted-foreground',
              )}
            >
              <motion.div
                animate={isActive && !reduced ? { scale: 1.15 } : { scale: 1 }}
                transition={{ type: 'spring', stiffness: 400, damping: 20 }}
              >
                <Icon className="h-5 w-5" />
              </motion.div>
              <span className="leading-none">{t(item.key as Parameters<typeof t>[0])}</span>
            </Link>
          );
        })}

        {/* ── More button → secondary sheet ────────────────── */}
        {secondary.length > 0 && (
          <button
            onClick={() => setMoreOpen(true)}
            className="flex flex-1 flex-col items-center justify-center gap-0.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <MoreHorizontal className="h-5 w-5" />
            <span className="leading-none">{t('more')}</span>
          </button>
        )}
      </nav>

      {/* ── Secondary items sheet ─────────────────────────── */}
      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl">
          <SheetHeader className="sr-only">
            <SheetTitle>{t('more')}</SheetTitle>
          </SheetHeader>
          <div className="grid grid-cols-3 gap-3 py-4">
            {secondary.map((item) => {
              const Icon     = item.icon;
              const isActive = pathname.startsWith(item.href);
              return (
                <Link
                  key={item.key}
                  href={item.href as string}
                  onClick={() => setMoreOpen(false)}
                  className={cn(
                    'flex flex-col items-center gap-2 rounded-xl p-3 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                  )}
                >
                  <Icon className="h-6 w-6" />
                  {t(item.key as Parameters<typeof t>[0])}
                </Link>
              );
            })}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
