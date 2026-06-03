'use client';
import { useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { useOnlineStatus } from '@/hooks/use-online-status';
import { flushQueue, pendingCount } from '@/lib/offline/queue';

export function OfflineBanner() {
  const t = useTranslations('System');
  const { isOffline, isReconnected } = useOnlineStatus();
  const hasSynced = useRef(false);

  useEffect(() => {
    if (!isReconnected || hasSynced.current) return;
    hasSynced.current = true;
    pendingCount().then((n) => {
      if (n === 0) {
        toast.success(t('backOnline'));
        hasSynced.current = false;
        return;
      }
      toast.loading(t('syncing'), { id: 'sync-toast' });
      flushQueue().then(({ done, failed }) => {
        toast.dismiss('sync-toast');
        if (failed === 0) {
          toast.success(t('syncDone', { n: done }));
        } else {
          toast.warning(t('syncPartial', { done, failed }));
        }
        hasSynced.current = false;
      }).catch(() => { hasSynced.current = false; });
    }).catch(() => { hasSynced.current = false; });
  }, [isReconnected, t]);

  useEffect(() => {
    if (isOffline) hasSynced.current = false;
  }, [isOffline]);

  return (
    <AnimatePresence>
      {isOffline && (
        <motion.div
          key="offline"
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
          className="overflow-hidden"
        >
          <div className="flex items-center gap-2 px-4 py-1.5 border-b border-[#EF9F27]/20 bg-[rgba(186,117,23,0.07)] dark:bg-[rgba(239,159,39,0.12)] text-[#ba7517] dark:text-[#EF9F27]">
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#EF9F27]" />
            <span className="flex-1 text-xs font-medium">{t('offline')}</span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
