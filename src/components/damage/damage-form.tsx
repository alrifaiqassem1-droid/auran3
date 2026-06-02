'use client';

import { useState, useEffect, useTransition, useCallback, useRef } from 'react';
import { useForm, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { useRouter } from '@/i18n/navigation';
import { useTranslations } from 'next-intl';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronsUpDown, Check, TriangleAlert, ScanLine, X, ZoomIn, ZoomOut } from 'lucide-react';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { enqueueAndRun } from '@/lib/offline/queue';
import { lookupProduct } from '@/lib/scan/lookup-product';
import { useActiveBranch } from '@/hooks/use-active-branch';
import { useBarcodeScanner } from '@/hooks/use-barcode-scanner';
import { useBeep } from '@/hooks/use-beep';
import { allocateFefo, expiryStatus } from '@/lib/stock/fefo';
import { getBatchesForProduct, type ProductOption } from '@/app/[locale]/(dashboard)/dashboard/damaged/actions';
import { damageSchema, type DamageInput } from '@/lib/validators/damage';
import type { BatchLike } from '@/lib/stock/fefo';

interface Props {
  products: ProductOption[];
  initialBarcode?: string | null;
  initialProductId?: string | null;
}

function fmt(n: number) {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(Math.floor(n));
}

function fmtDate(d: string | null) {
  if (!d) return null;
  return new Intl.DateTimeFormat('en-US', {
    day: '2-digit', month: 'short', year: 'numeric',
    timeZone: 'Asia/Dubai',
  }).format(new Date(d));
}

function statusColor(s: ReturnType<typeof expiryStatus>) {
  return {
    expired: 'bg-rose-500',
    critical: 'bg-rose-400',
    warning: 'bg-amber-400',
    safe: 'bg-emerald-400',
    none: 'bg-muted-foreground',
  }[s];
}

const DAMAGE_READER_ID = 'damage-qr-reader';

