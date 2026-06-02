'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { motion, AnimatePresence } from 'framer-motion';
import { RefreshCw, CheckCircle2 } from 'lucide-react';
import { pendingCount } from '@/lib/offline/queue';

export function SyncIndicator() {
  const t = useTranslations('System');
  const [count, setCount] = useState(0);
  const [justSynced, setJustSynced] = useState(false);

  useEffect(() => {
    let prev = 0;
    const poll = async () => {
      try {
        const n = await pendingCount();
        if (prev > 0 && n === 0) {
          setJustSynced(true);
          setTimeout(() => setJustSynced(false), 2500);
        }
        prev = n;
        setCount(n);
      } catch {
        // IndexedDB unavailable (private mode / browser restriction) — silent
      }
    };
    poll();
    const id = setInterval(poll, 3000);
    return () => clearInterval(id);
  }, []);

  const visible = count > 0 || justSynced;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          className="flex items-center gap-1.5 rounded-full border border-border/60 bg-background/80 px-2.5 py-1 text-xs backdrop-blur-sm"
        >
          {justSynced ? (
            <>
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
              <span className="text-emerald-600 dark:text-emerald-400 font-medium">{t('syncDoneShort')}</span>
            </>
          ) : (
            <>
              <RefreshCw className="h-3.5 w-3.5 animate-spin text-amber-500" />
              <span className="tabular-nums text-amber-600 dark:text-amber-400 font-medium">
                {new Intl.NumberFormat('en-US').format(count)} {t('pending')}
              </span>
            </>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
