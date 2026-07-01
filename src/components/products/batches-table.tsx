'use client';

import { useTranslations } from 'next-intl';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { sortFefo, expiryStatus, daysUntilExpiry } from '@/lib/stock/fefo';
import { formatAED, formatQty } from '@/lib/pricing';

interface Batch {
  id: string;
  quantity: number;
  expiry_date: string | null;
  received_at: string;
  cost_price: number;
}

interface Props {
  batches: Batch[];
  unit: 'pcs' | 'kg';
}

const statusConfig = {
  expired:  { label: 'expired',  className: 'bg-destructive/15 text-destructive border-destructive/30' },
  critical: { label: 'critical', className: 'bg-destructive/10 text-destructive border-destructive/20' },
  warning:  { label: 'warning',  className: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20' },
  safe:     { label: 'safe',     className: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' },
  none:     { label: 'none',     className: 'bg-muted text-muted-foreground border-border' },
} as const;

function ExpiryBadge({ expiryDate }: { expiryDate: string | null }) {
  const t = useTranslations('Products');
  const status = expiryStatus(expiryDate);
  const days = daysUntilExpiry(expiryDate);
  const cfg = statusConfig[status];

  if (!expiryDate) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }

  const dateStr = new Intl.DateTimeFormat('en-AE', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    numberingSystem: 'latn',
    timeZone: 'Asia/Dubai',
  }).format(new Date(expiryDate + 'T00:00:00'));

  const daysLabel = days !== null
    ? days < 0
      ? t('daysAgo', { n: Math.abs(days) })
      : days === 0
        ? t('today')
        : t('daysLeft', { n: days })
    : null;

  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs tabular-nums">{dateStr}</span>
      {daysLabel && (
        <Badge
          variant="outline"
          className={`text-[10px] px-1.5 py-0 h-4 w-fit ${cfg.className}`}
        >
          {daysLabel}
        </Badge>
      )}
    </div>
  );
}

export function BatchesTable({ batches, unit }: Props) {
  const t = useTranslations('Products');
  const sorted = sortFefo(batches);
  const total = batches.reduce((s, b) => s + b.quantity, 0);

  if (batches.length === 0) {
    return (
      <div className="py-12 text-center text-muted-foreground text-sm">
        {t('noBatches')}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{t('totalStock')}</span>
        <span className="font-semibold tabular-nums">{formatQty(total, unit)}</span>
      </div>

      <div className="rounded-lg border overflow-hidden">
        <div className="max-h-[70vh] overflow-y-auto">
        <Table>
          <TableHeader className="sticky top-0 z-10 !bg-background">
            <TableRow>
              <TableHead className="text-xs">{t('quantity')}</TableHead>
              <TableHead className="text-xs">{t('costPrice')}</TableHead>
              <TableHead className="text-xs">{t('expiryDate')}</TableHead>
              <TableHead className="text-xs">{t('receivedAt')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.map((batch) => {
              const status = expiryStatus(batch.expiry_date);
              const isUrgent = status === 'expired' || status === 'critical';
              return (
                <TableRow
                  key={batch.id}
                  className={isUrgent ? 'bg-destructive/5' : undefined}
                >
                  <TableCell className="font-mono text-sm tabular-nums">
                    {formatQty(batch.quantity, unit)}
                  </TableCell>
                  <TableCell className="font-mono text-sm tabular-nums">
                    {formatAED(batch.cost_price)}
                  </TableCell>
                  <TableCell>
                    <ExpiryBadge expiryDate={batch.expiry_date} />
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground tabular-nums">
                    {new Intl.DateTimeFormat('en-AE', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                      numberingSystem: 'latn',
                      timeZone: 'Asia/Dubai',
                    }).format(new Date(batch.received_at))}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        </div>
      </div>
    </div>
  );
}
