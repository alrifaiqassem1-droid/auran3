import type { ExpiryStatus } from '@/lib/stock/fefo';

/** Maps ExpiryStatus → Tailwind classes for badge background + text. */
export function statusBadgeClass(status: ExpiryStatus): string {
  switch (status) {
    case 'expired':  return 'bg-status-expired  text-status-expired-foreground';
    case 'critical': return 'bg-status-critical text-status-critical-foreground';
    case 'warning':  return 'bg-status-warning  text-status-warning-foreground';
    case 'safe':     return 'bg-status-safe     text-status-safe-foreground';
    case 'none':     return 'bg-status-none     text-status-none-foreground';
  }
}

/**
 * Maps ExpiryStatus → translation key inside the "Status" namespace.
 * Usage: t(statusLabelKey(status))  where t = useTranslations('Status')
 */
export function statusLabelKey(
  status: ExpiryStatus,
): 'expired' | 'critical' | 'warning' | 'safe' | 'none' {
  return status;
}
