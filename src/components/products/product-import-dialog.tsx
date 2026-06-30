'use client';

import { useRef, useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { FileText, Download, Upload, Loader2, CheckCircle2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

import {
  importProductsCsv,
  type CsvProductRow,
  type ImportSummary,
} from '@/app/[locale]/(dashboard)/dashboard/products/import-actions';

// ─── Arabic-Indic → Latin digit normalization ───────────────────────────────
function toLatinDigits(v: string): string {
  return v.replace(/[٠١٢٣٤٥٦٧٨٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
}

function parsePrice(raw: string): number | null {
  const s = toLatinDigits(raw.trim()).replace(/[^0-9.]/g, '');
  const n = parseFloat(s);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

// ─── CSV parsing ─────────────────────────────────────────────────────────────
function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQ = false;
  for (const ch of line) {
    if (ch === '"') { inQ = !inQ; continue; }
    if (ch === ',' && !inQ) { out.push(cur); cur = ''; continue; }
    cur += ch;
  }
  out.push(cur);
  return out;
}

const VALID_UNITS = new Set(['pcs', 'kg']);
const FALSE_VALUES = new Set(['false', '0', 'no', 'لا', 'n', 'f']);

export interface ParsedRow {
  rowIndex: number;
  raw: Record<string, string>;
  valid?: CsvProductRow;
  error?: string;
}

function parseCsvText(
  text: string,
  errMsg: (k: string) => string,
): ParsedRow[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];

  const headers = lines[0]
    .split(',')
    .map((h) => h.trim().toLowerCase().replace(/['"]/g, ''));

  const results: ParsedRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const values = splitCsvLine(line);
    const raw: Record<string, string> = {};
    headers.forEach((h, idx) => { raw[h] = values[idx] ?? ''; });

    const name = (raw['name'] ?? '').trim();
    if (!name) {
      results.push({ rowIndex: i, raw, error: errMsg('errorMissingName') });
      continue;
    }

    const cost_price = parsePrice(raw['cost_price'] ?? '');
    if (cost_price === null) {
      results.push({ rowIndex: i, raw, error: errMsg('errorInvalidPrice') });
      continue;
    }

    const sell_price = parsePrice(raw['sell_price'] ?? '');
    if (sell_price === null) {
      results.push({ rowIndex: i, raw, error: errMsg('errorInvalidPrice') });
      continue;
    }

    const rawUnit = (raw['unit'] ?? 'pcs').trim().toLowerCase();
    if (!VALID_UNITS.has(rawUnit)) {
      results.push({ rowIndex: i, raw, error: errMsg('errorInvalidUnit') });
      continue;
    }

    const vatRaw = (raw['vat_inclusive'] ?? '').trim().toLowerCase();
    const vat_inclusive = !FALSE_VALUES.has(vatRaw);

    results.push({
      rowIndex: i,
      raw,
      valid: {
        name,
        barcode: (raw['barcode'] ?? '').trim(),
        category: (raw['category'] ?? '').trim(),
        cost_price,
        sell_price,
        vat_inclusive,
        unit: rawUnit as 'pcs' | 'kg',
      },
    });
  }

  return results;
}

// ─── Template download ────────────────────────────────────────────────────────
function downloadTemplate() {
  const csv = [
    'name,barcode,category,cost_price,sell_price,vat_inclusive,unit',
    'زبدة نستله 200g,6281006321097,ألبان ومنتجاتها,4.5,6,true,pcs',
    'رز بسمتي 5kg,6281003099117,حبوب وبقوليات,15,20,true,kg',
    'لحم بقري مفروم,,لحوم,28,38,false,kg',
  ].join('\r\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'products_template.csv';
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Types ────────────────────────────────────────────────────────────────────
type Step = 'idle' | 'preview' | 'done';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

// ─── Main dialog ──────────────────────────────────────────────────────────────
export function ProductImportDialog({ open, onOpenChange }: Props) {
  const t = useTranslations('ProductImport');
  const [step, setStep] = useState<Step>('idle');
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [isPending, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  const validRows = parsedRows.filter((r) => r.valid);
  const invalidRows = parsedRows.filter((r) => r.error);

  function reset() {
    setStep('idle');
    setParsedRows([]);
    setSummary(null);
    if (fileRef.current) fileRef.current.value = '';
  }

  function handleClose(v: boolean) {
    if (!v) reset();
    onOpenChange(v);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.csv')) {
      toast.error(t('errorInvalidFile'));
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const rows = parseCsvText(text, (k) => t(k as Parameters<typeof t>[0]));
      if (!rows.length) {
        toast.error(t('errorEmpty'));
        return;
      }
      setParsedRows(rows);
      setStep('preview');
    };
    reader.readAsText(file, 'utf-8');
  }

  function handleImport() {
    const toSend = validRows.map((r) => r.valid!);
    startTransition(async () => {
      const res = await importProductsCsv(toSend);
      if (!res.ok) {
        toast.error(t('errorServer'));
        return;
      }
      setSummary(res.data);
      setStep('done');
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary shrink-0" />
            {t('title')}
          </DialogTitle>
          <DialogDescription>{t('subtitle')}</DialogDescription>
        </DialogHeader>

        {step === 'idle' && (
          <IdleStep
            t={t}
            fileRef={fileRef}
            onFileChange={handleFileChange}
            onClose={() => handleClose(false)}
          />
        )}

        {step === 'preview' && (
          <PreviewStep
            t={t}
            validRows={validRows}
            invalidRows={invalidRows}
            isPending={isPending}
            onImport={handleImport}
            onBack={() => { reset(); }}
            onClose={() => handleClose(false)}
          />
        )}

        {step === 'done' && summary && (
          <DoneStep
            t={t}
            summary={summary}
            skipped={invalidRows.length}
            onClose={() => handleClose(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── Step: idle ───────────────────────────────────────────────────────────────
function IdleStep({
  t,
  fileRef,
  onFileChange,
  onClose,
}: {
  t: ReturnType<typeof useTranslations<'ProductImport'>>;
  fileRef: React.RefObject<HTMLInputElement | null>;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onClose: () => void;
}) {
  return (
    <div className="space-y-4 pt-2">
      <Button variant="outline" size="sm" className="gap-2" onClick={downloadTemplate}>
        <Download className="h-4 w-4" />
        {t('downloadTemplate')}
      </Button>

      <label
        htmlFor="csv-upload"
        className="flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-border/60 py-12 cursor-pointer hover:border-primary/40 hover:bg-muted/30 transition-colors"
      >
        <Upload className="h-8 w-8 text-muted-foreground" />
        <div className="text-center">
          <p className="text-sm font-medium">{t('uploadLabel')}</p>
          <p className="text-xs text-muted-foreground mt-1">{t('uploadHint')}</p>
        </div>
        <input
          id="csv-upload"
          ref={fileRef}
          type="file"
          accept=".csv"
          className="sr-only"
          onChange={onFileChange}
        />
      </label>

      <div className="flex justify-end">
        <Button variant="ghost" onClick={onClose}>{t('cancel')}</Button>
      </div>
    </div>
  );
}

// ─── Step: preview ────────────────────────────────────────────────────────────
const PREVIEW_MAX = 5;

function PreviewStep({
  t,
  validRows,
  invalidRows,
  isPending,
  onImport,
  onBack,
  onClose,
}: {
  t: ReturnType<typeof useTranslations<'ProductImport'>>;
  validRows: ParsedRow[];
  invalidRows: ParsedRow[];
  isPending: boolean;
  onImport: () => void;
  onBack: () => void;
  onClose: () => void;
}) {
  const previewRows = validRows.slice(0, PREVIEW_MAX);

  return (
    <div className="space-y-4 pt-2">
      {/* Stats */}
      <div className="flex gap-3 flex-wrap">
        <Badge variant="secondary" className="gap-1 text-sm py-1 px-3">
          <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
          {t('validCount', { n: validRows.length })}
        </Badge>
        {invalidRows.length > 0 && (
          <Badge variant="secondary" className="gap-1 text-sm py-1 px-3">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
            {t('invalidCount', { n: invalidRows.length })}
          </Badge>
        )}
      </div>

      {/* Preview table */}
      {previewRows.length > 0 && (
        <div>
          <p className="text-xs text-muted-foreground mb-2">
            {t('previewTitle', { shown: previewRows.length, total: validRows.length })}
          </p>
          <div className="rounded-lg border max-h-52 overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="bg-muted/50 sticky top-0">
                <tr>
                  {(['colName', 'colBarcode', 'colCategory', 'colCostPrice', 'colSellPrice', 'colUnit'] as const).map(
                    (col) => (
                      <th key={col} className="px-3 py-2 text-start font-medium whitespace-nowrap">
                        {t(col)}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {previewRows.map((r) => {
                  const v = r.valid!;
                  return (
                    <tr key={r.rowIndex} className="border-t border-border/40">
                      <td className="px-3 py-1.5 max-w-[140px] truncate">{v.name}</td>
                      <td className="px-3 py-1.5 text-muted-foreground">{v.barcode || '—'}</td>
                      <td className="px-3 py-1.5 text-muted-foreground">{v.category || '—'}</td>
                      <td className="px-3 py-1.5">{v.cost_price}</td>
                      <td className="px-3 py-1.5">{v.sell_price}</td>
                      <td className="px-3 py-1.5">{v.unit}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Invalid row errors */}
      {invalidRows.length > 0 && (
        <div className="rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 p-3 space-y-1">
          <p className="text-xs font-medium text-amber-800 dark:text-amber-300 mb-2">
            {t('skippedLabel')}
          </p>
          {invalidRows.slice(0, 5).map((r) => (
            <p key={r.rowIndex} className="text-xs text-amber-700 dark:text-amber-400">
              {t('rowSkipped', { row: r.rowIndex, reason: r.error ?? '' })}
            </p>
          ))}
          {invalidRows.length > 5 && (
            <p className="text-xs text-amber-600 dark:text-amber-500">
              {t('moreSkipped', { n: invalidRows.length - 5 })}
            </p>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2 justify-between pt-1">
        <Button variant="ghost" size="sm" onClick={onBack} disabled={isPending}>
          {t('changeFile')}
        </Button>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={onClose} disabled={isPending}>
            {t('cancel')}
          </Button>
          <Button
            size="sm"
            onClick={onImport}
            disabled={isPending || validRows.length === 0}
            className="gap-2 min-w-32"
          >
            {isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {t('importing')}
              </>
            ) : (
              t('importBtn', { n: validRows.length })
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Step: done ───────────────────────────────────────────────────────────────
function DoneStep({
  t,
  summary,
  skipped,
  onClose,
}: {
  t: ReturnType<typeof useTranslations<'ProductImport'>>;
  summary: ImportSummary;
  skipped: number;
  onClose: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-4 py-6 text-center">
      <div className="rounded-full bg-green-100 dark:bg-green-900/30 p-4">
        <CheckCircle2 className="h-10 w-10 text-green-600 dark:text-green-400" />
      </div>
      <div className="space-y-1">
        <p className="text-lg font-semibold">{t('successTitle')}</p>
        <p className="text-muted-foreground text-sm">
          {t('successMsg', { inserted: summary.inserted })}
        </p>
        {summary.createdCategories > 0 && (
          <p className="text-muted-foreground text-sm">
            {t('createdCategoriesMsg', { n: summary.createdCategories })}
          </p>
        )}
        {skipped > 0 && (
          <p className="text-muted-foreground text-sm">
            {t('skippedMsg', { skipped })}
          </p>
        )}
      </div>
      <Button onClick={onClose}>{t('close')}</Button>
    </div>
  );
}
