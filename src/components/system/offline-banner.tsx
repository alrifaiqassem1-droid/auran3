'use client';

import { useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { motion, AnimatePresence } from 'framer-motion';
import { WifiOff, Wifi, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { useOnlineStatus } from '@/hooks/use-online-status';
import { flushQueue, pendingCount } from '@/lib/offline/queue';

export function OfflineBanner() {
  const t = useTranslations('System');
  const { status, isOffline, isReconnected } = useOnlineStatus();
  const hasSynced = useRef(false);

  // On reconnect: flush queue + show toast
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

  // Reset sync flag when going offline
  useEffect(() => {
    if (isOffline) hasSynced.current = false;
  }, [isOffline]);

  const visible = isOffline || isReconnected;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key={status}
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
          className="overflow-hidden"
        >
          <div
            className={
              isOffline
                ? 'flex items-center gap-2 bg-amber-500/15 px-4 py-2 text-amber-700 dark:text-amber-400 border-b border-amber-500/20'
                : 'flex items-center gap-2 bg-emerald-500/15 px-4 py-2 text-emerald-700 dark:text-emerald-400 border-b border-emerald-500/20'
            }
          >
            {isOffline ? (
              <WifiOff className="h-4 w-4 shrink-0" />
            ) : (
              <Wifi className="h-4 w-4 shrink-0" />
            )}
            <span className="flex-1 text-xs font-medium">
              {isOffline ? t('offline') : t('reconnected')}
            </span>
            {isReconnected && (
              <RefreshCw className="h-3.5 w-3.5 shrink-0 animate-spin" />
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
