'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { AlertTriangle, Clock, CalendarClock, Loader2, TriangleAlert } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useActiveBranch } from '@/hooks/use-active-branch';
import { getExpiryData } from '@/app/[locale]/(dashboard)/dashboard/reports/actions';
import type { ExpiryBatch } from '@/app/[locale]/(dashboard)/dashboard/reports/actions';

// ─── Single batch row ─────────────────────────────────────────

function BatchRow({
  batch, showDamageBtn, t, i,
}: {
  batch: ExpiryBatch;
  showDamageBtn: boolean;
  t: ReturnType<typeof useTranslations<'Expiry'>>;
  i: number;
}) {
  const reduced = useReducedMotion();
  const days = batch.days_left;

  const daysBadge = () => {
    if (days === null) return null;
    if (days < 0)  return <Badge variant="destructive" className="tabular-nums">{t('expiredDaysAgo', { n: Math.abs(days) })}</Badge>;
    if (days === 0) return <Badge className="bg-red-500 text-white">{t('expiresToday')}</Badge>;
    if (days <= 7)  return <Badge className="bg-orange-500 text-white tabular-nums">{t('expiresInDays', { n: days })}</Badge>;
    return <Badge className="bg-amber-400 text-amber-950 tabular-nums">{t('expiresInDays', { n: days })}</Badge>;
  };

  return (
    <motion.div
      initial={{ opacity: reduced ? 1 : 0, y: reduced ? 0 : 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reduced ? 0 : 0.18, delay: reduced ? 0 : i * 0.04, ease: [0.22, 1, 0.36, 1] }}
      className="flex items-center gap-3 rounded-xl border border-border/60 bg-card px-4 py-3"
    >
      {/* Info */}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{batch.product_name}</p>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          {daysBadge()}
          <span className="text-[11px] text-muted-foreground tabular-nums">
            {batch.expiry_date ?? '—'}
          </span>
        </div>
      </div>

      {/* Qty */}
      <div className="shrink-0 text-end">
        <p className="text-xs text-muted-foreground">{t('quantity')}</p>
        <p className="text-sm font-bold tabular-nums">{batch.quantity} {batch.product_unit}</p>
      </div>

      {/* Damage button */}
      {showDamageBtn && (
        <Link
          href={`/dashboard/damage`}
          className="shrink-0"
        >
          <Button
            size="sm"
            variant="destructive"
            className="h-8 rounded-lg text-xs font-semibold"
          >
            {t('recordDamage')}
          </Button>
        </Link>
      )}
    </motion.div>
  );
}

// ─── Empty state ──────────────────────────────────────────────

function Empty({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border/60 py-14 text-center">
      <CalendarClock className="h-10 w-10 text-muted-foreground/30" />
      <p className="text-sm font-medium text-muted-foreground">{label}</p>
    </div>
  );
}

// ─── Tab section ──────────────────────────────────────────────

function TabSection({
  items, showDamageBtn, emptyLabel, t,
}: {
  items: ExpiryBatch[];
  showDamageBtn: boolean;
  emptyLabel: string;
  t: ReturnType<typeof useTranslations<'Expiry'>>;
}) {
  if (items.length === 0) return <Empty label={emptyLabel} />;
  return (
    <AnimatePresence initial={false}>
      <div className="space-y-2">
        {items.map((b, i) => (
          <BatchRow key={b.id} batch={b} showDamageBtn={showDamageBtn} t={t} i={i} />
        ))}
      </div>
    </AnimatePresence>
  );
}

// ─── Main component ───────────────────────────────────────────

export function ExpiryClient() {
  const t = useTranslations('Expiry');
  const { activeBranchId } = useActiveBranch();

  const [expired,  setExpired]  = useState<ExpiryBatch[]>([]);
  const [urgent,   setUrgent]   = useState<ExpiryBatch[]>([]);
  const [warning,  setWarning]  = useState<ExpiryBatch[]>([]);
  const [loading,  setLoading]  = useState(true);

  const load = useCallback(async () => {
    if (!activeBranchId) return;
    setLoading(true);
    try {
      const data = await getExpiryData(activeBranchId);
      // expired + critical → 🔴 tab
      setExpired([...data.expired, ...data.critical]);
      // warning → 🟠 tab (7–30 days) — we split by days_left
      // But getExpiryData groups: critical ≤7d, warning 8–30d
      // We want: urgent tab = critical (≤7d), warning tab = warning (8–30d)
      setUrgent(data.critical);
      setWarning(data.warning);
      setExpired(data.expired);
    } finally {
      setLoading(false);
    }
  }, [activeBranchId]);

  useEffect(() => { load(); }, [load]);

  const tabLabel = (emoji: string, label: string, count: number) =>
    `${emoji} ${label}${count > 0 ? ` (${count})` : ''}`;

  return (
    <div className="container max-w-2xl px-4 py-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold">{t('pageTitle')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('pageSubtitle')}</p>
      </div>

      {/* No branch */}
      {!activeBranchId && !loading && (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed py-14 text-center">
          <TriangleAlert className="h-10 w-10 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">{t('noBranch')}</p>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Tabs */}
      {!loading && activeBranchId && (
        <Tabs defaultValue="expired">
          <TabsList className="mb-4 w-full">
            <TabsTrigger value="expired" className="flex-1 text-xs">
              {tabLabel('🔴', t('tabExpired'), expired.length)}
            </TabsTrigger>
            <TabsTrigger value="urgent" className="flex-1 text-xs">
              {tabLabel('🟠', t('tabUrgent'), urgent.length)}
            </TabsTrigger>
            <TabsTrigger value="warning" className="flex-1 text-xs">
              {tabLabel('🟡', t('tabWarning'), warning.length)}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="expired">
            {expired.length > 0 && (
              <div className="mb-3 flex items-center gap-2 rounded-xl bg-red-500/10 px-3 py-2">
                <AlertTriangle className="h-4 w-4 shrink-0 text-red-500" />
                <p className="text-xs font-semibold text-red-600 dark:text-red-400">
                  {t('expiredWarning', { n: expired.length })}
                </p>
              </div>
            )}
            <TabSection
              items={expired}
              showDamageBtn
              emptyLabel={t('noExpired')}
              t={t}
            />
          </TabsContent>

          <TabsContent value="urgent">
            <TabSection
              items={urgent}
              showDamageBtn={false}
              emptyLabel={t('noUrgent')}
              t={t}
            />
          </TabsContent>

          <TabsContent value="warning">
            <TabSection
              items={warning}
              showDamageBtn={false}
              emptyLabel={t('noWarning')}
              t={t}
            />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
