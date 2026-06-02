'use client';

import { useState, useCallback, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { Save, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { useActiveBranch } from '@/hooks/use-active-branch';
import { enqueueAndRun } from '@/lib/offline/queue';
import { parseCSV, applyMapping } from '@/lib/pos/parse-csv';
import { bestMapping, saveTemplate } from '@/lib/pos/adapters/csv/auto-mapper';
import { FileDrop } from '@/components/import/file-drop';
import { ColumnMapper } from '@/components/import/column-mapper';
import { ImportPreview } from '@/components/import/import-preview';
import { TemplateDownload } from '@/components/import/template-download';
import type { ParseResult, ColumnMapping, MappedRow } from '@/lib/pos/parse-csv';
import type { MatchableProduct } from '@/app/[locale]/(dashboard)/dashboard/import/actions';
import type { MatchedRow } from '@/components/import/import-preview';
import type { PosImportRow } from '@/lib/pos/engine';

type Step = 'upload' | 'map';

interface Props {
  products: MatchableProduct[];
  onSuccess: (result: { matched: number; unmatched: number }) => void;
}

function matchRows(rows: MappedRow[], products: MatchableProduct[]): MatchedRow[] {
  const byBarcode = new Map(products.filter((p) => p.barcode).map((p) => [p.barcode!, p]));
  const byName    = new Map(products.map((p) => [p.name.toLowerCase(), p]));
  return rows.map((row) => {
    const hit = (row.barcode ? byBarcode.get(row.barcode) : undefined)
              ?? (row.product_name ? byName.get(row.product_name.toLowerCase()) : undefined)
              ?? null;
    return { ...row, product_id: hit?.id ?? null, product_name_matched: hit?.name ?? null, ignored: false };
  });
}

export function CsvTab({ products, onSuccess }: Props) {
  const t = useTranslations('Import');
  const { activeBranchId } = useActiveBranch();
  const [isPending, startTransition] = useTransition();

  const [step, setStep]               = useState<Step>('upload');
  const [parsed, setParsed]           = useState<ParseResult | null>(null);
  const [mapping, setMapping]         = useState<ColumnMapping>({ barcode: null, product_name: null, quantity: null, total: null, sold_at: null });
  const [matchedRows, setMatchedRows] = useState<MatchedRow[]>([]);
  const [progress, setProgress]       = useState(0);
  const [tplName, setTplName]         = useState('');
  const [tplLoaded, setTplLoaded]     = useState<string | null>(null);
  const [showSave, setShowSave]       = useState(false);

  const handleFile = useCallback(async (file: File) => {
    try {
      const result  = await parseCSV(file);
      const { mapping: best, templateName } = bestMapping(result.headers);
      setParsed(result);
      setMapping(best);
      setMatchedRows(matchRows(applyMapping(result.rows, best), products));
      setTplLoaded(templateName);
      setTplName(templateName ?? '');
      setStep('map');
    } catch {
      toast.error(t('parseError'));
    }
  }, [products, t]);

  function handleMappingChange(m: ColumnMapping) {
    setMapping(m);
    if (parsed) setMatchedRows(matchRows(applyMapping(parsed.rows, m), products));
  }

  function handleRowUpdate(idx: number, productId: string | null, ignored: boolean) {
    setMatchedRows((prev) => prev.map((r) => {
      if (r._idx !== idx) return r;
      const p = productId ? products.find((x) => x.id === productId) : null;
      return { ...r, product_id: productId, product_name_matched: p?.name ?? null, ignored };
    }));
  }

  function handleSaveTemplate() {
    if (!parsed || !tplName.trim()) return;
    saveTemplate(parsed.headers, mapping, tplName.trim());
    toast.success(t('templateSaved', { name: tplName.trim() }));
    setShowSave(false);
  }

  function handleConfirm() {
    if (!activeBranchId || !parsed) return;
    const rows: PosImportRow[] = matchedRows
      .filter((r) => !r.ignored)
      .map((r) => ({ product_id: r.product_id, barcode: r.barcode, quantity: r.quantity, total: r.total, sold_at: r.sold_at }));
    if (!rows.length) { toast.error(t('noRows')); return; }

    startTransition(async () => {
      setProgress(10);
      const res = await enqueueAndRun('apply_pos_import', {
        branch_id: activeBranchId, source: 'CSV', file_name: parsed.fileName, rows,
      } as Record<string, unknown>);
      setProgress(100);

      if (res.ok) {
        const d = res.data as { matched?: number; unmatched?: number } | null;
        onSuccess({ matched: d?.matched ?? rows.filter((r) => r.product_id).length, unmatched: d?.unmatched ?? rows.filter((r) => !r.product_id).length });
        if (res.queued) toast.success(t('importOffline'));
        else toast.success(t('importSuccess'));
      } else {
        toast.error(res.error ?? t('importError'));
        setProgress(0);
      }
    });
  }

  if (step === 'upload') {
    return (
      <div className="space-y-3">
        <div className="flex justify-end"><TemplateDownload /></div>
        <FileDrop onFile={handleFile} />
      </div>
    );
  }

  return (
    <AnimatePresence mode="wait">
      <motion.div key="map" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
        {/* File info + template banner */}
        <div className="flex items-center justify-between gap-2 rounded-xl border border-border/60 bg-muted/20 px-4 py-2.5 text-sm">
          <span className="truncate font-medium">{parsed?.fileName}</span>
          <div className="flex shrink-0 items-center gap-2">
            {tplLoaded && (
              <span className="flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="h-3 w-3" />
                {t('templateLoaded', { name: tplLoaded })}
              </span>
            )}
            <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={() => setShowSave((v) => !v)}>
              <Save className="h-3.5 w-3.5" />
              {t('saveTemplate')}
            </Button>
          </div>
        </div>

        {/* Save template inline */}
        {showSave && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} className="overflow-hidden">
            <div className="flex gap-2">
              <Input
                value={tplName}
                onChange={(e) => setTplName(e.target.value)}
                placeholder={t('templateNamePlaceholder')}
                className="h-8 text-xs"
                onKeyDown={(e) => e.key === 'Enter' && handleSaveTemplate()}
              />
              <Button size="sm" className="h-8 shrink-0 text-xs" onClick={handleSaveTemplate} disabled={!tplName.trim()}>
                {t('saveTemplate')}
              </Button>
            </div>
          </motion.div>
        )}

        <ColumnMapper headers={parsed!.headers} mapping={mapping} onChange={handleMappingChange} />
        <ImportPreview rows={matchedRows} products={products} importing={isPending} progress={progress} onRowUpdate={handleRowUpdate} onConfirm={handleConfirm} />
      </motion.div>
    </AnimatePresence>
  );
}
