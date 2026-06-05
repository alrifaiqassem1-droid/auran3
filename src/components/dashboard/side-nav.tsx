'use client';
import { useState, useEffect } from 'react';
import { usePathname, Link } from '@/i18n/navigation';
import { useTranslations, useLocale } from 'next-intl';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { navItems } from './nav-config';
import { pendingCount } from '@/lib/offline/queue';
import { SignOutButton } from './sign-out-button';
import type { UserRole } from '@/types/db';

const SCANNER_HREFS = new Set([
  '/dashboard/scan',
  '/dashboard/receiving',
  '/dashboard/damaged',
  '/dashboard/stocktake',
  '/dashboard/count',
]);

type Props = { role: UserRole };

function PendingBadge() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const poll = async () => {
      try {
        const n = await pendingCount();
        setCount(n);
      } catch {
        // IndexedDB unavailable — silent
      }
    };
    poll();
    const id = setInterval(poll, 4000);
    return () => clearInterval(id);
  }, []);

  if (count === 0) return null;

  return (
    <span className="ms-auto rounded-full bg-amber-500 px-1.5 text-[10px] font-bold tabular-nums text-white">
      {new Intl.NumberFormat('en-US').format(count)}
    </span>
  );
}

export function SideNav({ role }: Props) {
  const t        = useTranslations('Nav');
  const pathname = usePathname();
  const locale   = useLocale();

  const visible = navItems.filter((n) => !n.roles || n.roles.includes(role));

  return (
    <aside className="hidden md:flex w-56 shrink-0 flex-col border-e border-border/50 bg-background/50 h-[calc(100dvh-3.5rem)] sticky top-14 overflow-y-auto">
      <nav className="flex flex-col gap-0.5 p-3 pt-4 flex-1">
        {visible.map((item) => {
          const Icon = item.icon;
          const isActive =
            pathname === item.href ||
            (item.href !== '/dashboard' && pathname.startsWith(item.href));

          const itemClassName = cn(
            'group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
            isActive
              ? 'text-primary'
              : 'text-muted-foreground hover:bg-muted hover:text-foreground',
          );
          const inner = (
            <>
              {isActive && (
                <motion.div
                  layoutId="side-active"
                  className="absolute inset-0 rounded-xl bg-primary/10"
                  transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                />
              )}
              <Icon className={cn('relative h-4 w-4 shrink-0', item.isFab && 'text-primary')} />
              <span className="relative flex-1">{t(item.key as Parameters<typeof t>[0])}</span>
              {(item.key === 'receiving' || item.key === 'inventory' || item.key === 'damaged') && (
                <PendingBadge />
              )}
              {item.isFab && (
                <span className="relative ms-auto h-2 w-2 rounded-full bg-primary" />
              )}
            </>
          );

          return SCANNER_HREFS.has(item.href) ? (
            <a key={item.key} href={`/${locale}${item.href}`} className={itemClassName}>
              {inner}
            </a>
          ) : (
            <Link key={item.key} href={item.href as string} className={itemClassName}>
              {inner}
            </Link>
          );
        })}
      </nav>
      <div className="p-3 border-t border-border/40">
        <SignOutButton />
      </div>
    </aside>
  );
}
