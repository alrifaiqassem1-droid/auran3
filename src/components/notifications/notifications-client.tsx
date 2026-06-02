'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, AlertTriangle, Package, ClipboardCheck, ShoppingCart, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';
import type { AppNotification } from '@/lib/notifications/realtime';

interface Props {
  userId: string;
  initialItems: AppNotification[];
}

const TYPE_ICONS: Record<string, React.ElementType> = {
  expiry_soon: AlertTriangle,
  low_stock:   Package,
  receipt:     ShoppingCart,
  damage:      AlertTriangle,
  count:       ClipboardCheck,
};

type Filter = 'all' | 'unread';

function fmtDateTime(iso: string) {
  return new Intl.DateTimeFormat('en-AE', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
    timeZone: 'Asia/Dubai', hour12: false,
  }).format(new Date(iso));
}

export function NotificationsClient({ userId, initialItems }: Props) {
  const t = useTranslations('Notifications');
  const [items, setItems] = useState(initialItems);
  const [filter, setFilter] = useState<Filter>('all');

  const unread = items.filter((i) => !i.is_read).length;
  const filtered = filter === 'unread' ? items.filter((i) => !i.is_read) : items;

  async function markAll() {
    const supabase = createClient();
    await supabase.from('notifications').update({ is_read: true }).eq('user_id', userId).eq('is_read', false);
    setItems((prev) => prev.map((i) => ({ ...i, is_read: true })));
  }

  async function markOne(id: string) {
    const supabase = createClient();
    await supabase.from('notifications').update({ is_read: true }).eq('id', id);
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, is_read: true } : i)));
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{t('title')}</h1>
          {unread > 0 && (
            <p className="mt-0.5 text-sm text-muted-foreground">
              {new Intl.NumberFormat('en-US').format(unread)} {t('unreadCount')}
            </p>
          )}
        </div>
        {unread > 0 && (
          <Button size="sm" variant="outline" onClick={markAll} className="gap-1.5 shrink-0">
            <Check className="h-3.5 w-3.5" />
            {t('markAllRead')}
          </Button>
        )}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2">
        {(['all', 'unread'] as Filter[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              'rounded-xl px-4 py-1.5 text-sm font-medium transition-colors',
              filter === f
                ? 'bg-primary/10 text-primary'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground',
            )}
          >
            {t(f === 'all' ? 'filterAll' : 'filterUnread')}
            {f === 'unread' && unread > 0 && (
              <span className="ms-1.5 rounded-full bg-primary/20 px-1.5 text-[11px] font-bold tabular-nums text-primary">
                {new Intl.NumberFormat('en-US').format(unread)}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border/60 py-16 text-center">
          <Bell className="h-10 w-10 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">{t('empty')}</p>
        </div>
      ) : (
        <AnimatePresence initial={false}>
          <div className="space-y-2">
            {filtered.map((item, i) => {
              const Icon = TYPE_ICONS[item.type] ?? Bell;
              return (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03, duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                >
                  <button
                    onClick={() => markOne(item.id)}
                    className={cn(
                      'flex w-full items-start gap-3 rounded-xl border px-4 py-3 text-start transition-colors',
                      item.is_read
                        ? 'border-border/40 bg-card hover:bg-muted/30'
                        : 'border-primary/20 bg-primary/5 hover:bg-primary/10',
                    )}
                  >
                    <div className={cn(
                      'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
                      item.type === 'expiry_soon' ? 'bg-rose-500/10 text-rose-500' :
                      item.type === 'low_stock'   ? 'bg-amber-500/10 text-amber-500' :
                                                    'bg-primary/10 text-primary',
                    )}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className={cn('text-sm font-medium', !item.is_read && 'text-foreground')}>
                          {item.title}
                        </p>
                        <Badge variant="secondary" className="shrink-0 text-[10px] px-1.5 py-0 capitalize">
                          {item.type.replace('_', ' ')}
                        </Badge>
                      </div>
                      {item.body && (
                        <p className="mt-0.5 text-xs text-muted-foreground">{item.body}</p>
                      )}
                      <p className="mt-1 text-[11px] tabular-nums text-muted-foreground/60">
                        {fmtDateTime(item.created_at)}
                      </p>
                    </div>
                    {!item.is_read && (
                      <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-primary" />
                    )}
                  </button>
                </motion.div>
              );
            })}
          </div>
        </AnimatePresence>
      )}
    </div>
  );
}
