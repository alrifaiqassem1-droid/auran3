'use client';

import { useState, useTransition } from 'react';
import { useRouter } from '@/i18n/navigation';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { Plus, ChevronRight, ClipboardList } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useActiveBranch } from '@/hooks/use-active-branch';
import { openCount } from '@/app/[locale]/(dashboard)/dashboard/count/actions';
import type { CountSessionSummary } from '@/app/[locale]/(dashboard)/dashboard/count/actions';
import { Link } from '@/i18n/navigation';

interface Props {
  sessions: CountSessionSummary[];
}

function fmtDate(iso: string) {
  return new Intl.DateTimeFormat('en-US', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Dubai',
    hour12: false,
  }).format(new Date(iso));
}

export function CountListClient({ sessions }: Props) {
  const t = useTranslations('Count');
  const router = useRouter();
  const { activeBranchId } = useActiveBranch();
  const [isPending, startTransition] = useTransition();
  const reduced = useReducedMotion();

  function handleNewCount() {
    if (!activeBranchId) {
      toast.error('No active branch');
      return;
    }
    startTransition(async () => {
      const res = await openCount(activeBranchId);
      if (res.ok && res.countId) {
        router.push(`/dashboard/count/${res.countId}`);
      } else {
        toast.error(res.error ?? 'Failed to open count session');
      }
    });
  }

  return (
    <div className="space-y-4">
      {/* New count button */}
      <Button
        onClick={handleNewCount}
        disabled={isPending || !activeBranchId}
        className="h-12 w-full gap-2 rounded-xl text-sm font-semibold shadow-md shadow-primary/20"
      >
        <Plus className="h-4 w-4" />
        {isPending ? '...' : t('newCount')}
      </Button>

      {/* Sessions list */}
      {sessions.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border/60 py-16 text-center"
        >
          <ClipboardList className="h-10 w-10 text-muted-foreground/40" />
          <div>
            <p className="font-semibold text-muted-foreground">{t('noSessions')}</p>
            <p className="mt-1 text-sm text-muted-foreground/70">{t('noSessionsDesc')}</p>
          </div>
        </motion.div>
      ) : (
        <div className="space-y-2">
          {sessions.map((s, i) => (
            <motion.div
              key={s.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: reduced ? 0 : 0.2,
                delay: reduced ? 0 : i * 0.04,
                ease: [0.22, 1, 0.36, 1],
              }}
            >
              <Link href={`/dashboard/count/${s.id}`}>
                <div className="group flex items-center gap-3 rounded-xl border border-border/60 bg-card px-4 py-3.5 transition-colors hover:border-border hover:bg-muted/30">
                  {/* Status dot */}
                  <div
                    className={cn(
                      'h-2.5 w-2.5 shrink-0 rounded-full',
                      s.status === 'open' ? 'bg-emerald-500 animate-pulse' : 'bg-muted-foreground/40',
                    )}
                  />

                  {/* Info */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={s.status === 'open' ? 'default' : 'secondary'}
                        className="text-[10px] px-1.5 py-0"
                      >
                        {s.status === 'open' ? t('statusOpen') : t('statusClosed')}
                      </Badge>
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground tabular-nums">
                      {fmtDate(s.created_at)}
                    </p>
                    {s.closed_at && (
                      <p className="text-[11px] text-muted-foreground/60 tabular-nums">
                        {t('closedAt')}: {fmtDate(s.closed_at)}
                      </p>
                    )}
                  </div>

                  {/* Action */}
                  <div className="flex shrink-0 items-center gap-2 text-xs font-medium text-muted-foreground group-hover:text-foreground">
                    <span>{s.status === 'open' ? t('openSession') : t('viewSession')}</span>
                    <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                  </div>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
