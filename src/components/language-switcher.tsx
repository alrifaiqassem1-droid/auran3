'use client';
import { useLocale } from 'next-intl';
import { Globe } from 'lucide-react';
import { usePathname, useRouter } from '@/i18n/navigation';

export function LanguageSwitcher() {
  const locale   = useLocale();
  const router   = useRouter();
  const pathname = usePathname();
  const target   = locale === 'ar' ? 'en' : 'ar';

  return (
    <button
      onClick={() => router.replace(pathname, { locale: target })}
      className="flex h-7 items-center gap-1 rounded-lg bg-black/5 dark:bg-white/8 px-2 text-[11px] font-semibold text-foreground/50 dark:text-white/50 hover:bg-black/8 dark:hover:bg-white/12 transition-colors duration-200"
      aria-label={`Switch to ${target.toUpperCase()}`}
    >
      <Globe className="h-3 w-3" />
      <span>{locale.toUpperCase()}</span>
    </button>
  );
}