function DamageScannerOverlay({ onClose, onScanned }: { onClose: () => void; onScanned: (code: string) => void }) {
  const { beep, unlock } = useBeep();
  const [flash, setFlash] = useState(false);

  const handleScan = useCallback((code: string) => {
    beep();
    if (navigator.vibrate) navigator.vibrate(60);
    setFlash(true);
    setTimeout(() => setFlash(false), 300);
    onScanned(code);
    onClose();
  }, [beep, onScanned, onClose]);

  const scanner = useBarcodeScanner({ elementId: DAMAGE_READER_ID, onScan: handleScan });

  useEffect(() => { scanner.start(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-black" onPointerDown={unlock}>
      <div id={DAMAGE_READER_ID} className="absolute inset-0 qr-reader-host" />
      <motion.div
        className="pointer-events-none absolute inset-0 bg-white"
        animate={{ opacity: flash ? 0.3 : 0 }}
        transition={{ duration: 0.1 }}
      />
      <div className="absolute inset-x-0 top-0 flex items-center justify-between p-4"
           style={{ paddingTop: 'max(env(safe-area-inset-top, 0px), 16px)' }}>
        <div className="flex items-center gap-2">
          <button
            onClick={() => scanner.adjustZoom(-0.5)}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-sm"
          >
            <ZoomOut className="h-4 w-4" />
          </button>
          <button
            onClick={() => scanner.adjustZoom(0.5)}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-sm"
          >
            <ZoomIn className="h-4 w-4" />
          </button>
        </div>
        <button
          onClick={() => { scanner.stop(); onClose(); }}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-sm"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}

export function DamageForm({ products, initialBarcode, initialProductId }: Props) {
  const t = useTranslations('Damage');
  const { activeBranchId, activeMembership } = useActiveBranch();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [comboOpen, setComboOpen] = useState(false);
  const [selected, setSelected] = useState<ProductOption | null>(null);
  const [batches, setBatches] = useState<BatchLike[]>([]);
  const [scannerOpen, setScannerOpen] = useState(false);
  const initDone = useRef(false);

  const form = useForm<DamageInput>({
    resolver: zodResolver(damageSchema) as Resolver<DamageInput>,
    defaultValues: {
      branch_id: activeBranchId ?? '',
      product_id: '',
      quantity: 1,
      reason: 'expired',
      note: '',
    },
  });

  const watchedProductId = form.watch('product_id');
  const watchedQty = form.watch('quantity');

  // Sync branch_id when activeBranchId loads
  useEffect(() => {
    if (activeBranchId) form.setValue('branch_id', activeBranchId);
  }, [activeBranchId, form]);

  // Fetch batches when product changes
  useEffect(() => {
    if (!watchedProductId || !activeBranchId) { setBatches([]); return; }
    getBatchesForProduct(watchedProductId, activeBranchId).then(setBatches);
  }, [watchedProductId, activeBranchId]);

  // Handle initial product_id from URL (from notification link)
  const productInitDone = useRef(false);
  useEffect(() => {
    if (productInitDone.current || !initialProductId || products.length === 0) return;
    const found = products.find((p) => p.id === initialProductId);
    if (found) { productInitDone.current = true; selectProduct(found); }
  }, [initialProductId, products]); // eslint-disable-line react-hooks/exhaustive-deps

  // Handle initial barcode from URL
  useEffect(() => {
    if (initDone.current || !initialBarcode || !activeMembership?.tenant_id) return;
    initDone.current = true;
    lookupProduct(initialBarcode, activeMembership.tenant_id).then((p) => {
      if (!p) return;
      const found = products.find((x) => x.id === p.id);
      if (found) selectProduct(found);
    });
  }, [initialBarcode, activeMembership, products]); // eslint-disable-line react-hooks/exhaustive-deps

  const selectProduct = useCallback((p: ProductOption) => {
    setSelected(p);
    form.setValue('product_id', p.id, { shouldValidate: true });
    setComboOpen(false);
  }, [form]);

  const handleBarcodeScan = useCallback((barcode: string) => {
    if (!activeMembership?.tenant_id) return;
    lookupProduct(barcode, activeMembership.tenant_id).then((p) => {
      if (!p) return;
      const found = products.find((x) => x.id === p.id);
      if (found) selectProduct(found);
    });
  }, [activeMembership, products, selectProduct]);

  // FEFO preview
  const fefoPreview =
    batches.length > 0 && watchedQty > 0
      ? allocateFefo(batches, watchedQty)
      : null;

  function onSubmit(values: DamageInput) {
    if (!activeBranchId) return;

    // Client-side stock check
    if (fefoPreview && !fefoPreview.fulfilled) {
      toast.error(t('insufficientStock'));
      return;
    }

    startTransition(async () => {
      const payload = { ...values, branch_id: activeBranchId };
      const res = await enqueueAndRun('record_damage', payload as Record<string, unknown>);

      if (res.ok && !res.queued) {
        toast.success(t('success'));
        form.reset({ branch_id: activeBranchId, product_id: '', quantity: 1, reason: 'expired', note: '' });
        setSelected(null);
        setBatches([]);
        router.refresh();
      } else if (res.ok && res.queued) {
        toast.success(t('offline'));
        form.reset({ branch_id: activeBranchId, product_id: '', quantity: 1, reason: 'expired', note: '' });
        setSelected(null);
        setBatches([]);
      } else {
        const errMsg = res.error ?? '';
        if (errMsg.includes('AURAN_INSUFFICIENT_STOCK')) {
          toast.error(t('insufficientStock'));
        } else if (errMsg.includes('AURAN_FORBIDDEN')) {
          toast.error('لا تملك الصلاحية لهذه العملية');
        } else {
          toast.error(errMsg || 'فشل تسجيل التالف');
        }
      }
    });
  }

  return (
    <>
      {scannerOpen && (
        <DamageScannerOverlay
          onClose={() => setScannerOpen(false)}
          onScanned={handleBarcodeScan}
        />
      )}
    <Form {...form}>
      <motion.form
        onSubmit={form.handleSubmit(onSubmit)}
        className="space-y-5"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
      >
        {/* ── Scan barcode button ───────────────────────────────────── */}
        <Button
          type="button"
          variant="outline"
          className="h-12 w-full gap-2 rounded-xl border-primary/30 bg-primary/5 text-primary hover:bg-primary/10"
          onClick={() => setScannerOpen(true)}
        >
          <ScanLine className="h-4 w-4" />
          {t('scanBarcode')}
        </Button>

        {/* ── Product combobox ──────────────────────────────────────── */}
        <FormField
          control={form.control}
          name="product_id"
          render={({ fieldState }) => (
            <FormItem>
              <FormLabel>{t('product')}</FormLabel>
              <Popover open={comboOpen} onOpenChange={setComboOpen}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    role="combobox"
                    aria-expanded={comboOpen}
                    className={cn(
                      'w-full justify-between h-auto min-h-10 px-3 text-start font-normal',
                      fieldState.error && 'border-destructive',
                    )}
                  >
                    {selected ? (
                      <span className="flex items-center gap-2">
                        <span className="font-medium">{selected.name}</span>
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                          {selected.unit}
                        </Badge>
                      </span>
                    ) : (
                      <span className="text-muted-foreground">{t('searchPlaceholder')}</span>
                    )}
                    <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0 rounded-[20px] overflow-hidden border bg-card backdrop-blur-none" align="start" style={{ background: 'hsl(var(--card))', opacity: 1 }}>
                  <Command>
                    <CommandInput placeholder={t('searchPlaceholder')} />
                    <CommandList className="max-h-56">
                      <CommandEmpty>{t('noProduct')}</CommandEmpty>
                      <CommandGroup>
                        {products.map((p) => (
                          <CommandItem
                            key={p.id}
                            value={p.name}
                            onSelect={() => selectProduct(p)}
                            className="flex items-center justify-between"
                          >
                            <span className="flex items-center gap-2">
                              {selected?.id === p.id && (
                                <Check className="h-3.5 w-3.5 text-primary shrink-0" />
                              )}
                              <span>{p.name}</span>
                            </span>
                            {p.barcode && (
                              <span className="font-mono text-[10px] text-muted-foreground">
                                {p.barcode}
                              </span>
                            )}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* ── Reason + Quantity ─────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-3">
          <FormField
            control={form.control}
            name="reason"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('reason')}</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent className="rounded-[20px] bg-card border" style={{ background: 'hsl(var(--card))', opacity: 1 }}>
                    <SelectItem value="expired">{t('reasonExpired')}</SelectItem>
                    <SelectItem value="broken">{t('reasonBroken')}</SelectItem>
                    <SelectItem value="spoiled">{t('reasonSpoiled')}</SelectItem>
                    <SelectItem value="other">{t('reasonOther')}</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="quantity"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('quantity')}</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    step="1"
                    min="1"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    className="tabular-nums"
                    {...field}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => field.onChange(parseInt(e.target.value, 10) || 0)}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* ── FEFO preview ─────────────────────────────────────────── */}
        <AnimatePresence>
          {fefoPreview && selected && (
            <motion.div
              key="fefo"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div
                className={cn(
                  'rounded-xl p-3 text-sm',
                  fefoPreview.fulfilled
                    ? 'bg-muted/60 border border-border/50'
                    : 'bg-destructive/10 border border-destructive/20',
                )}
              >
                <p className="text-[11px] font-semibold text-muted-foreground mb-2 uppercase tracking-wide">
                  {t('suggestedBatch')}
                </p>

                {fefoPreview.allocations.length === 0 ? (
                  <p className="text-xs text-muted-foreground">{t('noBatches')}</p>
                ) : (
                  <div className="space-y-1.5">
                    {fefoPreview.allocations.slice(0, 4).map((a) => {
                      const batch = batches.find((b) => b.id === a.batchId);
                      if (!batch) return null;
                      const status = expiryStatus(batch.expiry_date);
                      return (
                        <div
                          key={a.batchId}
                          className="flex items-center justify-between gap-3"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <div
                              className={cn(
                                'h-2 w-2 shrink-0 rounded-full',
                                statusColor(status),
                              )}
                            />
                            <span className="text-xs text-muted-foreground truncate">
                              {batch.expiry_date
                                ? fmtDate(batch.expiry_date)
                                : t('noExpiry')}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 shrink-0 text-xs tabular-nums">
                            <span className="text-muted-foreground">
                              {t('batchAvailable')}: {fmt(batch.quantity)}
                            </span>
                            <span className="font-semibold text-destructive">
                              -{fmt(a.take)}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {!fefoPreview.fulfilled && (
                  <p className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-destructive">
                    <TriangleAlert className="h-3.5 w-3.5 shrink-0" />
                    {t('insufficientStock')}
                  </p>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Note ─────────────────────────────────────────────────── */}
        <FormField
          control={form.control}
          name="note"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('note')}</FormLabel>
              <FormControl>
                <Input placeholder={t('notePlaceholder')} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* ── Submit ───────────────────────────────────────────────── */}
        <Button
          type="submit"
          className="h-12 w-full rounded-xl text-base font-semibold"
          variant="destructive"
          disabled={isPending || !selected}
        >
          {isPending ? t('submitting') : t('submit')}
        </Button>
      </motion.form>
    </Form>
    </>
  );
}
