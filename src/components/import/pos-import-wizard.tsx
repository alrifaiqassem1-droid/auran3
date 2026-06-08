'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileSpreadsheet, PenLine, Webhook, UtensilsCrossed,
  CheckCircle2, RotateCcw, Lock,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { importEngine } from '@/lib/pos/engine';
import { CsvTab } from './adapters/csv-tab';
import { ManualTab } from './adapters/manual-tab';
import { WebhookTab } from '@/app/[locale]/(dashboard)/dashboard/import/webhook-tab';
import type { MatchableProduct } from '@/app/[locale]/(dashboard)/dashboard/import/actions';

const ICONS: Record<string, React.ElementType> = {
  FileSpreadsheet, PenLine, Webhook, UtensilsCrossed,
};

interface Props { products: MatchableProduct[] }
interface ImportResult { matched: number; unmatched: number }

export function PosImportWizard({ products }: Props) {
  const t = useTranslations('Import');
  const adapters = importEngine.adapters;

  const [activeId, setActiveId] = useState('csv');
  const [result, setResult] = useState<ImportResult | null>(null);

  function handleSuccess(r: ImportResult) { setResult(r); }

  function reset() { setResult(null); }

  // ── Result screen (shared between all adapters) ──────────────────────────
  if (result) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex flex-col items-center gap-5 py-10 text-center"
      >
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500/10">
          <CheckCircle2 className="h-10 w-10 text-emerald-500" />
        </div>
        <div>
          <h2 className="text-xl font-bold">{t('importDone')}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {t('importDoneDesc', { matched: result.matched, unmatched: result.unmatched })}
          </p>
        </div>
        <div className="grid w-full max-w-xs grid-cols-2 gap-3">
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3">
            <p className="text-xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
              {new Intl.NumberFormat('en-US').format(result.matched)}
            </p>
            <p className="text-xs text-muted-foreground">{t('matched')}</p>
          </div>
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3">
            <p className="text-xl font-bold tabular-nums text-amber-600 dark:text-amber-400">
              {new Intl.NumberFormat('en-US').format(result.unmatched)}
            </p>
            <p className="text-xs text-muted-foreground">{t('unmatched')}</p>
          </div>
        </div>
        <Button variant="outline" onClick={reset} className="gap-2">
          <RotateCcw className="h-4 w-4" />
          {t('importAnother')}
        </Button>
      </motion.div>
    );
  }

  // ── Adapter selector + active tab content ───────────────────────────────
  return (
    <div className="space-y-5">
      {/* Adapter pills */}
      <div className="flex flex-wrap gap-2">
        {adapters.map((adapter) => {
          const Icon = ICONS[adapter.icon] ?? FileSpreadsheet;
          const isActive = adapter.id === activeId && adapter.available;
          return (
            <button
              key={adapter.id}
              disabled={!adapter.available}
              onClick={() => adapter.available && setActiveId(adapter.id)}
              className={cn(
                'flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition-all',
                isActive
                  ? 'border-primary/40 bg-primary/10 text-primary shadow-sm'
                  : adapter.available
                    ? 'border-border/60 bg-card text-muted-foreground hover:border-border hover:text-foreground'
                    : 'cursor-not-allowed border-border/30 bg-muted/30 text-muted-foreground/50',
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span>{t(adapter.nameKey as Parameters<typeof t>[0])}</span>
              {!adapter.available && (
                <span className="flex items-center gap-1 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                  <Lock className="h-2.5 w-2.5" />
                  {t('comingSoon')}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Active adapter UI */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeId}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
        >
          {activeId === 'csv'    && <CsvTab    products={products} onSuccess={handleSuccess} />}
          {activeId === 'manual' && <ManualTab products={products} onSuccess={handleSuccess} />}
          {activeId === 'webhook' && <WebhookTab />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
