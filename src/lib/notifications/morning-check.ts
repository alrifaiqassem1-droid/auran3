'use client';

import { createClient } from '@/lib/supabase/client';

const STORAGE_KEY  = 'auran_last_expiry_check';
const INTERVAL_MS  = 6 * 60 * 60 * 1000; // 6 hours

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
export async function runExpiryCheck(branchId: string): Promise<number> {
  try {
    const supabase = createClient();

    // Date boundaries as ISO date strings (YYYY-MM-DD)
    const now     = new Date();
    const toStr   = (d: Date) => d.toISOString().slice(0, 10);
    const todayStr = toStr(now);
    const day7Str  = toStr(new Date(now.getTime() + 7  * 86_400_000));
    const day30Str = toStr(new Date(now.getTime() + 30 * 86_400_000));

    // Fetch all batches expiring within 30 days (including already expired)
    const { data, error } = await supabase
      .from('stock_batches')
      .select('expiry_date, products(name)')
      .eq('branch_id', branchId)
      .gt('quantity', 0)
      .not('expiry_date', 'is', null)
      .lte('expiry_date', day30Str)
      .order('expiry_date', { ascending: true });

    if (error || !data) return 0;

    type Row = { expiry_date: string; products: { name: string } | null };

    const expired: string[] = [];
    const urgent:  string[] = [];
    const warning: string[] = [];

    for (const row of data as Row[]) {
      const name = row.products?.name ?? '';
      if (row.expiry_date < todayStr) {
        expired.push(name);
      } else if (row.expiry_date < day7Str) {
        urgent.push(name);
      } else {
        warning.push(name);
      }
    }

    // Show one browser notification per category (if any)
    const fmt = (names: string[]) =>
      names.slice(0, 3).join('، ') + (names.length > 3 ? ` +${names.length - 3}` : '');

    if (expired.length)
      showBrowserNotification(
        `🔴 ${expired.length} منتج منتهي الصلاحية`,
        fmt(expired),
        '/dashboard/reports',
      );

    if (urgent.length)
      showBrowserNotification(
        `🟠 ${urgent.length} منتج ينتهي خلال 7 أيام`,
        fmt(urgent),
        '/dashboard/reports',
      );

    if (warning.length)
      showBrowserNotification(
        `🟡 ${warning.length} منتج ينتهي خلال 30 يوماً`,
        fmt(warning),
        '/dashboard/reports',
      );

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

// ─── Show browser notification (also used by realtime.ts) ─────
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
