'use client';
import { useState } from 'react';
import { usePathname, Link } from '@/i18n/navigation';
import { useTranslations, useLocale } from 'next-intl';
import { MoreHorizontal } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { SignOutButton } from './sign-out-button';
import { cn } from '@/lib/utils';
import { navItems, bottomPrimaryKeys, bottomSecondaryKeys } from './nav-config';
import type { UserRole } from '@/types/db';

const SCANNER_HREFS = new Set([
  '/dashboard/scan',
  '/dashboard/receiving',
  '/dashboard/damaged',
  '/dashboard/stocktake',
  '/dashboard/count',
]);

type Props = { role: UserRole };

export function BottomNav({ role }: Props) {
  const t        = useTranslations('Nav');
  const pathname = usePathname();
  const locale   = useLocale();
  const [moreOpen, setMoreOpen] = useState(false);

  const primary   = navItems.filter((n) => bottomPrimaryKeys.includes(n.key));
  const secondary = navItems.filter(
    (n) => bottomSecondaryKeys.includes(n.key) && (!n.roles || n.roles.includes(role)),
  );

  return (
    <>
      <nav
        className="fixed bottom-0 inset-x-0 z-40 flex items-stretch border-t border-border/40 bg-[#fafaf8] dark:bg-[#0d0d0d] transition-colors duration-200 md:hidden"
        style={{
          height: 'calc(64px + env(safe-area-inset-bottom, 0px))',
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
          willChange: 'transform',
        }}
      >
        {primary.map((item) => {
          const Icon = item.icon;
          const isActive =
            pathname === item.href ||
            (item.href !== '/dashboard' && pathname.startsWith(item.href));

          /* Center FAB — SCAN */
          if (item.isFab) {
            return (
              <div key={item.key} className="flex flex-1 items-center justify-center">
                <a
                  href={`/${locale}${item.href}`}
                  className="relative -top-3 flex h-12 w-12 items-center justify-center rounded-full bg-[#EF9F27] ring-[3px] ring-[#fafaf8] dark:ring-[#0d0d0d] shadow-lg shadow-[#EF9F27]/30 transition-transform duration-200 active:scale-95"
                >
                  <Icon className="h-5 w-5 text-white" />
                </a>
              </div>
            );
          }

          const itemClassName = 'flex flex-1 flex-col items-center justify-center gap-1 transition-colors duration-200';
          const inner = (
            <>
              <div
                className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-lg transition-colors duration-200',
                  isActive
                    ? 'bg-[#EF9F27]/[0.12] border border-[#EF9F27]/30 text-[#EF9F27]'
                    : 'bg-black/[0.04] dark:bg-white/[0.05] text-foreground/50 dark:text-white/40',
                )}
              >
                <Icon className="h-4 w-4" />
              </div>
              <span
                className={cn(
                  'text-[10px] leading-none transition-colors duration-200',
                  isActive
                    ? 'font-bold text-[#EF9F27]'
                    : 'font-medium text-foreground/50 dark:text-white/40',
                )}
              >
                {t(item.key as Parameters<typeof t>[0])}
              </span>
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

        {/* More button */}
        {secondary.length > 0 && (
          <button
            onClick={() => setMoreOpen(true)}
            className="flex flex-1 flex-col items-center justify-center gap-1 transition-colors duration-200"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-black/[0.04] dark:bg-white/[0.05] text-foreground/50 dark:text-white/40">
              <MoreHorizontal className="h-4 w-4" />
            </div>
            <span className="text-[10px] font-medium leading-none text-foreground/50 dark:text-white/40">
              {t('more')}
            </span>
          </button>
        )}
      </nav>

      {/* Secondary items sheet */}
      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl">
          <SheetHeader className="sr-only">
            <SheetTitle>{t('more')}</SheetTitle>
          </SheetHeader>
          <div className="grid grid-cols-3 gap-3 pt-4 pb-2">
            {secondary.map((item) => {
              const Icon     = item.icon;
              const isActive = pathname.startsWith(item.href);
              const sheetClassName = cn(
                'flex flex-col items-center gap-2 rounded-xl p-3 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-[#EF9F27]/[0.12] text-[#EF9F27]'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              );
              const sheetInner = (
                <>
                  <Icon className="h-6 w-6" />
                  {t(item.key as Parameters<typeof t>[0])}
                </>
              );

              return SCANNER_HREFS.has(item.href) ? (
                <a
                  key={item.key}
                  href={`/${locale}${item.href}`}
                  className={sheetClassName}
                >
                  {sheetInner}
                </a>
              ) : (
                <Link
                  key={item.key}
                  href={item.href as string}
                  onClick={() => setMoreOpen(false)}
                  className={sheetClassName}
                >
                  {sheetInner}
                </Link>
              );
            })}
          </div>
          <div className="border-t border-border/40 pt-2">
            <SignOutButton className="justify-center" />
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
