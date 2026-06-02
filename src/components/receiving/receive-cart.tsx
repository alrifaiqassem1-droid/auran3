'use client';

import {
  useState,
  useCallback,
  useEffect,
  useRef,
} from 'react';
import { useRouter } from '@/i18n/navigation';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import {
  X,
  ScanLine,
  PenLine,
  RotateCcw,
  ZoomIn,
  ZoomOut,
  Package,
  Check,
  PlusCircle,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { formatAED } from '@/lib/pricing';
import { enqueueAndRun } from '@/lib/offline/queue';
import { lookupProduct } from '@/lib/scan/lookup-product';
import { useActiveBranch } from '@/hooks/use-active-branch';
import { useCelebration } from '@/hooks/use-celebration';
import { useBarcodeScanner } from '@/hooks/use-barcode-scanner';
import { useBeep } from '@/hooks/use-beep';
import { SupplierSelect } from './supplier-select';
import { ReceiveLine, type CartItem } from './receive-line';
import { ProductForm } from '@/components/products/product-form';

// ─── Types ────────────────────────────────────────────────────────────────────

type ProductRow = {
  id: string;
  name: string;
  unit: 'pcs' | 'kg';
  barcode: string | null;
  cost_price: number;
};

// ─── Scanner Overlay ──────────────────────────────────────────────────────────

const READER_ID = 'receive-qr-reader';

function ReceiveScannerOverlay({
  onClose,
  onScanned,
}: {
  onClose: () => void;
  onScanned: (barcode: string) => void;
}) {
  const tR    = useTranslations('Receiving');
  const { beep, unlock } = useBeep();
  const [flash, setFlash] = useState(false);

  const handleScan = useCallback(
    (code: string) => {
      beep();
      if (navigator.vibrate) navigator.vibrate(60);
      // Flash feedback then close immediately — no popup shown
      setFlash(true);
      setTimeout(() => setFlash(false), 250);
      // Close the camera first, then process in background
      onClose();
      void onScanned(code);
    },
    [beep, onClose, onScanned],
  );

  const scanner = useBarcodeScanner({ elementId: READER_ID, onScan: handleScan });

  useEffect(() => {
    scanner.start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-black" onPointerDown={unlock}>
      {/* Header */}
      <div className="absolute inset-x-0 top-0 z-10 flex items-center justify-between px-3 py-3"
           style={{ paddingTop: 'max(env(safe-area-inset-top, 0px), 12px)' }}>
        <button
          onClick={() => { scanner.stop(); onClose(); }}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-sm active:scale-90 transition-transform"
        >
          <X className="h-5 w-5" />
        </button>
        <span className="rounded-full bg-black/60 backdrop-blur-sm px-3 py-1.5 text-[11px] font-semibold text-white/90">
          {tR('scannerTitle')}
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => scanner.adjustZoom(-0.5)}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-sm"
          >
            <ZoomOut className="h-4 w-4" />
          </button>
          <button
            onClick={() => scanner.adjustZoom(0.5)}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-sm"
          >
            <ZoomIn className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Camera container — fills screen */}
      <div id={READER_ID} className="h-full w-full qr-reader-host" />

      {/* Loading indicator while camera initialises */}
      {scanner.status === 'starting' && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/70">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
        </div>
      )}

      {/* Camera error / permission denied */}
      {(scanner.status === 'denied' || scanner.status === 'error') && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black/90 px-6 text-center">
          <p className="text-white font-semibold text-base">
            {scanner.status === 'denied' ? '🔒 Camera access denied' : '⚠️ Camera error'}
          </p>
          <p className="text-white/60 text-sm">
            {scanner.status === 'denied'
              ? 'Allow camera access in your browser settings, then try again.'
              : 'Camera not working? Check that no other app is using it.'}
          </p>
          <Button
            onClick={() => scanner.start()}
            className="rounded-full gap-2 px-5 py-2.5"
            size="sm"
          >
            <RotateCcw className="h-4 w-4" />
            Camera not working? Tap to retry
          </Button>
        </div>
      )}

      {/* Flash on scan */}
      <AnimatePresence>
        {flash && (
          <motion.div
            className="pointer-events-none absolute inset-0 bg-white/20"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.12 }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Unknown Barcode Sheet ────────────────────────────────────────────────────

function UnknownBarcodeSheet({
  open,
  barcode,
  onAddProduct,
  onCancel,
}: {
  open: boolean;
  barcode: string;
  onAddProduct: () => void;
  onCancel: () => void;
}) {
  const t = useTranslations('Receiving');
  return (
    <Sheet open={open} onOpenChange={(v) => !v && onCancel()}>
      <SheetContent side="bottom" className="rounded-t-[24px] pb-safe">
        <SheetHeader className="mb-6">
          <SheetTitle className="text-center">{t('unknownBarcode')}</SheetTitle>
          <p className="text-center font-mono text-xs text-muted-foreground">{barcode}</p>
        </SheetHeader>
        <div className="space-y-3 pb-4">
          <Button
            className="h-13 w-full gap-2 rounded-xl text-sm font-semibold"
            onClick={onAddProduct}
          >
            <PlusCircle className="h-4 w-4" />
            {t('createProductInline')}
          </Button>
          <Button
            variant="outline"
            className="h-12 w-full gap-2 rounded-xl text-sm"
            onClick={onCancel}
          >
            <X className="h-4 w-4" />
            {t('cancel')}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ─── Add Manually Sheet ───────────────────────────────────────────────────────

function AddManuallySheet({
  open,
  onOpenChange,
  products,
  onAdd,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  products: ProductRow[];
  onAdd: (item: CartItem) => void;
}) {
  const t = useTranslations('Receiving');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [qty, setQty] = useState(1);
  const [cost, setCost] = useState(0);
  const [expiry, setExpiry] = useState('');

  const selected = products.find((p) => p.id === selectedId);
  const filtered = products.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.barcode && p.barcode.includes(search)),
  );

  function reset() {
    setSearch('');
    setSelectedId('');
    setQty(1);
    setCost(0);
    setExpiry('');
  }

  function handleSelect(p: ProductRow) {
    setSelectedId(p.id);
    setCost(p.cost_price);
    setSearch('');
  }

  function handleAdd() {
    if (!selected) return;
    onAdd({
      product_id: selected.id,
      product_name: selected.name,
      unit: selected.unit,
      quantity: qty > 0 ? qty : 1,
      cost_price: cost >= 0 ? cost : 0,
      expiry_date: expiry || null,
    });
    onOpenChange(false);
    reset();
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(v) => {
        if (!v) reset();
        onOpenChange(v);
      }}
    >
      <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto rounded-t-[24px] pb-8">
        <SheetHeader className="mb-4">
          <SheetTitle>{t('manualAddTitle')}</SheetTitle>
        </SheetHeader>

        {!selected ? (
          <div className="space-y-2">
            <Input
              autoFocus
              placeholder={t('selectProductPlaceholder')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <div className="max-h-52 overflow-y-auto rounded-xl border border-border/60 divide-y divide-border/40">
              {filtered.length === 0 ? (
                <p className="px-4 py-6 text-center text-sm text-muted-foreground">{t('noProducts')}</p>
              ) : (
                filtered.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => handleSelect(p)}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/40 active:bg-muted/60"
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                      <Package className="h-4 w-4 text-primary" />
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
                ))
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-2 rounded-xl border border-border/60 bg-muted/30 px-3 py-2.5">
              <div className="flex items-center gap-2 min-w-0">
                <Check className="h-4 w-4 shrink-0 text-primary" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{selected.name}</p>
                  <p className="text-[11px] text-muted-foreground uppercase">{selected.unit}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedId('')}
                className="shrink-0 rounded-lg p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted/60"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <p className="mb-1 text-[10px] text-muted-foreground">{t('quantity')}</p>
                <Input
                  type="number"
                  inputMode={selected.unit === 'kg' ? 'decimal' : 'numeric'}
                  step={selected.unit === 'kg' ? '0.001' : '1'}
                  min="0.001"
                  value={qty}
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => {
                    const v = selected.unit === 'kg'
                      ? parseFloat(e.target.value)
                      : parseInt(e.target.value, 10) || 0;
                    setQty(v || 1);
                  }}
                  className="h-10 text-center text-sm tabular-nums"
                />
              </div>
              <div>
                <p className="mb-1 text-[10px] text-muted-foreground">{t('costPrice')}</p>
                <Input
                  type="number"
                  inputMode="decimal"
                  step="0.001"
                  min="0"
                  value={cost}
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => setCost(parseFloat(e.target.value) || 0)}
                  className="h-10 text-center text-sm tabular-nums"
                />
              </div>
              <div>
                <p className="mb-1 text-[10px] text-muted-foreground">{t('expiryDate')}</p>
                <Input
                  type="date"
                  value={expiry}
                  onChange={(e) => setExpiry(e.target.value)}
                  className="h-10 text-[11px] px-2"
                />
              </div>
            </div>

            <Button className="h-12 w-full rounded-xl text-sm font-semibold" onClick={handleAdd}>
              {t('addToList')}
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

// ─── ReceiveCart ──────────────────────────────────────────────────────────────

interface Props {
  suppliers: { id: string; name: string }[];
  categories: { id: string; name: string }[];
  products: ProductRow[];
  initialBarcode?: string | null;
}

export function ReceiveCart({ suppliers, categories, products, initialBarcode }: Props) {
  const t = useTranslations('Receiving');
  const { activeBranchId, activeMembership } = useActiveBranch();
  const { celebrate } = useCelebration();
  const router = useRouter();
  const reduced = useReducedMotion();

  const [cart, setCart]             = useState<CartItem[]>([]);
  const [supplierId, setSupplierId] = useState('');
  const [reference, setReference]   = useState('');
  const [showScanner, setShowScanner]   = useState(false);
  const [showManual, setShowManual]     = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [pendingBarcode, setPendingBarcode] = useState<string | null>(null);
  // 'choice' = show two-button sheet, 'form' = show product creation sheet
  const [unknownSheet, setUnknownSheet] = useState<'choice' | 'form' | null>(null);
  const initDone = useRef(false);

  const tenantId = activeMembership?.tenant_id;

  // ── Add a line to cart ─────────────────────────────────────────────────────
  function addLine(item: CartItem) {
    setCart((prev) => {
      const lastIdx = prev.map((l) => l.product_id).lastIndexOf(item.product_id);
      if (lastIdx !== -1) {
        toast.info(t('duplicateScan'));
        return prev.map((l, i) =>
          i === lastIdx ? { ...l, quantity: l.quantity + item.quantity } : l,
        );
      }
      return [...prev, item];
    });
  }

  // ── Handle initial barcode from URL ────────────────────────────────────────
  useEffect(() => {
    if (initDone.current || !initialBarcode || !tenantId) return;
    initDone.current = true;

    lookupProduct(initialBarcode, tenantId).then((product) => {
      if (product) {
        addLine({
          product_id: product.id,
          product_name: product.name,
          unit: product.unit as 'pcs' | 'kg',
          quantity: 1,
          cost_price: 0,
          expiry_date: null,
        });
      } else {
        setPendingBarcode(initialBarcode);
        setUnknownSheet('choice');
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialBarcode, tenantId]);

  // ── Scanner callback ───────────────────────────────────────────────────────
  // Note: overlay calls onClose() BEFORE calling this, so camera is already gone.
  const handleScanned = useCallback(
    (barcode: string) => {
      if (!tenantId) return;
      lookupProduct(barcode, tenantId).then((product) => {
        if (product) {
          // KNOWN product: add directly to list — no popup
          addLine({
            product_id:   product.id,
            product_name: product.name,
            unit:         product.unit as 'pcs' | 'kg',
            quantity:     1,
            cost_price:   0,
            expiry_date:  null,
          });
        } else {
          // UNKNOWN product: show two-option sheet
          setPendingBarcode(barcode);
          setUnknownSheet('choice');
        }
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tenantId],
  );

  // ── After product-form sheet closes ───────────────────────────────────────
  function handleProductFormClose(open: boolean) {
    if (!open) {
      setUnknownSheet(null);
      if (pendingBarcode && tenantId) {
        lookupProduct(pendingBarcode, tenantId).then((p) => {
          if (p) {
            addLine({
              product_id:   p.id,
              product_name: p.name,
              unit:         p.unit as 'pcs' | 'kg',
              quantity:     1,
              cost_price:   0,
              expiry_date:  null,
            });
          }
          setPendingBarcode(null);
        });
      }
    }
  }

  // ── Line update / remove ───────────────────────────────────────────────────
  function updateLine(index: number, updated: Partial<CartItem>) {
    setCart((prev) => prev.map((l, i) => (i === index ? { ...l, ...updated } : l)));
  }

  function removeLine(index: number) {
    setCart((prev) => prev.filter((_, i) => i !== index));
  }

  // ── Confirm receipt ────────────────────────────────────────────────────────
  async function handleConfirm() {
    if (!activeBranchId || cart.length === 0) return;
    setIsConfirming(true);
    try {
      const res = await enqueueAndRun('receive_goods', {
        branch_id:   activeBranchId,
        supplier_id: supplierId && supplierId !== '__none__' ? supplierId : null,
        reference:   reference.trim() || null,
        lines: cart.map((l) => ({
          product_id:  l.product_id,
          quantity:    l.quantity,
          cost_price:  l.cost_price,
          expiry_date: l.expiry_date || null,
        })),
      });

      if (res.ok && !res.queued) {
        celebrate();
        toast.success(t('confirmSuccess'));
      } else if (res.ok && res.queued) {
        toast.success(t('confirmOffline'));
      } else {
        toast.error(res.error ?? 'فشل الاستلام');
        return;
      }

      setCart([]);
      setSupplierId('');
      setReference('');
      router.refresh();
    } finally {
      setIsConfirming(false);
    }
  }

  const totalCost = cart.reduce((s, l) => s + l.quantity * l.cost_price, 0);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <>
      {/* Sticky action bar */}
      <div className="sticky top-0 z-30 -mx-4 mb-4 flex gap-2 border-b border-border/40 bg-background/95 px-4 pb-3 pt-2 backdrop-blur-md">
        <Button
          className="h-12 flex-1 gap-2 rounded-xl shadow-md shadow-primary/20"
          onClick={() => setShowScanner(true)}
        >
          <ScanLine className="h-4 w-4 shrink-0" />
          {t('scanToAdd')}
        </Button>
        <Button
          variant="outline"
          className="h-12 flex-1 gap-2 rounded-xl"
          onClick={() => setShowManual(true)}
        >
          <PenLine className="h-4 w-4 shrink-0" />
          {t('addManually')}
        </Button>
      </div>

      {/* Supplier + Reference */}
      <div className="mb-4 grid grid-cols-2 gap-3">
        <SupplierSelect suppliers={suppliers} value={supplierId} onChange={setSupplierId} />
        <Input
          placeholder={t('referencePlaceholder')}
          value={reference}
          onChange={(e) => setReference(e.target.value)}
        />
      </div>

      {/* Items list */}
      {cart.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-4 flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border/60 py-12 text-center"
        >
          <Package className="h-10 w-10 text-muted-foreground/30" />
          <p className="text-sm font-medium text-muted-foreground">{t('cartEmpty')}</p>
          <p className="text-xs text-muted-foreground/60">{t('cartEmptyDesc')}</p>
        </motion.div>
      ) : (
        <div className="mb-4 space-y-2">
          <AnimatePresence initial={false}>
            {cart.map((line, index) => (
              <motion.div
                key={`${line.product_id}-${index}`}
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: 48, transition: { duration: 0.18 } }}
                transition={{ duration: reduced ? 0 : 0.22, ease: [0.22, 1, 0.36, 1] }}
              >
                <ReceiveLine
                  line={line}
                  onChange={(upd) => updateLine(index, upd)}
                  onRemove={() => removeLine(index)}
                />
              </motion.div>
            ))}
          </AnimatePresence>

          {/* Summary row */}
          <div className="flex items-center justify-between rounded-xl bg-muted/60 px-4 py-3">
            <span className="text-sm text-muted-foreground">
              {t('lineCount', { n: cart.length })}
            </span>
            <span className="text-lg font-bold tabular-nums">{formatAED(totalCost)}</span>
          </div>
        </div>
      )}

      {/* ✓ Confirm Receiving — always at bottom */}
      <div className="pb-6">
        <Button
          className="h-12 w-full rounded-xl text-sm font-semibold"
          disabled={isConfirming || cart.length === 0}
          onClick={handleConfirm}
        >
          {isConfirming ? (
            <span className="flex items-center gap-2">
              <RotateCcw className="h-4 w-4 animate-spin" />
              {t('confirming')}
            </span>
          ) : (
            t('confirmReceipt')
          )}
        </Button>
      </div>

      {/* Scanner overlay — closes itself before calling onScanned */}
      {showScanner && (
        <ReceiveScannerOverlay
          onClose={() => setShowScanner(false)}
          onScanned={handleScanned}
        />
      )}

      {/* Add manually sheet */}
      <AddManuallySheet
        open={showManual}
        onOpenChange={setShowManual}
        products={products}
        onAdd={addLine}
      />

      {/* Unknown barcode — step 1: two options */}
      <UnknownBarcodeSheet
        open={unknownSheet === 'choice'}
        barcode={pendingBarcode ?? ''}
        onAddProduct={() => setUnknownSheet('form')}
        onCancel={() => {
          setUnknownSheet(null);
          setPendingBarcode(null);
        }}
      />

      {/* Unknown barcode — step 2: create product as bottom sheet */}
      <ProductForm
        open={unknownSheet === 'form'}
        onOpenChange={handleProductFormClose}
        categories={categories}
        prefillBarcode={pendingBarcode ?? undefined}
        variant="sheet"
      />
    </>
  );
}
