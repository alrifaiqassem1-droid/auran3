'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, X, ChevronRight, Clock } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { playExpiryAlert } from '@/lib/notifications/sound';
import { showBrowserNotification } from '@/lib/notifications/morning-check';
import { Link } from '@/i18n/navigation';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from '@/components/ui/sheet';

// ─── Types ────────────────────────────────────────────────────

interface ExpiryItem {
  batchId:     string;
  productName: string;
  expiryDate:  string;
  quantity:    number;
  daysLeft:    number;   // < 0 = already expired
}

interface ExpiryData {
  expired: ExpiryItem[];
  urgent:  ExpiryItem[];
}

const ORANGE_KEY = (id: string) => `auran:expiry-orange-${id}`;

// ─── Data fetching ────────────────────────────────────────────

async function fetchExpiryItems(branchId: string): Promise<ExpiryData> {
  const supabase = createClient();

  const todayStr = new Date().toISOString().slice(0, 10);
  const day7Str  = new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10);

  const { data, error } = await supabase
    .from('stock_batches')
    .select('id, expiry_date, quantity, products(name)')
    .eq('branch_id', branchId)
    .gt('quantity', 0)
    .not('expiry_date', 'is', null)
    .lt('expiry_date', day7Str)          // expired OR expiring within 7 days
    .order('expiry_date', { ascending: true });

  if (error || !data) return { expired: [], urgent: [] };

  type Row = {
    id: string;
    expiry_date: string;
    quantity: number;
    products: { name: string } | null;
  };

  const todayMs = new Date().setHours(0, 0, 0, 0);
  const expired: ExpiryItem[] = [];
  const urgent:  ExpiryItem[] = [];

  for (const row of data as Row[]) {
    const expiryMs = new Date(row.expiry_date + 'T00:00:00').getTime();
    const daysLeft = Math.floor((expiryMs - todayMs) / 86_400_000);
    const item: ExpiryItem = {
      batchId:     row.id,
      productName: row.products?.name ?? '—',
      expiryDate:  row.expiry_date,
      quantity:    Number(row.quantity),
      daysLeft,
    };
    if (row.expiry_date < todayStr) {
      expired.push(item);
    } else {
      urgent.push(item);
    }
  }

  return { expired, urgent };
}

// ─── Days label ───────────────────────────────────────────────

function DaysLabel({ days, t }: { days: number; t: ReturnType<typeof useTranslations> }) {
  if (days === 0)  return <span className="font-semibold">{t('expiryToday')}</span>;
  if (days > 0)    return <span>{t('expiryDaysLeft', { n: days })}</span>;
  return <span className="font-semibold text-red-600">{t('expiryExpiredDays', { n: Math.abs(days) })}</span>;
}

// ─── Details sheet ────────────────────────────────────────────

