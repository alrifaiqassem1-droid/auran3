'use client';

import { useRef, useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import {
  FileText, Download, Upload, Loader2, CheckCircle2,
  AlertTriangle, XCircle,
} from 'lucide-react';
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

import { enqueueAndRun } from '@/lib/offline/queue';
import { useActiveBranch } from '@/hooks/use-active-branch';

// ─── Arabic-Indic → Latin digit normalizer ───────────────────────────────────
function toLatinDigits(v: string): string {
  return v.replace(/[٠١٢٣٤٥٦٧٨٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
}

function parsePositiveNumber(raw: string): number | null {
  const s = toLatinDigits(raw.trim()).replace(/[^0-9.]/g, '');
  const n = parseFloat(s);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function parseNonNegNumber(raw: string): number | null {
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

type ProductRow = { id: string; name: string; unit: 'pcs' | 'kg'; barcode: string | null; cost_price: number };

export interface StockCsvRow {
  rowIndex: number;
  raw: Record<string, string>;
  // Set when validation passes and product is matched
  matched?: {
    product: ProductRow;
    quantity: number;
    cost_price: number;
    expiry_date: string | null;
  };
  // Set when row has a parse error (invalid qty / cost)
  error?: string;
  // Set when product could not be resolved by barcode or name
  unmatched?: { identifier: string };
}

function parseCsvText(
  text: string,
  products: ProductRow[],
  errMsg: (k: string) => string,
): StockCsvRow[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];

  const headers = lines[0]
    .split(',')
    .map((h) => h.trim().toLowerCase().replace(/['"]/g, ''));

  // Build lookup maps
  const byBarcode = new Map<string, ProductRow>();
  const byName    = new Map<string, ProductRow>();
  for (const p of products) {
    if (p.barcode) byBarcode.set(p.barcode.trim(), p);
    byName.set(p.name.toLowerCase().trim(), p);
  }

  const results: StockCsvRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const values = splitCsvLine(line);
    const raw: Record<string, string> = {};
    headers.forEach((h, idx) => { raw[h] = (values[idx] ?? '').trim(); });

    // Resolve product — barcode first, then name
    const barcodeRaw = (raw['barcode'] ?? '').trim();
    const nameRaw    = (raw['product_name'] ?? raw['name'] ?? '').trim();
    const identifier = barcodeRaw || nameRaw;

    let product: ProductRow | undefined;
    if (barcodeRaw) product = byBarcode.get(barcodeRaw);
    if (!product && nameRaw) product = byName.get(nameRaw.toLowerCase());

    if (!product) {
      results.push({ rowIndex: i, raw, unmatched: { identifier: identifier || `row ${i}` } });
      continue;
    }

    // Validate quantity
    const qty = parsePositiveNumber(raw['quantity'] ?? raw['qty'] ?? '');
    if (qty === null) {
      results.push({ rowIndex: i, raw, error: errMsg('csvErrorInvalidQty') });
      continue;
    }

    // Validate cost (0 is allowed)
    const costRaw = raw['cost_price'] ?? raw['cost'] ?? '';
    const cost = costRaw.trim() === '' ? product.cost_price : parseNonNegNumber(costRaw);
    if (cost === null) {
      results.push({ rowIndex: i, raw, error: errMsg('csvErrorInvalidCost') });
      continue;
    }

    // Expiry date — optional, pass through as-is (YYYY-MM-DD)
    const expiry = (raw['expiry_date'] ?? raw['expiry'] ?? '').trim() || null;

    results.push({
      rowIndex: i,
      raw,
      matched: { product, quantity: qty, cost_price: cost, expiry_date: expiry },
    });
  }

  return results;
}

// ─── Template download ────────────────────────────────────────────────────────
function downloadTemplate() {
  const csv = [
    'product_name,barcode,quantity,cost_price,expiry_date',
    'زبدة نستله 200g,6281006321097,50,4.5,2027-03-01',
    'رز بسمتي 5kg,,20,15,',
    'لحم بقري مفروم,6281003099117,8.5,28,2026-07-15',
  ].join('\r\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = 'initial_stock_template.csv';
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Types ────────────────────────────────────────────────────────────────────
type Step = 'idle' | 'preview' | 'done';

interface Props {
  open:          boolean;
  onOpenChange:  (v: boolean) => void;
  products:      ProductRow[];
  supplierId:    string;
  reference:     string;
}

const PREVIEW_MAX = 5;

// ─── Main dialog ──────────────────────────────────────────────────────────────
export function InitialStockCsvDialog({
  open, onOpenChange, products, supplierId, reference,
}: Props) {
  const t       = useTranslations('Receiving');
  const router  = useRouter();
  const { activeBranchId } = useActiveBranch();

  const [step,       setStep]       = useState<Step>('idle');
  const [rows,       setRows]       = useState<StockCsvRow[]>([]);
  const [imported,   setImported]   = useState(0);
  const [isPending,  startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  const matchedRows   = rows.filter((r) => r.matched);
  const errorRows     = rows.filter((r) => r.error);
  const unmatchedRows = rows.filter((r) => r.unmatched);

  function reset() {
    setStep('idle');
    setRows([]);
    setImported(0);
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
      toast.error(t('csvErrorInvalidFile'));
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const parsed = parseCsvText(text, products, (k) => t(k as Parameters<typeof t>[0]));
      if (!parsed.length) {
        toast.error(t('csvErrorEmpty'));
        return;
      }
      setRows(parsed);
      setStep('preview');
    };
    reader.readAsText(file, 'utf-8');
  }

  function handleImport() {
    if (!activeBranchId) {
      toast.error(t('csvErrorNoBranch'));
      return;
    }

    const lines = matchedRows.map((r) => ({
      product_id:  r.matched!.product.id,
      quantity:    r.matched!.quantity,
      cost_price:  r.matched!.cost_price,
      expiry_date: r.matched!.expiry_date ?? null,
      lot_number:  null,
    }));

    startTransition(async () => {
      const res = await enqueueAndRun('receive_goods', {
        branch_id:   activeBranchId,
        supplier_id: supplierId || null,
        reference:   reference || null,
        lines,
      });

      if (res.ok && !res.queued) {
        setImported(lines.length);
        setStep('done');
        router.refresh();
      } else if (res.ok && res.queued) {
        setImported(lines.length);
        setStep('done');
        toast.success(t('confirmOffline'));
      } else {
        toast.error(t('csvErrorServer'));
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary shrink-0" />
            {t('csvTitle')}
          </DialogTitle>
          <DialogDescription>{t('csvSubtitle')}</DialogDescription>
        </DialogHeader>

        {step === 'idle' && (
          <IdleStep t={t} fileRef={fileRef} onFileChange={handleFileChange} onClose={() => handleClose(false)} />
        )}
        {step === 'preview' && (
          <PreviewStep
            t={t}
            matchedRows={matchedRows}
            errorRows={errorRows}
            unmatchedRows={unmatchedRows}
            isPending={isPending}
            onImport={handleImport}
            onBack={reset}
            onClose={() => handleClose(false)}
          />
        )}
        {step === 'done' && (
          <DoneStep t={t} imported={imported} skipped={errorRows.length} onClose={() => handleClose(false)} />
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── Step: idle ───────────────────────────────────────────────────────────────
function IdleStep({
  t, fileRef, onFileChange, onClose,
}: {
  t: ReturnType<typeof useTranslations<'Receiving'>>;
  fileRef: React.RefObject<HTMLInputElement | null>;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onClose: () => void;
}) {
  return (
    <div className="space-y-4 pt-2">
      <Button variant="outline" size="sm" className="gap-2" onClick={downloadTemplate}>
        <Download className="h-4 w-4" />
        {t('csvDownloadTemplate')}
      </Button>

      <label
        htmlFor="stock-csv-upload"
        className="flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-border/60 py-12 cursor-pointer hover:border-primary/40 hover:bg-muted/30 transition-colors"
      >
        <Upload className="h-8 w-8 text-muted-foreground" />
        <div className="text-center">
          <p className="text-sm font-medium">{t('csvUploadLabel')}</p>
          <p className="text-xs text-muted-foreground mt-1">{t('csvUploadHint')}</p>
        </div>
        <input
          id="stock-csv-upload"
          ref={fileRef}
          type="file"
          accept=".csv"
          className="sr-only"
          onChange={onFileChange}
        />
      </label>

      <div className="flex justify-end">
        <Button variant="ghost" onClick={onClose}>{t('csvCancel')}</Button>
      </div>
    </div>
  );
}

// ─── Step: preview ────────────────────────────────────────────────────────────
function PreviewStep({
  t, matchedRows, errorRows, unmatchedRows, isPending, onImport, onBack, onClose,
}: {
  t: ReturnType<typeof useTranslations<'Receiving'>>;
  matchedRows:   StockCsvRow[];
  errorRows:     StockCsvRow[];
  unmatchedRows: StockCsvRow[];
  isPending:     boolean;
  onImport:      () => void;
  onBack:        () => void;
  onClose:       () => void;
}) {
  const previewRows    = matchedRows.slice(0, PREVIEW_MAX);
  const totalRows      = matchedRows.length + errorRows.length + unmatchedRows.length;
  const skippedCount   = errorRows.length + unmatchedRows.length;

  return (
    <div className="space-y-4 pt-2">
      {/* Stats row */}
      <div className="flex gap-2 flex-wrap">
        <Badge variant="secondary" className="gap-1.5 text-sm py-1 px-3">
          <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
          {t('csvValidCount', { n: matchedRows.length })}
        </Badge>
        {unmatchedRows.length > 0 && (
          <Badge variant="secondary" className="gap-1.5 text-sm py-1 px-3">
            <XCircle className="h-3.5 w-3.5 text-muted-foreground" />
            {t('csvUnmatchedCount', { n: unmatchedRows.length })}
          </Badge>
        )}
        {errorRows.length > 0 && (
          <Badge variant="secondary" className="gap-1.5 text-sm py-1 px-3">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
            {t('csvSkippedCount', { n: errorRows.length })}
          </Badge>
        )}
      </div>

      {/* Matched preview table */}
      {previewRows.length > 0 && (
        <div>
          <p className="text-xs text-muted-foreground mb-2">
            {t('csvPreviewTitle', { shown: previewRows.length, total: matchedRows.length })}
          </p>
          <div className="rounded-lg border max-h-48 overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="bg-muted/50 sticky top-0">
                <tr>
                  {(['csvColProduct', 'csvColQty', 'csvColCost', 'csvColExpiry'] as const).map((col) => (
                    <th key={col} className="px-3 py-2 text-start font-medium whitespace-nowrap">
                      {t(col)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {previewRows.map((r) => {
                  const m = r.matched!;
                  return (
                    <tr key={r.rowIndex} className="border-t border-border/40">
                      <td className="px-3 py-1.5 max-w-[160px] truncate">{m.product.name}</td>
                      <td className="px-3 py-1.5 tabular-nums">{m.quantity}</td>
                      <td className="px-3 py-1.5 tabular-nums">{m.cost_price}</td>
                      <td className="px-3 py-1.5 text-muted-foreground">{m.expiry_date ?? '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Unmatched products */}
      {unmatchedRows.length > 0 && (
        <div className="rounded-lg bg-muted/40 border border-border/50 p-3 space-y-1">
          <p className="text-xs font-medium text-muted-foreground mb-1.5">
            {t('csvUnmatchedCount', { n: unmatchedRows.length })} — {t('csvStatusUnmatched')}
          </p>
          {unmatchedRows.slice(0, 5).map((r) => (
            <p key={r.rowIndex} className="text-xs text-muted-foreground">
              {t('csvRowSkipped', { row: r.rowIndex, reason: r.unmatched!.identifier })}
            </p>
          ))}
          {unmatchedRows.length > 5 && (
            <p className="text-xs text-muted-foreground">{t('csvMoreSkipped', { n: unmatchedRows.length - 5 })}</p>
          )}
        </div>
      )}

      {/* Parse errors */}
      {errorRows.length > 0 && (
        <div className="rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 p-3 space-y-1">
          <p className="text-xs font-medium text-amber-800 dark:text-amber-300 mb-1.5">
            {t('csvSkippedLabel')}
          </p>
          {errorRows.slice(0, 4).map((r) => (
            <p key={r.rowIndex} className="text-xs text-amber-700 dark:text-amber-400">
              {t('csvRowSkipped', { row: r.rowIndex, reason: r.error ?? '' })}
            </p>
          ))}
          {errorRows.length > 4 && (
            <p className="text-xs text-amber-600 dark:text-amber-500">{t('csvMoreSkipped', { n: errorRows.length - 4 })}</p>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between gap-2 pt-1">
        <Button variant="ghost" size="sm" onClick={onBack} disabled={isPending}>
          {t('csvChangeFile')}
        </Button>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={onClose} disabled={isPending}>
            {t('csvCancel')}
          </Button>
          <Button
            size="sm"
            onClick={onImport}
            disabled={isPending || matchedRows.length === 0}
            className="gap-2 min-w-36"
          >
            {isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {t('csvImporting')}
              </>
            ) : (
              t('csvImportBtn', { n: matchedRows.length })
            )}
          </Button>
        </div>
      </div>

      {skippedCount > 0 && matchedRows.length > 0 && (
        <p className="text-xs text-center text-muted-foreground">
          {t('csvSkippedCount', { n: skippedCount })} — {t('csvValidCount', { n: matchedRows.length })} / {totalRows}
        </p>
      )}
    </div>
  );
}

// ─── Step: done ───────────────────────────────────────────────────────────────
function DoneStep({
  t, imported, skipped, onClose,
}: {
  t: ReturnType<typeof useTranslations<'Receiving'>>;
  imported: number;
  skipped:  number;
  onClose:  () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-4 py-6 text-center">
      <div className="rounded-full bg-green-100 dark:bg-green-900/30 p-4">
        <CheckCircle2 className="h-10 w-10 text-green-600 dark:text-green-400" />
      </div>
      <div className="space-y-1">
        <p className="text-lg font-semibold">{t('csvSuccessTitle')}</p>
        <p className="text-muted-foreground text-sm">{t('csvSuccessMsg', { n: imported })}</p>
        {skipped > 0 && (
          <p className="text-muted-foreground text-sm">{t('csvSkippedCount', { n: skipped })}</p>
        )}
      </div>
      <Button onClick={onClose}>{t('csvClose')}</Button>
    </div>
  );
}
