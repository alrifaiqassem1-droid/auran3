'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { Download, Filter, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { getAuditLog, type AuditEntry } from '@/app/[locale]/(dashboard)/dashboard/reports/audit/actions';

const ACTION_COLORS: Record<string, string> = {
  create: 'bg-emerald-500/10 text-emerald-600',
  update: 'bg-blue-500/10 text-blue-600',
  delete: 'bg-red-500/10 text-red-600',
  remove_staff: 'bg-red-500/10 text-red-600',
  receive: 'bg-primary/10 text-primary',
  damage: 'bg-orange-500/10 text-orange-600',
  count_close: 'bg-purple-500/10 text-purple-600',
  pos_import: 'bg-cyan-500/10 text-cyan-600',
  role_change: 'bg-amber-500/10 text-amber-700',
  invite: 'bg-violet-500/10 text-violet-600',
};

function formatDate(iso: string) {
  return new Intl.DateTimeFormat('ar', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
    timeZone: 'Asia/Dubai',
  }).format(new Date(iso));
}

export function AuditClient({ initialEntries }: { initialEntries: AuditEntry[] }) {
  const t = useTranslations('Audit');

  const ACTION_LABELS: Record<string, string> = {
    create:       t('action_create'),
    update:       t('action_update'),
    delete:       t('action_delete'),
    receive:      t('action_receive'),
    damage:       t('action_damage'),
    count_close:  t('action_count_close'),
    pos_import:   t('action_pos_import'),
    role_change:  t('action_role_change'),
    invite:       t('action_invite'),
    remove_staff: t('action_remove_staff'),
  };

  const ENTITY_LABELS: Record<string, string> = {
    inventory_counts: t('section_inventory_counts'),
    inventory_count:  t('section_inventory_counts'),
    products:         t('section_products'),
    product:          t('section_products'),
    damaged_products: t('section_damaged_products'),
    damage:           t('section_damaged_products'),
    goods_receipts:   t('section_goods_receipts'),
    receipt:          t('section_goods_receipts'),
    pos_import:       t('section_pos_import'),
    membership:       t('section_membership'),
    custom_role:      t('section_custom_role'),
  };

  const [entries, setEntries] = useState(initialEntries);
  const [filterAction, setFilterAction] = useState('');
  const [filterEntity, setFilterEntity] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [pending, startTransition] = useTransition();

  function applyFilters() {
    startTransition(async () => {
      const result = await getAuditLog({
        action:   filterAction || undefined,
        entity:   filterEntity || undefined,
        dateFrom: filterDateFrom || undefined,
        dateTo:   filterDateTo || undefined,
      }, 500);
      if (result.ok) setEntries(result.entries);
    });
  }

  function exportCsv() {
    const header = [t('colDate'), t('colUser'), t('colAction'), t('colEntity'), 'ID', t('colDetails')].join(',');
    const rows = entries.map((e) =>
      [
        formatDate(e.created_at),
        e.user_name ?? '—',
        ACTION_LABELS[e.action] ?? e.action,
        ENTITY_LABELS[e.entity] ?? e.entity,
        e.entity_id ?? '',
        e.details ? JSON.stringify(e.details).replace(/,/g, ';') : '',
      ]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(','),
    );
    const csv = [header, ...rows].join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const allActions = [...new Set(entries.map((e) => e.action))];
  const allEntities = [...new Set(entries.map((e) => e.entity))];

  return (
    <div className="space-y-5">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{t('pageTitle')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('pageSubtitle')}</p>
        </div>
        <Button onClick={exportCsv} variant="outline" size="sm" className="h-9 gap-1.5 rounded-xl">
          <Download className="h-3.5 w-3.5" />
          {t('exportCsv')}
        </Button>
      </div>

      {/* Filters */}
      <div className="rounded-2xl border border-border/60 bg-card p-4">
        <div className="mb-3 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
          <Filter className="h-3.5 w-3.5" /> {t('filters')}
        </div>
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
          <select value={filterAction} onChange={(e) => setFilterAction(e.target.value)}
            className="h-9 rounded-lg border border-border bg-background px-2 text-xs">
            <option value="">{t('allActions')}</option>
            {allActions.map((a) => <option key={a} value={a}>{ACTION_LABELS[a] ?? a}</option>)}
          </select>
          <select value={filterEntity} onChange={(e) => setFilterEntity(e.target.value)}
            className="h-9 rounded-lg border border-border bg-background px-2 text-xs">
            <option value="">{t('allSections')}</option>
            {allEntities.map((e) => <option key={e} value={e}>{ENTITY_LABELS[e] ?? e}</option>)}
          </select>
          <Input type="date" value={filterDateFrom} onChange={(e) => setFilterDateFrom(e.target.value)}
            className="h-9 text-xs" dir="ltr" placeholder={t('dateFrom')} />
          <Input type="date" value={filterDateTo} onChange={(e) => setFilterDateTo(e.target.value)}
            className="h-9 text-xs" dir="ltr" placeholder={t('dateTo')} />
        </div>
        <Button onClick={applyFilters} disabled={pending} size="sm" className="mt-3 h-9 gap-1.5 rounded-xl">
          {pending ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Filter className="h-3.5 w-3.5" />}
          {t('applyFilter')}
        </Button>
      </div>

      {/* Table */}
      {entries.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed py-14 text-center">
          <p className="text-sm text-muted-foreground">{t('noEntries')}</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border/60">
          <div className="max-h-[65vh] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border/60 bg-muted/30 sticky top-0 z-10 !bg-background">
              <tr>
                <th className="px-4 py-3 text-start text-xs font-semibold text-muted-foreground">{t('colDate')}</th>
                <th className="px-4 py-3 text-start text-xs font-semibold text-muted-foreground">{t('colUser')}</th>
                <th className="px-4 py-3 text-start text-xs font-semibold text-muted-foreground">{t('colAction')}</th>
                <th className="px-4 py-3 text-start text-xs font-semibold text-muted-foreground">{t('colEntity')}</th>
                <th className="px-4 py-3 text-start text-xs font-semibold text-muted-foreground">{t('colDetails')}</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry, i) => (
                <tr key={entry.id} className={`border-b border-border/40 last:border-0 ${i % 2 === 0 ? '' : 'bg-muted/10'}`}>
                  <td className="px-4 py-3 text-xs tabular-nums text-muted-foreground whitespace-nowrap">
                    {formatDate(entry.created_at)}
                  </td>
                  <td className="px-4 py-3 text-xs font-medium">{entry.user_name ?? '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold ${ACTION_COLORS[entry.action] ?? 'bg-muted text-muted-foreground'}`}>
                      {ACTION_LABELS[entry.action] ?? entry.action}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {ENTITY_LABELS[entry.entity] ?? entry.entity}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground max-w-[200px] truncate">
                    {entry.details
                      ? Object.entries(entry.details).map(([k, v]) => `${k}: ${v}`).join(' · ')
                      : entry.entity_id ?? '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
          <div className="border-t border-border/40 px-4 py-2 text-xs text-muted-foreground">
            {t('entriesCount', { n: entries.length })}
          </div>
        </div>
      )}
    </div>
  );
}
