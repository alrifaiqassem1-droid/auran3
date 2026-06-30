'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useLocale } from 'next-intl';
import { AlertTriangle, ArrowRight, FileUp } from 'lucide-react';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { useActiveBranch } from '@/hooks/use-active-branch';
import { InitialStockCsvDialog } from './initial-stock-csv-dialog';

type ProductRow = { id: string; name: string; unit: 'pcs' | 'kg'; barcode: string | null; cost_price: number };

interface Props {
  products:   ProductRow[];
  supplierId: string;
  reference:  string;
}

export function InitialStockSection({ products, supplierId, reference }: Props) {
  const t      = useTranslations('Receiving');
  const locale = useLocale();
  const { activeBranchId, branches } = useActiveBranch();

  const branchName = branches.find((b) => b.id === activeBranchId)?.name ?? '…';
  const [csvOpen, setCsvOpen] = useState(false);

  return (
    <>
      {/* ── Amber warning banner ── */}
      <div className="mb-5 flex flex-col gap-3 rounded-xl border border-amber-300 dark:border-amber-700/60 bg-amber-50 dark:bg-amber-950/30 px-4 py-3.5">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">
              {t('initialStockMode')}
            </p>
            <p className="mt-0.5 text-xs text-amber-700 dark:text-amber-400">
              {t('initialStockDesc')}
            </p>
            <p className="mt-1.5 text-xs font-medium text-amber-800 dark:text-amber-300">
              {t('initialStockBranchWarning', { branch: branchName })}
            </p>
          </div>
        </div>

        <div className="flex gap-2 flex-wrap">
          <Button
            size="sm"
            variant="outline"
            className="gap-2 border-amber-300 dark:border-amber-700 bg-transparent hover:bg-amber-100 dark:hover:bg-amber-900/30 text-amber-800 dark:text-amber-300"
            onClick={() => setCsvOpen(true)}
          >
            <FileUp className="h-3.5 w-3.5" />
            {t('initialStockCsvBtn')}
          </Button>

          <Link href={`/${locale}/dashboard/receiving`}>
            <Button
              size="sm"
              variant="ghost"
              className="gap-1.5 text-muted-foreground hover:text-foreground"
            >
              <ArrowRight className="h-3.5 w-3.5 rtl:rotate-180" />
              {t('initialStockBack')}
            </Button>
          </Link>
        </div>
      </div>

      {/* ── CSV import dialog ── */}
      <InitialStockCsvDialog
        open={csvOpen}
        onOpenChange={setCsvOpen}
        products={products}
        supplierId={supplierId}
        reference={reference}
      />
    </>
  );
}
