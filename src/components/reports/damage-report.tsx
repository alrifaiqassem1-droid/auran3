'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { Download, TrendingDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { formatAED } from '@/lib/pricing';
import { getDamageReport } from '@/app/[locale]/(dashboard)/dashboard/reports/actions';
import type { DamageReport as DamageReportData } from '@/app/[locale]/(dashboard)/dashboard/reports/actions';

interface Props {
  branchId: string;
  initialData: DamageReportData;
}

function BarChart({ months }: { months: DamageReportData['months'] }) {
  if (months.length === 0) return null;
  const max = Math.max(...months.map((m) => m.loss_value), 1);

  return (
    <div className="space-y-2">
      <div className="flex items-end gap-2 h-36">
        {months.map((m) => {
          const pct = (m.loss_value / max) * 100;
          return (
            <div key={m.month} className="flex flex-1 flex-col items-center gap-1">
              <span className="text-[10px] tabular-nums text-muted-foreground">
                {m.loss_value > 0 ? formatAED(m.loss_value).replace('AED', '').trim() : ''}
              </span>
              <div className="w-full rounded-t-md bg-rose-500/70 transition-all duration-500" style={{ height: `${Math.max(pct, 2)}%` }} />
            </div>
          );
        })}
      </div>
      <div className="flex gap-2">
        {months.map((m) => (
          <div key={m.month} className="flex-1 text-center text-[10px] text-muted-foreground">
            {m.label}
          </div>
        ))}
      </div>
    </div>
  );
}

export function DamageReport({ branchId, initialData }: Props) {
  const t = useTranslations('Reports');
  const [months, setMonths] = useState('6');
  const [data, setData] = useState<DamageReportData>(initialData);
  const [isPending, startTransition] = useTransition();

  function changeMonths(m: string) {
    setMonths(m);
    startTransition(async () => {
      const fresh = await getDamageReport(branchId, parseInt(m));
      setData(fresh);
    });
  }

  function exportCsv() {
    const headers = ['Month', 'Loss (AED)', 'Quantity', 'Records'];
    const rows = data.months.map((m) => [m.label, m.loss_value.toFixed(2), m.total_qty, m.count]);
    const csv = [headers, ...rows].map((r) => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `damage-report-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const fmt = (n: number) => new Intl.NumberFormat('en-US', { maximumFractionDigits: 3 }).format(n);

  return (
    <div className="space-y-5">
      {/* Header controls */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <TrendingDown className="h-4 w-4 text-rose-500" />
          <span className="text-sm font-semibold">{t('damageTitle')}</span>
        </div>
        <div className="flex items-center gap-2">
          <Select value={months} onValueChange={changeMonths}>
            <SelectTrigger className="h-8 w-32 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="3">{t('last3Months')}</SelectItem>
              <SelectItem value="6">{t('last6Months')}</SelectItem>
              <SelectItem value="12">{t('last12Months')}</SelectItem>
            </SelectContent>
          </Select>
          {data.months.length > 0 && (
            <Button size="sm" variant="outline" onClick={exportCsv} className="h-8 gap-1.5">
              <Download className="h-3.5 w-3.5" />
              CSV
            </Button>
          )}
        </div>
      </div>

      {/* KPI cards */}
      <div className={cn('grid grid-cols-2 gap-3 transition-opacity', isPending && 'opacity-50')}>
        <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-4">
          <p className="text-xs font-medium text-muted-foreground">{t('totalLoss')}</p>
          <p className="mt-1 text-xl font-bold tabular-nums text-rose-600 dark:text-rose-400">
            {formatAED(data.total_loss)}
          </p>
        </div>
        <div className="rounded-xl border border-border/60 bg-card p-4">
          <p className="text-xs font-medium text-muted-foreground">{t('totalDamagedQty')}</p>
          <p className="mt-1 text-xl font-bold tabular-nums">{fmt(data.total_qty)}</p>
        </div>
      </div>

      {/* Bar chart */}
      {data.months.length > 0 ? (
        <div className={cn('rounded-xl border border-border/60 bg-card p-4 transition-opacity', isPending && 'opacity-50')}>
          <p className="mb-4 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            {t('monthlyLoss')} (AED)
          </p>
          <BarChart months={data.months} />
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-border/60 py-12 text-center">
          <p className="text-sm text-muted-foreground">{t('noDamageData')}</p>
        </div>
      )}

      {/* Monthly breakdown table */}
      {data.months.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-border/60">
          <div className="max-h-[380px] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border/60 bg-muted/40 sticky top-0 z-10 !bg-background">
              <tr>
                {[t('month'), t('lossValue'), t('quantity'), t('records')].map((h) => (
                  <th key={h} className="px-3 py-2 text-end text-[11px] font-semibold uppercase tracking-wide text-muted-foreground first:text-start">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {[...data.months].reverse().map((m) => (
                <tr key={m.month} className="hover:bg-muted/20">
                  <td className="px-3 py-2 text-xs font-medium">{m.label}</td>
                  <td className="px-3 py-2 text-end text-xs tabular-nums text-rose-600 dark:text-rose-400 font-medium">
                    {formatAED(m.loss_value)}
                  </td>
                  <td className="px-3 py-2 text-end text-xs tabular-nums">{fmt(m.total_qty)}</td>
                  <td className="px-3 py-2 text-end text-xs tabular-nums">{m.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      )}
    </div>
  );
}
