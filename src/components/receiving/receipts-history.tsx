'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Search, Package, FileText } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { formatAED } from '@/lib/pricing';

type Receipt = {
  id: string;
  reference: string | null;
  total_cost: number;
  created_at: string;
  supplier_id: string | null;
  suppliers: { name: string } | null;
  goods_receipt_items: { id: string }[];
};

interface Props {
  receipts: Receipt[];
}

export function ReceiptsHistory({ receipts }: Props) {
  const t = useTranslations('Receiving');
  const [search, setSearch] = useState('');

  const filtered = receipts.filter((r) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      (r.reference && r.reference.toLowerCase().includes(q)) ||
      (r.suppliers?.name && r.suppliers.name.toLowerCase().includes(q))
    );
  });

  if (receipts.length === 0) return null;

  return (
    <div className="mt-8 border-t border-border/40 pt-6">
      <div className="mb-4">
        <h2 className="text-lg font-bold">{t('receiptsHistory')}</h2>
        <p className="mt-1 text-xs text-muted-foreground">{t('receiptsHistoryDesc')}</p>
      </div>

      <div className="relative mb-4">
        <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder={t('searchByReference')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-11 ps-10"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border/60 py-8 text-center">
          <FileText className="h-8 w-8 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">{t('noReceiptsFound')}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((r) => {
            const date = new Date(r.created_at);
            const formatted = new Intl.DateTimeFormat('en-US', {
              day: '2-digit',
              month: 'short',
              year: 'numeric',
              timeZone: 'Asia/Dubai',
            }).format(date);
            const itemCount = r.goods_receipt_items?.length ?? 0;

            return (
              <div
                key={r.id}
                className="flex items-start gap-3 rounded-xl border border-border/50 bg-card p-4 transition-colors hover:bg-muted/30"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                  <Package className="h-5 w-5 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-semibold">
                      {r.reference || t('noReference')}
                    </p>
                    <span className="shrink-0 text-sm font-bold tabular-nums text-primary">
                      {formatAED(r.total_cost)}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                    {r.suppliers?.name && (
                      <>
                        <span>{r.suppliers.name}</span>
                        <span>·</span>
                      </>
                    )}
                    <span>{formatted}</span>
                    <span>·</span>
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                      {new Intl.NumberFormat('en-US').format(itemCount)} {t('items')}
                    </Badge>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
