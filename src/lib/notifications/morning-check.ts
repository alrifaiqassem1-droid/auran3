'use client';

import { createClient } from '@/lib/supabase/client';

const STORAGE_KEY   = 'auran_last_expiry_check';
const INTERVAL_MS   = 6 * 60 * 60 * 1000; // 6 hours
const HORIZON_DAYS  = 90;                   // fetch window; covers large custom thresholds

// ─── Locale-aware notification strings ────────────────────────────────────────
const MSG = {
  ar: {
    expired: (n: number) => `🔴 ${n} منتج منتهي الصلاحية`,
    urgent:  (n: number) => `🟠 ${n} منتج ينتهي قريباً`,
    warning: (n: number) => `🟡 ${n} منتج ينتهي خلال فترة التحذير`,
  },
  en: {
    expired: (n: number) => `🔴 ${n} product${n !== 1 ? 's' : ''} expired`,
    urgent:  (n: number) => `🟠 ${n} product${n !== 1 ? 's' : ''} expiring soon`,
    warning: (n: number) => `🟡 ${n} product${n !== 1 ? 's' : ''} expiring soon`,
  },
} as const;

type Locale = keyof typeof MSG;

// ─── Throttle guard ───────────────────────────────────────────
export function needsMorningCheck(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const last = localStorage.getItem(STORAGE_KEY);
    if (!last) return true;
    return Date.now() - parseInt(last, 10) > INTERVAL_MS;
  } catch {
    return false;
  }
}

// ─── Main check ───────────────────────────────────────────────
export async function runExpiryCheck(branchId: string, locale: string = 'ar'): Promise<number> {
  try {
    const supabase = createClient();
    const msg = MSG[(locale as Locale) in MSG ? (locale as Locale) : 'ar'];

    // Date boundaries as ISO date strings (YYYY-MM-DD)
    const now        = new Date();
    const toStr      = (d: Date) => d.toISOString().slice(0, 10);
    const todayStr   = toStr(now);
    const horizonStr = toStr(new Date(now.getTime() + HORIZON_DAYS * 86_400_000));

    // Fetch batches expiring within horizon, joining per-product and category thresholds
    const { data, error } = await supabase
      .from('stock_batches')
      .select('expiry_date, products(name, expiry_critical_days, expiry_warning_days, categories(default_critical_days, default_warning_days))')
      .eq('branch_id', branchId)
      .gt('quantity', 0)
      .not('expiry_date', 'is', null)
      .lte('expiry_date', horizonStr)
      .order('expiry_date', { ascending: true });

    if (error || !data) return 0;

    type Row = {
      expiry_date: string;
      products: {
        name: string;
        expiry_critical_days: number | null;
        expiry_warning_days:  number | null;
        categories: { default_critical_days: number; default_warning_days: number } | null;
      } | null;
    };

    const expired: string[] = [];
    const urgent:  string[] = [];
    const warning: string[] = [];

    for (const row of data as Row[]) {
      const name = row.products?.name ?? '';

      // Resolution order: product override → category default → hardcoded fallback
      const criticalDays = row.products?.expiry_critical_days
        ?? row.products?.categories?.default_critical_days
        ?? 7;
      const warningDays = row.products?.expiry_warning_days
        ?? row.products?.categories?.default_warning_days
        ?? 30;

      if (row.expiry_date < todayStr) {
        expired.push(name);
      } else {
        const expiry  = new Date(row.expiry_date + 'T00:00:00');
        const today   = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const daysLeft = Math.floor((expiry.getTime() - today.getTime()) / 86_400_000);
        if (daysLeft <= criticalDays) {
          urgent.push(name);
        } else if (daysLeft <= warningDays) {
          warning.push(name);
        }
        // beyond this product's warning window — skip
      }
    }

    // Show one browser notification per category (if any)
    const fmt = (names: string[]) =>
      names.slice(0, 3).join('، ') + (names.length > 3 ? ` +${names.length - 3}` : '');

    if (expired.length)
      showBrowserNotification(msg.expired(expired.length), fmt(expired), '/dashboard/reports');
    if (urgent.length)
      showBrowserNotification(msg.urgent(urgent.length), fmt(urgent), '/dashboard/reports');
    if (warning.length)
      showBrowserNotification(msg.warning(warning.length), fmt(warning), '/dashboard/reports');

    // Mark check done — prevents re-run for the next 6 hours
    if (typeof window !== 'undefined') localStorage.setItem(STORAGE_KEY, Date.now().toString());

    return expired.length + urgent.length + warning.length;
  } catch {
    return 0;
  }
}

// ─── Notification permission ──────────────────────────────────
export async function requestNotificationPermission(): Promise<boolean> {
  if (typeof Notification === 'undefined') return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied')  return false;
  const perm = await Notification.requestPermission();
  return perm === 'granted';
}

// ─── Show browser notification (also used by realtime.ts and expiry-alert.tsx) ─────
export function showBrowserNotification(title: string, body: string, url = '/') {
  if (typeof window === 'undefined') return;
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;

  const options: NotificationOptions = {
    body,
    icon:  '/icon-192.png',
    badge: '/icon-192.png',
    data:  { url },
  };

  // iOS Safari throws "Illegal constructor" on `new Notification()` outside a SW context.
  // Prefer SW showNotification when available; fall back only when SW is absent.
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.ready
      .then((reg) => reg.showNotification(title, options))
      .catch(() => {
        // SW not yet active — silent fail (avoids crash on iOS)
      });
  } else if (Notification.permission === 'granted') {
    try {
      const n = new Notification(title, options);
      n.onclick = () => { window.focus(); n.close(); };
    } catch { /* Illegal constructor on some mobile browsers */ }
  }
}