function DetailsSheet({
  open, onClose, data, t,
}: {
  open: boolean;
  onClose: () => void;
  data: ExpiryData;
  t: ReturnType<typeof useTranslations>;
}) {
  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <SheetContent side="bottom" className="max-h-[80dvh] overflow-y-auto rounded-t-2xl">
        <SheetHeader className="mb-4">
          <SheetTitle>{t('expiryDetailsTitle')}</SheetTitle>
        </SheetHeader>

        {data.expired.length > 0 && (
          <div className="mb-4">
            <p className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-red-500">
              <span>🔴</span> {t('expiryExpiredSection')} ({data.expired.length})
            </p>
            <div className="space-y-2">
              {data.expired.map((item) => (
                <div key={item.batchId}
                  className="flex items-center justify-between rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 dark:border-red-900/40 dark:bg-red-950/30">
                  <div>
                    <p className="text-sm font-semibold">{item.productName}</p>
                    <p className="text-[11px] text-muted-foreground tabular-nums">{item.expiryDate}</p>
                  </div>
                  <div className="text-end">
                    <p className="text-xs tabular-nums text-muted-foreground">
                      {item.quantity} {t('expiryUnits')}
                    </p>
                    <DaysLabel days={item.daysLeft} t={t} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {data.urgent.length > 0 && (
          <div className="mb-4">
            <p className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-orange-500">
              <span>🟠</span> {t('expiryUrgentSection')} ({data.urgent.length})
            </p>
            <div className="space-y-2">
              {data.urgent.map((item) => (
                <div key={item.batchId}
                  className="flex items-center justify-between rounded-xl border border-orange-200 bg-orange-50 px-3 py-2.5 dark:border-orange-900/40 dark:bg-orange-950/30">
                  <div>
                    <p className="text-sm font-semibold">{item.productName}</p>
                    <p className="text-[11px] text-muted-foreground tabular-nums">{item.expiryDate}</p>
                  </div>
                  <div className="text-end">
                    <p className="text-xs tabular-nums text-muted-foreground">
                      {item.quantity} {t('expiryUnits')}
                    </p>
                    <p className="text-xs text-orange-600 dark:text-orange-400">
                      <DaysLabel days={item.daysLeft} t={t} />
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <Link
          href="/dashboard/damaged"
          onClick={onClose}
          className="mt-2 flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground"
        >
          {t('expiryRecordDamage')}
          <ChevronRight className="h-4 w-4" />
        </Link>
      </SheetContent>
    </Sheet>
  );
}

// ─── Main component ───────────────────────────────────────────

export function ExpiryAlert({ branchId }: { branchId: string | null }) {
  const t = useTranslations('System');
  const [data, setData]               = useState<ExpiryData>({ expired: [], urgent: [] });
  const [orangeDismissed, setOrangeDismissed] = useState(false);
  const [sheetOpen, setSheetOpen]     = useState(false);
  const alertedRef                    = useRef(false);

  const load = useCallback(async () => {
    if (!branchId) return;
    const result = await fetchExpiryItems(branchId);
    setData(result);
  }, [branchId]);

  // Initial load + periodic refresh (picks up damages registered elsewhere)
  useEffect(() => {
    load();
    const interval = setInterval(load, 2 * 60 * 1000);
    if (typeof document === 'undefined') return () => clearInterval(interval);
    const onVisible = () => { if (!document.hidden) load(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [load]);

  // Read orange dismissal state from sessionStorage
  useEffect(() => {
    if (!branchId || typeof window === 'undefined') return;
    try {
      setOrangeDismissed(sessionStorage.getItem(ORANGE_KEY(branchId)) === '1');
    } catch { /* sessionStorage blocked (private mode) */ }
  }, [branchId]);

  const dismissOrange = () => {
    if (!branchId) return;
    try {
      if (typeof window !== 'undefined') sessionStorage.setItem(ORANGE_KEY(branchId), '1');
    } catch { /* sessionStorage blocked */ }
    setOrangeDismissed(true);
  };

  // ── Fire alert once when expired items first appear ─────────
  useEffect(() => {
    if (data.expired.length === 0) {
      alertedRef.current = false;   // reset: new expiries later will re-alert
      return;
    }
    if (alertedRef.current) return;
    alertedRef.current = true;

    // 1. Loud alarm sound (sawtooth sweep × 3)
    playExpiryAlert();

    // 2. Triple vibration (300ms on, 100ms off × 3)
    navigator.vibrate?.([300, 100, 300, 100, 300]);

    // 3. Browser notification (works even when app is in background)
    const names = data.expired.slice(0, 3).map((i) => i.productName).join('، ');
    showBrowserNotification(
      `⚠️ ${data.expired.length} ${t('expiryExpiredSection')} — ${t('expiryActNow')}`,
      names + (data.expired.length > 3 ? ` +${data.expired.length - 3}` : ''),
      '/dashboard/reports',
    );
  }, [data.expired, t]);

  const showRed    = data.expired.length > 0;
  const showOrange = data.urgent.length > 0 && !orangeDismissed;

  if (!showRed && !showOrange) return null;

  return (
    <>
      <AnimatePresence initial={false}>
        {/* 🔴 Red — non-dismissible, action required */}
        {showRed && (
          <motion.div
            key="red"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="flex items-center gap-2 border-b border-red-700 bg-red-600 px-3 py-2.5 text-white">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <p className="flex-1 text-xs font-semibold leading-snug">
                {t('expiryExpiredTitle', { n: data.expired.length })}
              </p>
              <button
                onClick={() => setSheetOpen(true)}
                className="flex shrink-0 items-center gap-1 rounded-lg bg-white/20 px-2.5 py-1 text-[11px] font-bold transition-colors hover:bg-white/30 active:bg-white/10"
              >
                {t('expiryViewDetails')}
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </motion.div>
        )}

        {/* 🟠 Orange — dismissible per session */}
        {showOrange && (
          <motion.div
            key="orange"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="flex items-center gap-2 border-b border-orange-600 bg-orange-500 px-3 py-2 text-white">
              <Clock className="h-4 w-4 shrink-0" />
              <p className="flex-1 text-xs font-medium leading-snug">
                {t('expiryUrgentTitle', { n: data.urgent.length })}
              </p>
              <button
                onClick={() => setSheetOpen(true)}
                className="flex shrink-0 items-center gap-1 rounded-lg bg-white/20 px-2.5 py-1 text-[11px] font-bold transition-colors hover:bg-white/30"
              >
                {t('expiryViewDetails')}
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={dismissOrange}
                aria-label="dismiss"
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/20 transition-colors hover:bg-white/30"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <DetailsSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        data={data}
        t={t}
      />
    </>
  );
}
