'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { Download, FileText, Building2 } from 'lucide-react';
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
import { getVatReport } from '@/app/[locale]/(dashboard)/dashboard/reports/actions';
import type { VatReport as VatReportData, TenantInfo } from '@/app/[locale]/(dashboard)/dashboard/reports/actions';

interface Props {
  branchId: string;
  tenant: TenantInfo | null;
  initialData: VatReportData;
  branchName?: string | null;
}

function periodRange(period: string): { from: string; to: string } {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();

  if (period === 'thisMonth') {
    return {
      from: new Date(y, m, 1).toISOString(),
      to:   new Date(y, m + 1, 0, 23, 59, 59).toISOString(),
    };
  }
  if (period === 'lastMonth') {
    return {
      from: new Date(y, m - 1, 1).toISOString(),
      to:   new Date(y, m, 0, 23, 59, 59).toISOString(),
    };
  }
  if (period === 'last3') {
    return {
      from: new Date(y, m - 2, 1).toISOString(),
      to:   new Date(y, m + 1, 0, 23, 59, 59).toISOString(),
    };
  }
  // thisYear
  return {
    from: new Date(y, 0, 1).toISOString(),
    to:   new Date(y, 11, 31, 23, 59, 59).toISOString(),
  };
}

function fmtDate(iso: string) {
  return new Intl.DateTimeFormat('en-AE', {
    day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Dubai',
  }).format(new Date(iso));
}

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-border/60 bg-card p-4">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-bold tabular-nums">{value}</p>
      {sub && <p className="text-[11px] text-muted-foreground">{sub}</p>}
    </div>
  );
}

