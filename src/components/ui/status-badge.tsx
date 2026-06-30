'use client';

import { useTranslations } from 'next-intl';
import type { ExpiryStatus } from '@/lib/stock/fefo';
import { statusBadgeClass, statusLabelKey } from '@/lib/ui/status';
import { cn } from '@/lib/utils';

interface StatusBadgeProps {
  /** Expiry status computed by expiryStatus() — passed in, never recomputed here. */
  status: ExpiryStatus;
  /** Days remaining (positive) or overdue (negative). Shown when provided. */
  days?: number | null;
  className?: string;
}

export function StatusBadge({ status, days, className }: StatusBadgeProps) {
  const t = useTranslations('Status');

  const showDays = typeof days === 'number';
  const daysLabel = showDays
    ? ` (${new Intl.NumberFormat('en-US', { numberingSystem: 'latn' }).format(Math.abs(days!))})`
    : '';

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
        statusBadgeClass(status),
        className,
      )}
    >
      {t(statusLabelKey(status))}{daysLabel}
    </span>
  );
}
