'use client';
import { useLocale, useTranslations } from 'next-intl';
import { Globe } from 'lucide-react';
import { usePathname, useRouter } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';

export function LanguageSwitcher() {
  const locale = useLocale();
  const t = useTranslations('Landing');
  const router = useRouter();
  const pathname = usePathname();
  const target = locale === 'ar' ? 'en' : 'ar';
  return (
    <Button variant="icon" onClick={() => router.replace(pathname, { locale: target })} className="h-11 w-auto gap-2 px-4">
      <Globe className="h-4 w-4" />
      <span className="text-sm font-medium">{t('switchLanguage')}</span>
    </Button>
  );
}
