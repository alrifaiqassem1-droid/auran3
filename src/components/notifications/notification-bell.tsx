'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, Check, AlertTriangle, Package, ClipboardCheck, ShoppingCart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';
import { subscribeToNotifications } from '@/lib/notifications/realtime';
import { Link } from '@/i18n/navigation';
import type { AppNotification } from '@/lib/notifications/realtime';

interface Props {
  userId: string;
  tenantId: string;
  branchId: string | null;
}

const TYPE_ICONS: Record<string, React.ElementType> = {
  expiry_soon: AlertTriangle,
  low_stock:   Package,
  receipt:     ShoppingCart,
  damage:      AlertTriangle,
  count:       ClipboardCheck,
};

function fmtTime(iso: string) {
  return new Intl.DateTimeFormat('en-AE', {
    hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Dubai', hour12: false,
  }).format(new Date(iso));
}

export function NotificationBell({ userId, tenantId, branchId }: Props) {
  const t = useTranslations('Notifications');
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const mountedRef = useRef(true);

  const unreadCount = items.filter((i) => !i.is_read).length;

  const fetchRecent = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from('notifications')
      .select('id, type, title, body, is_read, created_at')
      .or(`user_id.eq.${userId},user_id.is.null`)
      .order('created_at', { ascending: false })
      .limit(20);
    if (!mountedRef.current) return;
    setItems((data as AppNotification[]) ?? []);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    mountedRef.current = true;
    fetchRecent();
    const unsub = subscribeToNotifications(userId, tenantId, branchId, (n) => {
      if (!mountedRef.current) return;
      setItems((prev) => [n, ...prev].slice(0, 20));
    });
    return () => {
      mountedRef.current = false;
      unsub();
    };
  }, [userId, tenantId, branchId, fetchRecent]);

  async function markAllRead() {
    const supabase = createClient();
    await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', userId)
      .eq('is_read', false);
    setItems((prev) => prev.map((i) => ({ ...i, is_read: true })));
  }

  async function markOneRead(id: string) {
    const supabase = createClient();
    await supabase.from('notifications').update({ is_read: true }).eq('id', id);
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, is_read: true } : i)));
  }

  return (
    <div className="relative">
      <Button
        size="icon"
        variant="ghost"
        className="relative h-9 w-9"
        onClick={() => setOpen((o) => !o)}
      >
        <Bell className="h-4.5 w-4.5" />
        <AnimatePresence>
          {unreadCount > 0 && (
            <motion.span
              key="badge"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
              className="absolute -end-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold tabular-nums text-primary-foreground"
            >
              {new Intl.NumberFormat('en-US').format(Math.min(unreadCount, 99))}
            </motion.span>
          )}
        </AnimatePresence>
      </Button>

      <AnimatePresence>
        {open && (
          <>
            {/* Backdrop */}
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />

            <motion.div
              initial={{ opacity: 0, y: -8, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.97 }}
              transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
              className="absolute end-0 top-11 z-50 w-80 overflow-hidden rounded-2xl border border-border/60 bg-background shadow-xl shadow-black/10"
            >
              {/* Header */}
              <div className="flex items-center justify-between border-b border-border/40 px-4 py-3">
                <span className="text-sm font-semibold">{t('title')}</span>
                <div className="flex items-center gap-2">
                  {unreadCount > 0 && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 gap-1 text-xs"
                      onClick={markAllRead}
                    >
                      <Check className="h-3 w-3" />
                      {t('markAllRead')}
                    </Button>
                  )}
                  <Link href="/dashboard/notifications" onClick={() => setOpen(false)}>
                    <Button size="sm" variant="ghost" className="h-7 text-xs">{t('viewAll')}</Button>
                  </Link>
                </div>
              </div>

              {/* List */}
              <div className="max-h-80 overflow-y-auto">
                {loading ? (
                  <div className="space-y-2 p-3">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="h-14 animate-pulse rounded-xl bg-muted/50" />
                    ))}
                  </div>
                ) : items.length === 0 ? (
                  <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                    {t('empty')}
                  </div>
                ) : (
                  <div className="divide-y divide-border/30">
                    {items.map((item) => {
                      const Icon = TYPE_ICONS[item.type] ?? Bell;
                      return (
                        <button
                          key={item.id}
                          onClick={() => markOneRead(item.id)}
                          className={cn(
                            'flex w-full items-start gap-3 px-4 py-3 text-start transition-colors hover:bg-muted/40',
                            !item.is_read && 'bg-primary/5',
                          )}
                        >
                          <div className={cn(
                            'mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full',
                            item.type === 'expiry_soon' || item.type === 'low_stock'
                              ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                              : 'bg-primary/10 text-primary',
                          )}>
                            <Icon className="h-3.5 w-3.5" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className={cn('truncate text-xs font-medium', !item.is_read && 'text-foreground')}>
                              {item.title}
                            </p>
                            {item.body && (
                              <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{item.body}</p>
                            )}
                            <p className="mt-0.5 text-[10px] tabular-nums text-muted-foreground/60">
                              {fmtTime(item.created_at)}
                            </p>
                          </div>
                          {!item.is_read && (
                            <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