export function VatReport({ branchId, tenant, initialData, branchName }: Props) {
  const t = useTranslations('Reports');
  const [period, setPeriod] = useState('thisMonth');
  const [data, setData] = useState<VatReportData>(initialData);
  const [isPending, startTransition] = useTransition();

  function changePeriod(p: string) {
    setPeriod(p);
    const { from, to } = periodRange(p);
    startTransition(async () => {
      const fresh = await getVatReport(branchId, from, to);
      setData(fresh);
    });
  }

  function exportCsv() {
    const headers = ['Date', 'Gross (AED)', 'Net (AED)', 'VAT 5% (AED)', 'Transactions'];
    const rows = data.lines.map((l) => [
      l.date,
      l.gross.toFixed(2),
      l.net.toFixed(2),
      l.vat.toFixed(2),
      l.transactions,
    ]);
    const totRow = ['TOTAL', data.totals.gross.toFixed(2), data.totals.net.toFixed(2), data.totals.vat.toFixed(2), data.totals.transactions];
    const csv = [headers, ...rows, totRow].map((r) => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vat-report-${period}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const fmt = (n: number) => new Intl.NumberFormat('en-US').format(n);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-start gap-3">
        {/* Tenant / TRN info */}
        <div className="flex-1 min-w-0">
          {tenant && (
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-semibold">{tenant.name}</span>
              {tenant.trn && (
                <span className="rounded bg-primary/10 px-2 py-0.5 text-xs font-mono font-bold text-primary">
                  TRN: {tenant.trn}
                </span>
              )}
            </div>
          )}
          {branchName && (
            <p className="mt-0.5 text-xs text-muted-foreground">
              {t('branchLabel')}: {branchName}
            </p>
          )}
          <p className="mt-0.5 text-xs text-muted-foreground">
            {t('vatPeriod')}: {fmtDate(data.period.from)} — {fmtDate(data.period.to)}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Select value={period} onValueChange={changePeriod}>
            <SelectTrigger className="h-8 w-36 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="thisMonth">{t('thisMonth')}</SelectItem>
              <SelectItem value="lastMonth">{t('lastMonth')}</SelectItem>
              <SelectItem value="last3">{t('last3Months')}</SelectItem>
              <SelectItem value="thisYear">{t('thisYear')}</SelectItem>
            </SelectContent>
          </Select>
          <Button size="sm" variant="outline" onClick={exportCsv} className="h-8 gap-1.5">
            <Download className="h-3.5 w-3.5" />
            CSV
          </Button>
        </div>
      </div>

      {/* KPI cards */}
      <div className={cn('grid grid-cols-2 gap-3 transition-opacity', isPending && 'opacity-50')}>
        <StatCard label={t('grossSales')} value={formatAED(data.totals.gross)} sub="VAT incl." />
        <StatCard label={t('netSales')} value={formatAED(data.totals.net)} sub="ex-VAT" />
        <StatCard
          label={t('vatCollected')}
          value={formatAED(data.totals.vat)}
          sub={`${tenant?.vat_rate ?? 5}%`}
        />
        <StatCard
          label={t('transactions')}
          value={fmt(data.totals.transactions)}
          sub={t('txnLabel')}
        />
      </div>

      {/* Dubai Municipality VAT summary box */}
      <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-2">
        <div className="flex items-center gap-2 mb-3">
          <FileText className="h-4 w-4 text-primary" />
          <span className="text-xs font-bold text-primary uppercase tracking-wide">
            {t('dubaiFiling')}
          </span>
        </div>
        {[
          { label: t('standardRatedSupplies'), value: formatAED(data.totals.net) },
          { label: t('zeroRatedSupplies'), value: formatAED(0) },
          { label: t('exemptSupplies'), value: formatAED(0) },
          { label: t('vatOnStandard') + ` (5%)`, value: formatAED(data.totals.vat), bold: true },
          { label: t('inputVat'), value: formatAED(0) },
          { label: t('netVatPayable'), value: formatAED(data.totals.vat), bold: true, primary: true },
        ].map(({ label, value, bold, primary }) => (
          <div key={label} className={cn('flex items-center justify-between text-sm', bold && 'border-t border-border/40 pt-2 mt-2')}>
            <span className={cn('text-muted-foreground', bold && 'font-semibold text-foreground')}>{label}</span>
            <span className={cn('tabular-nums font-medium', primary && 'text-primary font-bold text-base')}>{value}</span>
          </div>
        ))}
      </div>

      {/* Daily breakdown table */}
      {data.lines.length > 0 ? (
        <div className="overflow-hidden rounded-xl border border-border/60">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border/60 bg-muted/40">
                <tr>
                  {[t('date'), t('grossSales'), t('netSales'), 'VAT 5%', t('transactions')].map((h) => (
                    <th key={h} className="px-3 py-2 text-end text-[11px] font-semibold uppercase tracking-wide text-muted-foreground first:text-start">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {data.lines.map((line) => (
                  <tr key={line.date} className="hover:bg-muted/20">
                    <td className="px-3 py-2 text-xs tabular-nums">{fmtDate(line.date)}</td>
                    <td className="px-3 py-2 text-end text-xs tabular-nums">{formatAED(line.gross)}</td>
                    <td className="px-3 py-2 text-end text-xs tabular-nums">{formatAED(line.net)}</td>
                    <td className="px-3 py-2 text-end text-xs tabular-nums text-primary font-medium">{formatAED(line.vat)}</td>
                    <td className="px-3 py-2 text-end text-xs tabular-nums">{fmt(line.transactions)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t border-border/60 bg-muted/40 font-semibold">
                <tr>
                  <td className="px-3 py-2 text-xs">{t('total')}</td>
                  <td className="px-3 py-2 text-end text-xs tabular-nums">{formatAED(data.totals.gross)}</td>
                  <td className="px-3 py-2 text-end text-xs tabular-nums">{formatAED(data.totals.net)}</td>
                  <td className="px-3 py-2 text-end text-xs tabular-nums text-primary">{formatAED(data.totals.vat)}</td>
                  <td className="px-3 py-2 text-end text-xs tabular-nums">{fmt(data.totals.transactions)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-border/60 py-12 text-center">
          <p className="text-sm text-muted-foreground">{t('noSalesData')}</p>
        </div>
      )}
    </div>
  );
}
