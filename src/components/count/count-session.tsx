'use client';

import {
  useState,
  useRef,
  useCallback,
  useEffect,
  useTransition,
} from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import {
  X,
  Check,
  ClipboardCheck,
  ScanLine,
  PenLine,
  TrendingDown,
  TrendingUp,
  Package,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { formatAED } from '@/lib/pricing';
import { useActiveBranch } from '@/hooks/use-active-branch';
import { useBeep } from '@/hooks/use-beep';
import { useBarcodeScanner } from '@/hooks/use-barcode-scanner';
import { enqueueAndRun } from '@/lib/offline/queue';
import { upsertCountItem } from '@/app/[locale]/(dashboard)/dashboard/count/actions';
import { CountLine } from './count-line';
import { CountSummary } from './count-summary';
import type { CountItemRow, CountProduct } from '@/app/[locale]/(dashboard)/dashboard/count/actions';

const READER_ID = 'count-qr-reader';

// ─── Scanner Overlay ──────────────────────────────────────────────────────────

function CountScannerOverlay({
  onClose,
  onScanned,
}: {
  onClose: () => void;
  onScanned: (barcode: string) => void;
}) {
  const t = useTranslations('Scanner');
  const { beep, unlock } = useBeep();
  const reduced = useReducedMotion();
  const [flash, setFlash] = useState(false);

  const handleScan = useCallback(
    (code: string) => {
      beep();
      if (!reduced) {
        setFlash(true);
        setTimeout(() => setFlash(false), 300);
      }
      onScanned(code);
      onClose();
    },
    [beep, reduced, onScanned, onClose],
  );

  const scanner = useBarcodeScanner({ elementId: READER_ID, onScan: handleScan });

  useEffect(() => {
    scanner.start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-black" onPointerDown={unlock}>
      <div id={READER_ID} className="absolute inset-0 qr-reader-host" />

      {!reduced && (
        <motion.div
          className="absolute inset-x-[10%] top-1/2 h-0.5 rounded-full bg-gradient-to-r from-transparent via-primary to-transparent shadow-[0_0_8px_2px_hsl(var(--primary)/0.8)]"
          animate={{ scaleX: [0.8, 1, 0.8] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
        />
      )}

      <motion.div
        className="pointer-events-none absolute inset-0 bg-white"
        animate={{ opacity: flash ? 0.3 : 0 }}
        transition={{ duration: 0.1 }}
      />

      <div className="absolute inset-x-0 top-0 flex items-center justify-between p-4 pt-[env(safe-area-inset-top)] pt-4">
        <span className="rounded-full bg-black/60 px-3 py-1 text-xs font-medium text-white backdrop-blur-sm">
          {t('aimCamera')}
        </span>
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

// ─── Add Manually Sheet ───────────────────────────────────────────────────────

function AddManuallySheet({
  open,
  onOpenChange,
  products,
  addedIds,
  onAdd,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  products: CountProduct[];
  addedIds: Set<string>;
  onAdd: (product: CountProduct) => void;
}) {
  const t = useTranslations('Count');
  const [search, setSearch] = useState('');

  const filtered = products.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.barcode && p.barcode.includes(search)),
  );

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) setSearch(''); onOpenChange(v); }}>
      <SheetContent side="bottom" className="max-h-[70vh] overflow-y-auto rounded-t-2xl pb-8">
        <SheetHeader className="mb-4">
          <SheetTitle>{t('pickProduct')}</SheetTitle>
        </SheetHeader>

        <Input
          autoFocus
          placeholder={t('searchPlaceholder')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="mb-3"
        />

        <div className="overflow-y-auto max-h-[calc(70vh-10rem)] rounded-xl border border-border/60 divide-y divide-border/40">
          {filtered.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">{t('noItems')}</p>
          ) : (
            filtered.map((p) => {
              const already = addedIds.has(p.id);
              return (
                <button
                  key={p.id}
                  onClick={() => { onAdd(p); onOpenChange(false); setSearch(''); }}
                  className="flex w-full items-center gap-3 px-4 py-3 text-start transition-colors hover:bg-muted/40 active:bg-muted/60"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                    {already
                      ? <Check className="h-4 w-4 text-primary" />
                      : <Package className="h-4 w-4 text-primary" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{p.name}</p>
                    {p.barcode && (
                      <p className="font-mono text-[11px] text-muted-foreground">{p.barcode}</p>
                    )}
                  </div>
                  <Badge variant="secondary" className="shrink-0 text-[10px] px-1.5 py-0 uppercase">
                    {p.unit}
                  </Badge>
                </button>
              );
            })
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ─── End Session Dialog ───────────────────────────────────────────────────────

function EndSessionDialog({
  open,
  onOpenChange,
  items,
  onConfirm,
  isClosing,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  items: CountItemRow[];
  onConfirm: () => void;
  isClosing: boolean;
}) {
  const t = useTranslations('Count');

  const diffs = items.filter((i) => Math.abs(i.counted_qty - i.expected_qty) > 0.001);
  const totalDiffValue = diffs.reduce(
    (acc, d) => acc + (d.counted_qty - d.expected_qty) * d.product_cost,
    0,
  );

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!isClosing) onOpenChange(v); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{t('endSessionTitle')}</DialogTitle>
          <DialogDescription>{t('endSessionDesc')}</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-border/60 bg-muted/30 p-3 text-center">
            <p className="text-2xl font-bold tabular-nums">{items.length}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{t('itemsInSession')}</p>
          </div>
          <div
            className={cn(
              'rounded-xl border p-3 text-center',
              diffs.length > 0
                ? 'border-amber-500/30 bg-amber-500/5'
                : 'border-emerald-500/30 bg-emerald-500/5',
            )}
          >
            <p
              className={cn(
                'text-2xl font-bold tabular-nums',
                diffs.length > 0
                  ? 'text-amber-600 dark:text-amber-400'
                  : 'text-emerald-600 dark:text-emerald-400',
              )}
            >
              {diffs.length}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">{t('diffsInSession')}</p>
          </div>
        </div>

        {diffs.length > 0 && (
          <div className="max-h-48 overflow-y-auto space-y-1.5 rounded-xl border border-border/60 p-2">
            {diffs.slice(0, 4).map((d) => {
              const diff = d.counted_qty - d.expected_qty;
              const surplus = diff > 0;
              return (
                <div key={d.product_id} className="flex items-center justify-between gap-2 px-1 py-0.5 text-sm">
                  <span className="truncate font-medium">{d.product_name}</span>
                  <span
                    className={cn(
                      'flex shrink-0 items-center gap-0.5 text-xs font-semibold tabular-nums',
                      surplus ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400',
                    )}
                  >
                    {surplus ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                    {diff > 0 ? '+' : ''}
                    {new Intl.NumberFormat('en-US', { maximumFractionDigits: 3 }).format(diff)}
                  </span>
                </div>
              );
            })}
            {diffs.length > 4 && (
              <p className="px-1 text-[11px] text-muted-foreground">+{diffs.length - 4} more</p>
            )}
          </div>
        )}

        {diffs.length > 0 && (
          <div className="flex items-center justify-between rounded-xl border border-border/60 bg-muted/30 px-4 py-2.5">
            <span className="text-xs text-muted-foreground">{t('totalDiff')}</span>
            <span
              className={cn(
                'text-sm font-bold tabular-nums',
                totalDiffValue < 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400',
              )}
            >
              {totalDiffValue >= 0 ? '+' : ''}
              {formatAED(totalDiffValue)}
            </span>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isClosing}>
            {t('cancel')}
          </Button>
          <Button onClick={onConfirm} disabled={isClosing}>
            {isClosing ? t('closing') : t('endSessionConfirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface Props {
  countId: string;
  initialItems: CountItemRow[];
  products: CountProduct[];
  branchId: string;
}

export function CountSession({ countId, initialItems, products, branchId }: Props) {
  const t = useTranslations('Count');
  const { activeMembership } = useActiveBranch();
  const reduced = useReducedMotion();

  const [items, setItems]               = useState<CountItemRow[]>(initialItems);
  const [scannerOpen, setScannerOpen]   = useState(false);
  const [showManual, setShowManual]     = useState(false);
  const [showEndDialog, setShowEndDialog] = useState(false);
  const [isClosed, setIsClosed]         = useState(false);
  const [isClosing, startCloseTransition] = useTransition();

  const inputRefs      = useRef<Map<string, HTMLInputElement>>(new Map());
  const debounceTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const setInputRef = useCallback((productId: string) => (el: HTMLInputElement | null) => {
    if (el) inputRefs.current.set(productId, el);
    else inputRefs.current.delete(productId);
  }, []);

  function focusQty(productId: string) {
    setTimeout(() => {
      const el = inputRefs.current.get(productId);
      if (el) { el.focus(); el.select(); }
    }, 80);
  }

  // ── Add or focus product ───────────────────────────────────────────────────
  const addOrFocus = useCallback(
    (product: CountProduct) => {
      setItems((prev) => {
        const existing = prev.find((i) => i.product_id === product.id);
        if (existing) {
          focusQty(product.id);
          return prev;
        }
        const newItem: CountItemRow = {
          id: '',
          product_id: product.id,
          product_name: product.name,
          product_unit: product.unit,
          product_barcode: product.barcode,
          product_cost: product.cost_price,
          expected_qty: 0,
          counted_qty: 1,
        };
        focusQty(product.id);
        void upsertCountItem({ count_id: countId, product_id: product.id, counted_qty: 1 }).then(
          (res) => {
            if (res.ok && res.expected_qty !== undefined) {
              setItems((cur) =>
                cur.map((i) =>
                  i.product_id === product.id ? { ...i, expected_qty: res.expected_qty! } : i,
                ),
              );
            }
          },
        );
        return [...prev, newItem];
      });
    },
    [countId],
  );

  // ── Barcode scan handler ───────────────────────────────────────────────────
  const handleBarcode = useCallback(
    (barcode: string) => {
      const tenantId = activeMembership?.tenant_id;
      if (!tenantId) return;

      const product = products.find((p) => p.barcode === barcode);
      if (product) {
        addOrFocus(product);
      } else {
        toast.warning(t('unknownBarcode'));
      }
    },
    [products, activeMembership, addOrFocus, t],
  );

  // ── Quantity change + debounced save ───────────────────────────────────────
  function handleQtyChange(productId: string, qty: number) {
    setItems((prev) =>
      prev.map((i) => (i.product_id === productId ? { ...i, counted_qty: qty } : i)),
    );

    const existing = debounceTimers.current.get(productId);
    if (existing) clearTimeout(existing);

    const timer = setTimeout(async () => {
      debounceTimers.current.delete(productId);
      const res = await upsertCountItem({
        count_id: countId,
        product_id: productId,
        counted_qty: qty,
      });
      if (!res.ok) toast.error(res.error ?? 'Save failed');
    }, 600);

    debounceTimers.current.set(productId, timer);
  }

  // ── Immediate confirm (flushes debounce) ──────────────────────────────────
  function handleConfirmItem(productId: string) {
    const existing = debounceTimers.current.get(productId);
    if (existing) clearTimeout(existing);
    debounceTimers.current.delete(productId);

    const item = items.find((i) => i.product_id === productId);
    if (!item) return;

    void upsertCountItem({ count_id: countId, product_id: productId, counted_qty: item.counted_qty })
      .then((res) => {
        if (res.ok) toast.success(t('countedLabel'));
        else toast.error(res.error ?? 'Save failed');
      });
  }

  // ── Confirm close ──────────────────────────────────────────────────────────
  function handleConfirmClose() {
    startCloseTransition(async () => {
      const res = await enqueueAndRun('close_count', { count_id: countId });
      if (res.ok && !res.queued) {
        toast.success(t('closeSuccess'));
        setIsClosed(true);
        setShowEndDialog(false);
      } else if (res.ok && res.queued) {
        toast.success(t('closeOffline'));
        setIsClosed(true);
        setShowEndDialog(false);
      } else {
        const msg = res.error ?? '';
        if (msg.includes('AURAN_COUNT_CLOSED')) {
          toast.info(t('closeSuccess'));
          setIsClosed(true);
          setShowEndDialog(false);
        } else {
          toast.error(msg || t('closeError'));
        }
      }
    });
  }

  useEffect(() => {
    return () => { debounceTimers.current.forEach(clearTimeout); };
  }, []);

  const addedIds      = new Set(items.map((i) => i.product_id));
  const countedItems  = items.filter((i) => i.counted_qty > 0).length;

  // ── After close ────────────────────────────────────────────────────────────
  if (isClosed) {
    return (
      <div className="container max-w-2xl px-4 py-6">
        <CountSummary items={items} />
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <>
      {/* Scanner overlay */}
      <AnimatePresence>
        {scannerOpen && (
          <motion.div
            key="scanner"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduced ? 0 : 0.2 }}
          >
            <CountScannerOverlay
              onClose={() => setScannerOpen(false)}
              onScanned={handleBarcode}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Add Manually sheet */}
      <AddManuallySheet
        open={showManual}
        onOpenChange={setShowManual}
        products={products}
        addedIds={addedIds}
        onAdd={addOrFocus}
      />

      {/* End session dialog */}
      <EndSessionDialog
        open={showEndDialog}
        onOpenChange={setShowEndDialog}
        items={items}
        onConfirm={handleConfirmClose}
        isClosing={isClosing}
      />

      <div className="container max-w-2xl px-4 py-6">
        {/* Page header */}
        <div className="mb-5 flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">{t('sessionTitle')}</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {t('counted', { n: countedItems })}
            </p>
          </div>
          <Badge variant="outline" className="shrink-0 border-primary/40 text-primary tabular-nums">
            {new Intl.NumberFormat('en-US').format(countedItems)}
          </Badge>
        </div>

        {/* Sticky action bar: two buttons */}
        <div className="sticky top-0 z-30 -mx-4 mb-4 flex gap-2 border-b border-border/40 bg-background/95 px-4 pb-3 pt-2 backdrop-blur-md">
          <Button
            className="h-12 flex-1 gap-2 rounded-xl shadow-md shadow-primary/20"
            onClick={() => setScannerOpen(true)}
          >
            <ScanLine className="h-4 w-4 shrink-0" />
            {t('scanToCount')}
          </Button>
          <Button
            variant="outline"
            className="h-12 flex-1 gap-2 rounded-xl"
            onClick={() => setShowManual(true)}
          >
            <PenLine className="h-4 w-4 shrink-0" />
            {t('addManuallyBtn')}
          </Button>
        </div>

        {/* Items list */}
        {items.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border/60 py-16 text-center"
          >
            <ClipboardCheck className="h-10 w-10 text-muted-foreground/40" />
            <div>
              <p className="font-semibold text-muted-foreground">{t('noItems')}</p>
              <p className="mt-1 text-sm text-muted-foreground/70">{t('noItemsDesc')}</p>
            </div>
          </motion.div>
        ) : (
          <AnimatePresence initial={false}>
            <div className="space-y-2">
              {items.map((item) => (
                <motion.div
                  key={item.product_id}
                  initial={{ opacity: 0, y: -8, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ duration: reduced ? 0 : 0.2, ease: [0.22, 1, 0.36, 1] }}
                >
                  <CountLine
                    item={item}
                    onChange={handleQtyChange}
                    onConfirm={handleConfirmItem}
                    ref={setInputRef(item.product_id)}
                  />
                </motion.div>
              ))}
            </div>
          </AnimatePresence>
        )}

        {/* End Session — always visible */}
        <div className="mt-8 pb-4">
          <Button
            onClick={() => setShowEndDialog(true)}
            disabled={isClosing}
            className="h-12 w-full rounded-xl text-sm font-semibold"
          >
            {t('endSession')}
          </Button>
        </div>
      </div>
    </>
  );
}
