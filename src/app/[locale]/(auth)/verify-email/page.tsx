'use client';
import { useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import { MailCheck, ArrowLeft } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { useCelebration } from '@/hooks/use-celebration';

export default function VerifyEmailPage() {
  const t = useTranslations('Auth');
  const { celebrate } = useCelebration();

  useEffect(() => {
    const timer = setTimeout(() => celebrate(), 300);
    return () => clearTimeout(timer);
  }, [celebrate]);

  return (
    <div className="relative flex min-h-[100dvh] flex-col items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-sm text-center"
      >
        {/* Icon */}
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.1, type: 'spring', stiffness: 300, damping: 18 }}
          className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-primary/10"
        >
          <MailCheck className="h-10 w-10 text-primary" />
        </motion.div>

        <p className="mb-1 text-xs font-black tracking-[0.3em] text-muted-foreground">AURAN</p>
        <h1 className="mb-3 text-2xl font-bold">{t('verifyEmailTitle')}</h1>
        <p className="mb-8 text-sm leading-relaxed text-muted-foreground">
          {t('verifyEmailDesc')}
        </p>

        <p className="text-xs text-muted-foreground">{t('verifyEmailHint')}</p>

        <Link
          href="/login"
          className="mt-8 inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
        >
          <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
          {t('backToLogin')}
        </Link>
      </motion.div>
    </div>
  );
}
